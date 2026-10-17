import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { z } from "zod";
import { db, type MemberSummary } from "../lib/db";
import { authorizeSheets, currentSheetsToken, preloadSheetsIdentity } from "../lib/google-sheets-auth";
import { shareSpreadsheetReadOnly } from "../lib/google-drive-sharing";
import { readProfile } from "../lib/profile";
import {
  createSharedStyledSpreadsheet, createStyledSpreadsheet, prepareStyledSpreadsheet, readStyledTransactions,
  reconcileStyledTransactions, writeStyledSnapshot,
} from "../lib/sheets-template";
import { templateRows } from "../lib/sheets-template-model";
import { readSyncData } from "../lib/sync-data";
import { useSync } from "../sync-context";
import {
  fetchSharedSheetMirror, fetchSheetMemberEmails, saveSharedSheetMirror,
  type SharedSheetMirror, type Workspace,
} from "../lib/workspaces";
import { Button } from "./ui";

const mirrorState = z.object({
  spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  counts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  lastUploadedAt: z.number().int().nonnegative().optional(),
  prepared: z.boolean().optional(),
});
type MirrorState = z.infer<typeof mirrorState>;

const membersSchema = z.array(z.object({
  userId: z.string().uuid(), name: z.string(), role: z.enum(["owner", "member"]),
}));

function localSnapshot(userId: string, workspaceId: string) {
  return db.transaction("r", [db.accounts, db.categories, db.transactions, db.budgets, db.settings, db.syncState], async () => {
    const connection = await db.syncState.get("connection");
    if (connection?.userId !== userId || connection.workspaceId !== workspaceId) {
      throw new Error("O espaço ativo mudou. Abra novamente a planilha do espaço correto.");
    }
    return readSyncData(db);
  });
}

