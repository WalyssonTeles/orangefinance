import type { Session } from "@supabase/supabase-js";
import { useLiveQuery } from "dexie-react-hooks";
import {
  createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { db } from "./lib/db";
import { readSyncData, stable } from "./lib/sync-data";
import { supabase } from "./lib/supabase";
import { googleSignInUrl, oauthRedirectUrl } from "./lib/google-auth";
import {
  connectSync, supabaseRemote, switchWorkspace, syncOnce, SyncConflict, type Resolution,
} from "./lib/sync";
import { fetchWorkspaces, type Workspace } from "./lib/workspaces";
import { SyncPanel } from "./components/SyncPanel";
import { navigate } from "./lib/router";

interface SyncContextValue {
  session: Session | null;
  busy: boolean;
  syncing: boolean;
  bound: boolean;
  wrongAccount: boolean;
  online: boolean;
  message: string;
  error: string | null;
  conflict: SyncConflict | null;
  lastSynced: Date | null;
  spaces: Workspace[];
  activeSpace: Workspace | null;
  initialChoice: boolean;
  refreshSpaces(): Promise<void>;
  switchSpace(id: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  connect(useCloud: boolean | "auto"): Promise<void>;
  synchronize(resolution?: Resolution): Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);
export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error("SyncProvider não foi inicializado.");
  return value;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Ocorreu um erro de sincronização.";

export function SyncProvider({ children, initialAuthError = null }: { children: ReactNode; initialAuthError?: string | null }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [initialChoice, setInitialChoice] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(initialAuthError);
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const connection = useLiveQuery(async () => await db.syncState.get("connection") ?? null);
  const localSignature = useLiveQuery(async () => stable(await readSyncData(db)));
  const userId = session?.user.id;
  const catalog = useLiveQuery(async () => userId ? await db.workspaceCatalog.get(userId) ?? null : null, [userId]);
  const spaces = useMemo(() => catalog?.spaces ?? [], [catalog]);
  const activeSpace = spaces.find((space) => space.id === connection?.workspaceId) ?? null;
  const bound = !!connection && connection.userId === userId;
  const wrongAccount = !!connection && !!userId && connection.userId !== userId;
  const personalSpaceId = spaces.find((space) => space.kind === "personal")?.id;

  useEffect(() => { setInitialChoice(false); }, [userId]);

  const refreshSpaces = useCallback(async () => {
    const current = sessionRef.current;
    if (!supabase || !current || !navigator.onLine) return;
    const list = await fetchWorkspaces(supabase, current.access_token);
    if (sessionRef.current?.user.id !== current.user.id) return;
    await db.workspaceCatalog.put({ userId: current.user.id, spaces: list });
  }, []);

  useEffect(() => {
    if (!userId) return;
    void refreshSpaces().catch((cause: unknown) => {
      if (mounted.current) setError(errorMessage(cause));
    });
  }, [userId, refreshSpaces]);

  useEffect(() => {
    mounted.current = true;
    const client = supabase;
    if (!client) { setReady(true); return; }
    let disposed = false;
    let authChanged = false;
    const { data } = client.auth.onAuthStateChange((event, next) => {
      authChanged = true;
      if (disposed) return;
      setSession(next);
      setConflict(null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setError(null);
      setLastSynced(null);
      setReady(true);
    });
    void client.auth.getSession().then(({ data: auth, error: authError }) => {
      if (disposed || authChanged) return;
      if (authError) setError(authError.message);
      else setSession(auth.session);
      setReady(true);
    }).catch((cause: unknown) => {
      if (!disposed) { setError(errorMessage(cause)); setReady(true); }
    });
    return () => { disposed = true; mounted.current = false; data.subscription.unsubscribe(); };
  }, []);

  const synchronize = useCallback(async (resolution?: Resolution) => {
    if (!supabase || !userId || !bound || !activeSpace || running.current) return;
    if (!navigator.onLine) { setOnline(false); return; }
    running.current = true;
    setSyncing(true);
    try {
      const token = sessionRef.current?.user.id === userId ? sessionRef.current.access_token : null;
      if (!token) throw new Error("A sessão mudou. Entre novamente na mesma conta.");
      await syncOnce(userId, supabaseRemote(supabase, activeSpace.id, token), db, resolution);
      if (!mounted.current || sessionRef.current?.user.id !== userId) return;
      setConflict(null);
      setError(null);
      setLastSynced(new Date());
    } catch (cause) {
      if (!mounted.current || sessionRef.current?.user.id !== userId) return;
      setError(errorMessage(cause));
      setConflict(cause instanceof SyncConflict ? cause : null);
    } finally {
      running.current = false;
      if (mounted.current) setSyncing(false);
    }
  }, [userId, bound, activeSpace?.id]);

  useEffect(() => {
    if (!bound) return;
    const timer = setTimeout(() => { void synchronize(); }, 800);
    return () => clearTimeout(timer);
  }, [bound, localSignature, synchronize]);

  useEffect(() => {
    const resume = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine && document.visibilityState === "visible") void synchronize();
    };
    const offline = () => setOnline(false);
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", resume);
    const interval = setInterval(resume, 15_000);
    const catalogInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") {
        void refreshSpaces().catch((cause: unknown) => setError(errorMessage(cause)));
      }
    }, 60_000);
    return () => {
      clearInterval(interval);
      clearInterval(catalogInterval);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [synchronize, refreshSpaces]);

  const action = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage("");
    try { await work(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }, []);

  const connect = useCallback(async (useCloud: boolean | "auto") => {
    if (running.current) return;
    await action(async () => {
      if (!supabase || !userId) throw new Error("Entre na sua conta primeiro.");
      const current = sessionRef.current;
      if (!current || current.user.id !== userId) throw new Error("A sessão mudou. Entre novamente.");
      const latest = await db.workspaceCatalog.get(userId);
      const personal = latest?.spaces.find((space) => space.kind === "personal");
      if (!personal) throw new Error("Não foi possível carregar sua conta. Tente novamente.");
      running.current = true;
      setPreparing(true);
      try {
        const result = await connectSync(userId, supabaseRemote(supabase, personal.id, current.access_token), useCloud);
        if (sessionRef.current?.user.id !== userId) return;
        setInitialChoice(result === "choice-required");
        if (result === "connected") {
          setMessage("Seus dados estão sincronizados.");
          navigate("inicio");
        }
      } finally {
        running.current = false;
        setPreparing(false);
      }
    });
  }, [userId, action]);

  useEffect(() => {
    if (!userId || connection !== null || !personalSpaceId || !online) return;
    void connect("auto");
  }, [userId, connection, personalSpaceId, online, connect]);

  const value = useMemo<SyncContextValue>(() => ({
    session, busy: busy || preparing, syncing, bound, wrongAccount, online, message, error, conflict, lastSynced,
    synchronize, spaces, activeSpace, refreshSpaces, connect, initialChoice,
    async switchSpace(id) {
      await action(async () => {
        if (!supabase || !userId) throw new Error("Entre na sua conta primeiro.");
        if (running.current) throw new Error("Aguarde a sincronização atual terminar.");
        const latest = await db.workspaceCatalog.get(userId);
        if (!latest?.spaces.some((space) => space.id === id)) throw new Error("Este espaço não está disponível para sua conta.");
        const current = sessionRef.current;
        if (!current || current.user.id !== userId) throw new Error("A sessão mudou.");
        running.current = true;
        try { await switchWorkspace(userId, supabaseRemote(supabase, id, current.access_token)); }
        finally { running.current = false; }
        setConflict(null);
        setError(null);
        setLastSynced(null);
      });
    },
    async signInWithGoogle() {
      await action(async () => {
        if (!supabase) throw new Error("Configure o Supabase antes de entrar.");
        const redirectTo = oauthRedirectUrl(window.location.origin, import.meta.env.BASE_URL);
        const url = await googleSignInUrl(supabase, redirectTo);
        window.location.assign(url);
      });
    },
    async signOut() {
      await action(async () => {
        if (!supabase) throw new Error("Supabase não configurado.");
        if (running.current) throw new Error("Aguarde a sincronização terminar antes de sair.");
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
        setMessage("Você saiu. Os dados locais foram mantidos e só serão exibidos após entrar novamente na mesma conta.");
      });
    },
  }), [session, busy, preparing, syncing, bound, wrongAccount, online, message, error, conflict, lastSynced, synchronize, action, userId, spaces, activeSpace, refreshSpaces, connect, initialChoice]);

  const locked = !!connection && !bound;
  return (
    <SyncContext.Provider value={value}>
      {!ready || connection === undefined || (!!userId && catalog === undefined) ? (
        <div role="status" className="grid min-h-dvh place-items-center">Carregando sessão...</div>
      ) : locked || (session && !connection) || (bound && !activeSpace) ? (
        <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
          <h1 className="font-display text-2xl font-bold">Orange Finance</h1>
          <SyncPanel onboarding={!connection} />
        </main>
      ) : (
        <>
          {bound && (!online || error) && (
            <a href="#/ajustes" role="status" className="fixed left-0 right-0 top-0 z-50 block bg-orange-soft px-4 py-2 text-center text-sm text-brand-ink">
              {!online ? "Sem internet. Alterações salvas neste aparelho; serão sincronizadas ao reconectar." : `${error} Toque para abrir Ajustes.`}
            </a>
          )}
          {bound && activeSpace && (
            <div className="border-b border-line bg-orange-soft px-4 py-1 text-center text-xs font-semibold text-brand-ink">
              {activeSpace.kind === "personal" ? "Pessoal" : "Familiar"}: {activeSpace.name} · Troque de espaço em <a className="underline" href="#/ajustes">Ajustes</a>
            </div>
          )}
          <Fragment key={connection?.workspaceId ?? "local"}>{children}</Fragment>
        </>
      )}
    </SyncContext.Provider>
  );
}
