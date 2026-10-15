import { ArrowLeftRight, Eye, EyeOff, House, Landmark, Plus, Settings as SettingsIcon, Target, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Logo, Wordmark } from "./components/Logo";
import { TransactionForm } from "./components/TransactionForm";
import { IconButton } from "./components/ui";
import { currentMonth } from "./lib/dates";
import { useFinanceData, useSetting } from "./lib/hooks";
import { navigate, useRoute, type Route } from "./lib/router";
import { Accounts } from "./pages/Accounts";
import { Budgets } from "./pages/Budgets";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { Transactions } from "./pages/Transactions";
import { AppContext, type AppState, type Toast, type TransactionRequest } from "./state";

const NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: "inicio", label: "Início", icon: House },
  { route: "lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { route: "contas", label: "Contas", icon: Landmark },
  { route: "orcamentos", label: "Orçamentos", icon: Target },
  { route: "ajustes", label: "Ajustes", icon: SettingsIcon },
];

const PAGES: Record<Route, ComponentType> = {
  inicio: Dashboard,
  lancamentos: Transactions,
  contas: Accounts,
  orcamentos: Budgets,
  ajustes: Settings,
};

export default function App() {
  const data = useFinanceData();
  const route = useRoute();
  const hideOnStart = useSetting<boolean | undefined>("hideValues", undefined);
  const [month, setMonth] = useState(currentMonth);
  const [hidden, setHidden] = useState(false);
  const [request, setRequest] = useState<TransactionRequest | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const appliedHidePreference = useRef(false);

  useEffect(() => {
    if (appliedHidePreference.current || hideOnStart === undefined) return;
    appliedHidePreference.current = true;
    setHidden(hideOnStart);
  }, [hideOnStart]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const openTransaction = useCallback((req: TransactionRequest = {}) => setRequest(req), []);
  const notify = useCallback<AppState["notify"]>((message, action) => setToast({ id: Date.now(), message, action }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey || request) return;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("[role='dialog']")) return;
      e.preventDefault();
      setRequest({});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  const state = useMemo<AppState>(
    () => ({ data, month, setMonth, hidden, toggleHidden: () => setHidden((h) => !h), openTransaction, notify }),
    [data, month, hidden, openTransaction, notify],
  );

  if (!data.ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Logo className="size-16 animate-pulse" />
      </div>
    );
  }

  const Page = PAGES[route];
  const EyeIcon = hidden ? EyeOff : Eye;

  return (
    <AppContext.Provider value={state}>
      <div className="min-h-dvh lg:pl-64">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 px-4 py-6 lg:flex">
          <div className="px-2">
            <Wordmark />
          </div>
          <button
            type="button"
            onClick={() => openTransaction()}
            className="mt-7 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <Plus size={20} strokeWidth={2.5} /> Novo lançamento
          </button>
          <nav className="mt-5 space-y-1" aria-label="Principal">
            {NAV.map(({ route: r, label, icon: Icon }) => {
              const active = r === route;
              return (
                <a
                  key={r}
                  href={r === "inicio" ? "#/" : `#/${r}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors ${
                    active ? "bg-orange-soft text-brand-ink" : "text-muted hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                  {label}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3 px-1">
            <button
              type="button"
              onClick={state.toggleHidden}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-2 text-sm font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <EyeIcon size={18} />
              {hidden ? "Mostrar valores" : "Ocultar valores"}
            </button>
            <p className="px-2 text-xs leading-relaxed text-muted">
              Dados salvos neste dispositivo. Pressione <kbd className="rounded border border-line bg-surface px-1 font-sans">N</kbd> para um novo lançamento.
            </p>
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line/70 bg-cream/90 px-4 backdrop-blur-md lg:hidden">
          <Wordmark />
          <div className="flex items-center">
            <IconButton label={hidden ? "Mostrar valores" : "Ocultar valores"} onClick={state.toggleHidden}>
              <EyeIcon size={20} />
            </IconButton>
            <IconButton
              label="Ajustes"
              onClick={() => navigate("ajustes")}
              className={route === "ajustes" ? "bg-orange-soft text-brand-ink" : ""}
            >
              <SettingsIcon size={20} />
            </IconButton>
          </div>
        </header>

        <main key={route} className="page-in mx-auto max-w-6xl px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">
          <Page />
        </main>

        {/* Mobile bottom navigation */}
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
            {NAV.slice(0, 2).map((item) => (
              <BottomLink key={item.route} {...item} active={item.route === route} />
            ))}
            <div className="flex justify-center">
              <button
                type="button"
                aria-label="Novo lançamento"
                onClick={() => openTransaction()}
                className="-mt-7 grid size-14 place-items-center rounded-2xl bg-brand text-white ring-4 ring-cream transition-transform active:scale-95"
              >
                <Plus size={26} strokeWidth={2.5} />
              </button>
            </div>
            {NAV.slice(2, 4).map((item) => (
              <BottomLink key={item.route} {...item} active={item.route === route} />
            ))}
          </div>
        </nav>

        {request && <TransactionForm key={request.id ?? "new"} request={request} onClose={() => setRequest(null)} />}

        {toast && (
          <div
            key={toast.id}
            role="status"
            className="toast-in fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white lg:bottom-6"
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="font-bold text-orange"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}

function BottomLink({ route, label, icon: Icon, active }: { route: Route; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <a
      href={route === "inicio" ? "#/" : `#/${route}`}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 text-[0.7rem] font-semibold ${active ? "text-brand-ink" : "text-muted"}`}
    >
      <Icon size={22} strokeWidth={active ? 2.4 : 2} />
      {label}
    </a>
  );
}