export function SheetsMirrorPanel({ userId, space }: { userId: string; space: Workspace }) {
  const sync = useSync();
  const workspaceId = space.id;
  const shared = space.kind === "shared";
  const key = `sheets-template:${userId}:${workspaceId}`;
  const legacyKey = `sheets-mirror:${userId}:${workspaceId}`;
  const saved = useLiveQuery(async () => await db.settings.get(key) ?? null, [key]);
  const legacy = useLiveQuery(async () => await db.settings.get(legacyKey) ?? null, [legacyKey]);
  const parsed = saved ? mirrorState.safeParse(saved.value) : null;
  const state = parsed?.success ? parsed.data : null;
  const oldState = legacy ? mirrorState.safeParse(legacy.value) : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState(!!currentSheetsToken());
  const [identityReady, setIdentityReady] = useState(!!window.google?.accounts.oauth2);
  const [remoteMirror, setRemoteMirror] = useState<SharedSheetMirror | null>(null);
  const [remoteLoadError, setRemoteLoadError] = useState<string | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(shared);

  useEffect(() => {
    if (shared && space.role !== "owner") return;
    if (!navigator.onLine) return;
    void preloadSheetsIdentity()
      .then(() => setIdentityReady(true))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar a autorização do Google.");
      });
  }, [shared, space.role]);

  useEffect(() => {
    let active = true;
    if (!shared || space.role === "owner") {
      setRemoteMirror(null);
      setRemoteLoading(false);
      return () => { active = false; };
    }
    setRemoteLoading(true);
    setRemoteLoadError(null);
    void sync.withSession((client, token) => fetchSharedSheetMirror(client, token, workspaceId))
      .then((mirror) => { if (active) setRemoteMirror(mirror); })
      .catch((cause: unknown) => {
        if (active) setRemoteLoadError(cause instanceof Error ? cause.message : "Não foi possível localizar a planilha compartilhada.");
      })
      .finally(() => { if (active) setRemoteLoading(false); });
    return () => { active = false; };
  }, [shared, space.role, sync, workspaceId]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage("");
    try { await work(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o espelho."); }
    finally { setBusy(false); }
  };

  const accessToken = async () => {
    const existing = currentSheetsToken();
    if (existing) return existing;
    const granted = await authorizeSheets();
    setAuthorized(true);
    return granted;
  };

  const spaceMembers = async (): Promise<MemberSummary[] | null> => {
    if (!shared) return null;
    await sync.refreshMembers(workspaceId);
    const cached = await db.workspaceMembers.get(workspaceId);
    const result = membersSchema.safeParse(cached?.members);
    if (!result.success || !result.data.some((member) => member.userId === userId && member.role === "owner")) {
      throw new Error("Não foi possível confirmar os participantes e o responsável deste espaço.");
    }
    return result.data;
  };

  const upload = async (token: string, connection: MirrorState) => {
    const members = await spaceMembers();
    const data = await localSnapshot(userId, workspaceId);
    const rows = templateRows(data, members);
    for (const sheet of Object.keys(rows) as Array<keyof typeof rows>) {
      if (rows[sheet].length < (connection.counts?.[sheet] ?? 0)) {
        throw new Error("Há menos registros locais que no último envio. O espelho foi pausado para não deixar linhas antigas visíveis.");
      }
    }
    const counts = Object.fromEntries(Object.entries(rows).map(([sheet, values]) => [sheet, values.length]));
    if (!connection.prepared) {
      await prepareStyledSpreadsheet(token, connection.spreadsheetId, data, fetch, members);
      await db.settings.put({ key, value: { ...connection, prepared: true, counts } satisfies MirrorState });
    } else if (connection.lastUploadedAt) {
      await readStyledTransactions(token, connection.spreadsheetId);
    }
    const profile = await readProfile(db);
    await localSnapshot(userId, workspaceId);
    const calls = await writeStyledSnapshot(token, connection.spreadsheetId, data,
      profile && (profile.userId === null || profile.userId === userId) ? profile : null,
      fetch, members, space.name);
    await db.settings.put({
      key,
      value: {
        spreadsheetId: connection.spreadsheetId,
        prepared: true, counts,
        lastUploadedAt: Date.now(),
      } satisfies MirrorState,
    });
    let accessMessage = "";
    if (shared) {
      try {
        const recipients = await sync.withSession((client, sessionToken) =>
          fetchSheetMemberEmails(client, sessionToken, workspaceId));
        const changed = await shareSpreadsheetReadOnly(token, connection.spreadsheetId, recipients);
        await sync.withSession((client, sessionToken) =>
          saveSharedSheetMirror(client, sessionToken, workspaceId, connection.spreadsheetId));
        setRemoteMirror({ spreadsheetId: connection.spreadsheetId, updatedAt: new Date().toISOString() });
        accessMessage = recipients.length === 0
          ? " O vínculo compartilhado foi registrado; ainda não há participantes."
          : ` Acesso somente leitura conferido para ${recipients.length} participante${recipients.length === 1 ? "" : "s"}${changed ? ` (${changed} atualizado${changed === 1 ? "" : "s"})` : ""}.`;
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : "Não foi possível atualizar as permissões.";
        throw new Error(`Os dados foram enviados, mas o acesso dos participantes não foi concluído. ${detail}`);
      }
    }
    setMessage(`Modelo preenchido em ${calls} lotes.${accessMessage} Confira o Dashboard e os gráficos no Google Sheets.`);
  };

  if (saved === undefined || legacy === undefined) return <p role="status" className="text-sm text-muted">Carregando planilhas...</p>;
  if (shared && space.role !== "owner") return (
    <div className="space-y-3">
      <h3 className="font-semibold">Planilha compartilhada com Dashboard</h3>
      {remoteLoading ? <p role="status" className="text-sm text-muted">Localizando a planilha do espaço...</p>
        : remoteMirror ? (
          <>
            <p className="text-sm text-muted">
              O responsável envia os dados. Você pode consultar a mesma planilha com permissão somente leitura.
            </p>
            <p className="text-sm">
              <a className="font-semibold text-brand-ink underline"
                href={`https://docs.google.com/spreadsheets/d/${remoteMirror.spreadsheetId}/view`}
                target="_blank" rel="noopener noreferrer">Abrir planilha compartilhada (somente leitura)</a>
            </p>
          </>
        )         : !remoteLoadError && <p className="text-sm text-muted">
          O responsável ainda não criou ou publicou a planilha deste espaço.
        </p>}
      {remoteLoadError && <p role="alert" className="text-sm text-negative">{remoteLoadError}</p>}
      <p className="text-xs text-muted">Os dados do espaço continuam sincronizados pelo Supabase.</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Planilha {shared ? "compartilhada" : "individual"} com Dashboard (teste)</h3>
      <p className="text-sm text-muted">
        Usa o modelo {shared ? "compartilhado" : "individual"} da pasta Instructions, com seu visual, fórmulas e gráficos. O Google converte o arquivo
        Excel, então confira se todos os gráficos e fórmulas funcionam. O app continua salvando no aparelho e sincronizando
        com o Supabase; esta planilha recebe apenas cópias manuais. Não edite as abas de dados da planilha nesta etapa.
      </p>
      {shared && <p className="text-sm text-muted">
        Ao criar ou atualizar, o app concede automaticamente acesso somente leitura aos participantes e publica o
        vínculo dentro do espaço. Apenas o responsável envia novas cópias deste navegador.
      </p>}
      {!state && !saved && (
        <p className="text-sm text-muted">
          Ao criar uma nova planilha, você autoriza o acesso apenas aos arquivos criados pelo Orange Finance.
          Confira se escolheu a mesma conta Google usada no aplicativo.
        </p>
      )}
      {parsed && !parsed.success && <p role="alert" className="text-sm text-negative">
        A configuração da planilha com modelo é inválida. Nenhuma planilha será substituída.
      </p>}
      {state && (
        <p className="text-sm">
          <a className="font-semibold text-brand-ink underline" href={`https://docs.google.com/spreadsheets/d/${state.spreadsheetId}/edit`}
            target="_blank" rel="noopener noreferrer">Abrir planilha com Dashboard</a>
          {state.lastUploadedAt && ` · Último envio: ${new Date(state.lastUploadedAt).toLocaleString("pt-BR")}`}
        </p>
      )}
      {!shared && oldState?.success && (
        <p className="text-sm text-muted">
          <a className="font-semibold text-brand-ink underline"
            href={`https://docs.google.com/spreadsheets/d/${oldState.data.spreadsheetId}/edit`}
            target="_blank" rel="noopener noreferrer">Abrir planilha simples anterior</a>
          {" "}— preservada sem alterações.
        </p>
      )}
      {oldState && !oldState.success && (
        <p role="alert" className="text-sm text-negative">O vínculo com a planilha simples anterior está inválido; ela não foi alterada.</p>
      )}
      <Button variant="secondary" disabled={busy || !navigator.onLine || !identityReady || (parsed !== null && !parsed.success)}
        onClick={() => void run(async () => {
          const token = await accessToken();
          let connection = state;
          if (!connection) {
            const spreadsheetId = shared
              ? await createSharedStyledSpreadsheet(token, `Orange Finance - ${space.name}`)
              : await createStyledSpreadsheet(token, "Orange Finance - Pessoal");
            connection = { spreadsheetId };
            await db.settings.put({ key, value: connection });
          }
          await upload(token, connection);
        })}>
        {busy ? "Enviando..." : !identityReady ? "Carregando Google..." : state ? "Atualizar planilha com modelo" : "Criar planilha com modelo"}
      </Button>
      {state && (
        <Button variant="secondary" disabled={busy || !navigator.onLine || !identityReady} onClick={() => void run(async () => {
          const token = await accessToken();
          const local = await localSnapshot(userId, workspaceId);
          const remote = await readStyledTransactions(token, state.spreadsheetId);
          const result = reconcileStyledTransactions(local, remote, shared);
          setMessage(result.matches
            ? "Conferência concluída: contagens e totais por conta, mês e tipo coincidem."
            : "A planilha e este aparelho têm contagens ou totais diferentes. Confira antes de reenviar.");
        })}>Conferir planilha</Button>
      )}
      {!identityReady && error && navigator.onLine && (
        <Button variant="ghost" onClick={() => void preloadSheetsIdentity().then(() => {
          setIdentityReady(true);
          setError(null);
        }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar o Google."))}>
          Tentar carregar o Google novamente
        </Button>
      )}
      {authorized && <span className="text-xs text-muted">Autorização temporária neste navegador.</span>}
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </div>
  );
}
