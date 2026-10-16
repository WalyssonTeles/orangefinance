import { ArrowDownUp, ArrowUp, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Money } from "../components/Money";
import { Select } from "../components/Select";
import { TransactionRow } from "../components/TransactionRow";
import { Card, EmptyState, Field, inputClass, MonthPicker, PageHeader } from "../components/ui";
import type { Transaction, TxType } from "../lib/db";
import { dayLabel, monthLabel } from "../lib/dates";
import { groupByDate, inMonth, matchesSearch, monthSummary } from "../lib/finance";
import { replaceParams, useLocation } from "../lib/router";
import { useApp } from "../state";

type Filter = "all" | TxType | "pending";
const NO_HOLDER = "__none__";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Despesas" },
  { value: "income", label: "Receitas" },
  { value: "transfer", label: "Transferências" },
  { value: "pending", label: "Pendentes" },
];

function filterFromParam(value: string | null): Filter {
  return FILTERS.some((f) => f.value === value) ? (value as Filter) : "all";
}

function matchesFilter(t: Transaction, filter: Filter): boolean {
  return filter === "all" || (filter === "pending" ? !t.paid : t.type === filter);
}

export function Transactions() {
  const { data, month, setMonth, sharedSpace, members, memberById } = useApp();
  const { params, section } = useLocation();
  const listRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [ascending, setAscending] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilterState] = useState<Filter>(() => filterFromParam(params.get("tipo")));
  const [accountId, setAccountId] = useState(() => params.get("conta") ?? "");
  const [categoryId, setCategoryId] = useState(() => params.get("categoria") ?? "");
  const [holderId, setHolderId] = useState(() => params.get("titular") ?? "");

  useEffect(() => {
    setFilterState(filterFromParam(params.get("tipo")));
    setCategoryId(params.get("categoria") ?? "");
    setHolderId(params.get("titular") ?? "");
    setAccountId(params.get("conta") ?? "");
  }, [params]);

  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => listRef.current?.style.setProperty("--transactions-header-height", `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (section !== "lista") return;
    const frame = requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "start", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [section, params]);

  const updateUrl = (type: Filter, holder: string, category: string, account = accountId) => {
    replaceParams("lancamentos", section, {
      ...(type !== "all" ? { tipo: type } : {}),
      ...(holder ? { titular: holder } : {}),
      ...(category ? { categoria: category } : {}),
      ...(account ? { conta: account } : {}),
    });
  };

  const selectHolder = (next: string) => {
    setHolderId(next);
    updateUrl(filter, next, categoryId);
  };
  const selectCategory = (next: string) => {
    setCategoryId(next);
    updateUrl(filter, holderId, next);
  };

  const setFilter = (next: Filter) => {
    setFilterState(next);
    updateUrl(next, holderId, categoryId);
  };

  const monthTx = useMemo(() => data.transactions.filter((t) => inMonth(t, month)), [data.transactions, month]);
  const personTx = useMemo(
    () => !sharedSpace || !holderId ? monthTx : monthTx.filter((t) => (holderId === NO_HOLDER ? !t.holderId || !memberById.has(t.holderId) : t.holderId === holderId)),
    [monthTx, holderId, sharedSpace, memberById],
  );
  const summary = useMemo(() => monthSummary(personTx, month), [personTx, month]);

  // Only categories that appear in the entries currently on screen (month, person and type filters).
  const availableCategories = useMemo(() => {
    const used = new Set(personTx.filter((t) => matchesFilter(t, filter)).map((t) => t.categoryId).filter(Boolean));
    if (categoryId && categoryId !== "__none__") used.add(categoryId);
    return data.categories.filter((c) => used.has(c.id));
  }, [personTx, filter, categoryId, data.categories]);
  const hasUnassigned = sharedSpace && monthTx.some((t) => !t.holderId || !memberById.has(t.holderId));
  const hasUncategorized = personTx.some((t) => matchesFilter(t, filter) && !t.categoryId);

  const groups = useMemo(() => {
    const visible = personTx.filter(
      (t) =>
        matchesFilter(t, filter) &&
        (!accountId || t.accountId === accountId || t.toAccountId === accountId) &&
        (!categoryId || (categoryId === "__none__" ? !t.categoryId : t.categoryId === categoryId)) &&
        matchesSearch(t, query, data.categoryById),
    );
    return groupByDate(visible, ascending);
  }, [personTx, filter, accountId, categoryId, query, data.categoryById, ascending]);

  const filtered = query || filter !== "all" || accountId || categoryId || holderId;

  return (
    <div>
      <div ref={headerRef} className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-cream px-4 py-3 [&>header]:mb-0 sm:-mx-6 sm:px-6 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <PageHeader
          title="Lançamentos"
          actionsClassName="w-full sm:w-80"
          actions={<MonthPicker month={month} onChange={setMonth} className="w-full" />}
        />
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface min-[400px]:grid min-[400px]:grid-cols-3 min-[400px]:gap-2 min-[400px]:overflow-visible min-[400px]:border-0 min-[400px]:bg-transparent sm:gap-3">
        {[
          { label: "Receitas", cents: summary.income, className: "text-positive" },
          { label: "Despesas", cents: summary.expense, className: "text-ink" },
          { label: "Resultado", cents: summary.net, className: summary.net < 0 ? "text-negative" : "text-positive" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-baseline justify-between gap-2 border-line px-3.5 py-2 not-last:border-b min-[400px]:block min-[400px]:rounded-2xl min-[400px]:border min-[400px]:bg-surface min-[400px]:px-2.5 min-[400px]:py-2.5 sm:px-4 sm:py-3"
          >
            <p className="text-sm font-semibold text-muted min-[400px]:text-xs sm:text-sm">{item.label}</p>
            <Money fit cents={item.cents} className={`text-right text-[0.95rem] font-bold min-[400px]:text-left sm:text-lg ${item.className}`} />
          </div>
        ))}
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" aria-expanded={expanded} aria-controls="transaction-filters" onClick={() => setExpanded((previous) => !previous)} className="text-sm font-semibold text-brand-ink hover:underline">{expanded ? "Ocultar filtros" : "Exibir Filtros"}{filtered ? " · ativos" : ""}</button>
          <button type="button" aria-label={ascending ? "Ordenar do mais recente para o mais antigo" : "Ordenar do mais antigo para o mais recente"} title={ascending ? "Mais antigos primeiro" : "Mais recentes primeiro"} aria-pressed={ascending} onClick={() => setAscending((previous) => !previous)} className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted hover:bg-cream"><ArrowDownUp size={18} /><span className="hidden sm:inline">{ascending ? "Mais antigos" : "Mais recentes"}</span></button>
        </div>
        <div id="transaction-filters" hidden={!expanded} className="mt-3 space-y-3">
          <Field label="Buscar Lançamentos">
            <div className="relative">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className={`${inputClass} pl-10`}
              placeholder="Buscar lançamentos"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            </div>
          </Field>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-sm font-semibold text-muted">Tipo de Lançamento</legend>
            <div className="drag-row flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                  filter === f.value ? "bg-ink text-white" : "bg-ink/5 text-muted hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
            </div>
          </fieldset>
          {sharedSpace && (
            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-sm font-semibold text-muted">Titular</legend>
              <div className="drag-row flex gap-2 overflow-x-auto pb-1">
              {[{ id: "", name: "Todos" }, ...members.map((m) => ({ id: m.userId, name: m.name })),
                ...(hasUnassigned ? [{ id: NO_HOLDER, name: "Sem titular" }] : []),
                ...(holderId && holderId !== NO_HOLDER && !memberById.has(holderId) ? [{ id: holderId, name: "Ex-participante" }] : [])]
                .map((person) => (
                  <button
                    key={person.id || "all"}
                    type="button"
                    aria-pressed={holderId === person.id}
                    onClick={() => selectHolder(person.id)}
                    className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                      holderId === person.id ? "border-brand bg-orange-soft text-brand-ink" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Contas e Cartões">
            <Select label="Contas e Cartões" value={accountId} onChange={(value) => { setAccountId(value); updateUrl(filter, holderId, categoryId, value); }} options={[
              { value: "", label: "Todas as contas" },
              ...data.accounts.map((a) => ({ value: a.id, label: `${a.name}${sharedSpace && a.holderId ? ` · ${memberById.get(a.holderId)?.name ?? "Ex-participante"}` : ""}` })),
            ]} />
            </Field>
            <Field label="Categoria">
            <Select label="Categoria" value={categoryId} onChange={selectCategory} options={[
              { value: "", label: availableCategories.length ? "Todas as categorias" : "Nenhuma categoria nesta lista" },
              ...(hasUncategorized || categoryId === "__none__" ? [{ value: "__none__", label: "Sem categoria" }] : []),
              ...availableCategories.map((c) => ({ value: c.id, label: `${c.name}${filter === "all" || filter === "pending" ? ` (${c.kind === "income" ? "receita" : "despesa"})` : ""}` })),
            ]} />
            </Field>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setAccountId("");
                setCategoryId("");
                setHolderId("");
                updateUrl("all", "", "", "");
              }}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
            >
              <X size={14} /> Limpar filtros
            </button>
          )}
        </div>
      </Card>
      <div ref={listRef} className="mt-4 scroll-mt-[calc(var(--transactions-header-height,0px)+5rem)] lg:scroll-mt-5" tabIndex={-1} role="region" aria-label="Lista de lançamentos">
      <Card className="p-3 sm:p-4">
        <div className="pt-1">
          {groups.length === 0 ? (
            <EmptyState
              title={filtered ? "Nada encontrado" : "Nenhum lançamento"}
              text={filtered ? "Tente outros filtros ou termos de busca." : `Você ainda não tem lançamentos em ${monthLabel(month).toLowerCase()}.`}
            />
          ) : (
            groups.map(([date, items]) => (
              <section key={date} className="pt-3">
                <h2 className="px-2 pb-1 text-xs font-bold tracking-wide text-muted uppercase">{dayLabel(date)}</h2>
                <div className="-mx-1">
                  {items.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </Card>
      </div>
      {showBackToTop && createPortal(
        <button
          type="button"
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
          className="fixed right-6 bottom-6 z-40 hidden size-12 place-items-center rounded-full bg-brand text-white shadow-lg transition-colors hover:bg-brand-hover lg:grid"
        >
          <ArrowUp size={22} />
        </button>,
        document.body,
      )}
    </div>
  );
}
