import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Money } from "../components/Money";
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
  const { params } = useLocation();
  const [query, setQuery] = useState("");
  const [filter, setFilterState] = useState<Filter>(() => filterFromParam(params.get("tipo")));
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState(() => params.get("categoria") ?? "");
  const [holderId, setHolderId] = useState(() => params.get("titular") ?? "");

  useEffect(() => {
    setFilterState(filterFromParam(params.get("tipo")));
    setCategoryId(params.get("categoria") ?? "");
    setHolderId(params.get("titular") ?? "");
  }, [params]);

  const updateUrl = (type: Filter, holder: string, category: string) => {
    replaceParams("lancamentos", null, {
      ...(type !== "all" ? { tipo: type } : {}),
      ...(holder ? { titular: holder } : {}),
      ...(category ? { categoria: category } : {}),
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
    return groupByDate(visible);
  }, [personTx, filter, accountId, categoryId, query, data.categoryById]);

  const filtered = query || filter !== "all" || accountId || categoryId || holderId;

  return (
    <div>
      <PageHeader
        title="Lançamentos"
        actionsClassName="w-full sm:w-80"
        actions={<MonthPicker month={month} onChange={setMonth} className="w-full" />}
      />

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
        <div className="space-y-3">
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
            <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Todas as contas</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{sharedSpace && a.holderId ? ` · ${memberById.get(a.holderId)?.name ?? "Ex-participante"}` : ""}
                </option>
              ))}
            </select>
            </Field>
            <Field label="Categoria">
            <select className={inputClass} value={categoryId} onChange={(e) => selectCategory(e.target.value)}>
              <option value="">{availableCategories.length ? "Todas as categorias" : "Nenhuma categoria nesta lista"}</option>
              {(hasUncategorized || categoryId === "__none__") && <option value="__none__">Sem categoria</option>}
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{filter === "all" || filter === "pending" ? ` (${c.kind === "income" ? "receita" : "despesa"})` : ""}
                </option>
              ))}
            </select>
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
                updateUrl("all", "", "");
              }}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
            >
              <X size={14} /> Limpar filtros
            </button>
          )}
        </div>

        <div className="mt-3 border-t border-line pt-1">
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
  );
}
