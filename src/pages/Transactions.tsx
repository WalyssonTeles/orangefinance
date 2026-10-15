import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Money } from "../components/Money";
import { TransactionRow } from "../components/TransactionRow";
import { Button, Card, EmptyState, inputClass, MonthPicker, PageHeader } from "../components/ui";
import type { TxType } from "../lib/db";
import { dayLabel, monthLabel } from "../lib/dates";
import { groupByDate, inMonth, matchesSearch, monthSummary } from "../lib/finance";
import { useApp } from "../state";

type Filter = "all" | TxType | "pending";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Despesas" },
  { value: "income", label: "Receitas" },
  { value: "transfer", label: "Transferências" },
  { value: "pending", label: "Pendentes" },
];

export function Transactions() {
  const { data, month, setMonth, openTransaction } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const monthTx = useMemo(() => data.transactions.filter((t) => inMonth(t, month)), [data.transactions, month]);
  const summary = useMemo(() => monthSummary(monthTx, month), [monthTx, month]);

  const groups = useMemo(() => {
    const visible = monthTx.filter(
      (t) =>
        (filter === "all" || (filter === "pending" ? !t.paid : t.type === filter)) &&
        (!accountId || t.accountId === accountId || t.toAccountId === accountId) &&
        (!categoryId || t.categoryId === categoryId) &&
        matchesSearch(t, query, data.categoryById),
    );
    return groupByDate(visible);
  }, [monthTx, filter, accountId, categoryId, query, data.categoryById]);

  const filtered = query || filter !== "all" || accountId || categoryId;

  return (
    <div>
      <PageHeader
        title="Lançamentos"
        actions={
          <>
            <MonthPicker month={month} onChange={setMonth} />
            <Button className="hidden lg:inline-flex" onClick={() => openTransaction()}>
              <Plus size={18} /> Novo
            </Button>
          </>
        }
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
          <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="Filtrar por conta" className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Todas as contas</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select aria-label="Filtrar por categoria" className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas as categorias</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind === "income" ? "receita" : "despesa"})
                </option>
              ))}
            </select>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setAccountId("");
                setCategoryId("");
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
              action={
                !filtered && (
                  <Button onClick={() => openTransaction()}>
                    <Plus size={18} /> Novo lançamento
                  </Button>
                )
              }
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
