import { ArrowDownRight, ArrowUpRight, Check, CreditCard, Plus } from "lucide-react";
import { useMemo } from "react";
import { Donut } from "../components/Donut";
import { categoryIcon, ColorIcon } from "../components/icons";
import { Money } from "../components/Money";
import { TransactionRow } from "../components/TransactionRow";
import { Button, Card, CardHeader, EmptyState, MonthPicker, ProgressBar } from "../components/ui";
import { currentMonth, lastDayOfMonth, monthLabel, shortDate, shortMonthLabel, todayISO } from "../lib/dates";
import {
  accountBalances,
  budgetProgress,
  isCredit,
  monthlyHistory,
  monthSummary,
  sortTransactions,
  totalBalance,
  totalsByCategory,
  upcomingBills,
} from "../lib/finance";
import { useSetting } from "../lib/hooks";
import { loadDemoData } from "../lib/demo";
import { setPaid } from "../lib/repo";
import { navigate } from "../lib/router";
import { useApp } from "../state";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function Dashboard() {
  const { data, month, setMonth, openTransaction, notify } = useApp();
  const name = useSetting("userName", "");
  const { accounts, transactions, categoryById, budgets } = data;

  const stats = useMemo(() => {
    const balances = accountBalances(accounts, transactions);
    const isFutureOrCurrent = month >= currentMonth();
    const forecast = accountBalances(accounts, transactions, { forecastUntil: lastDayOfMonth(month) });
    return {
      balance: totalBalance(accounts, balances),
      forecast: isFutureOrCurrent ? totalBalance(accounts, forecast) : null,
      summary: monthSummary(transactions, month),
      byCategory: totalsByCategory(transactions, month),
      bills: upcomingBills(transactions, month),
      budgets: budgetProgress(budgets, transactions, month).slice(0, 4),
      history: monthlyHistory(transactions, month),
      recent: sortTransactions(transactions.filter((t) => t.date <= todayISO())).slice(0, 5),
      cards: accounts.filter(isCredit).map((a) => ({ account: a, owed: -(balances.get(a.id) ?? 0) })),
    };
  }, [accounts, transactions, budgets, month]);

  const historyMax = Math.max(1, ...stats.history.flatMap((h) => [h.income, h.expense]));
  const topCategories = stats.byCategory.slice(0, 5);
  const otherShare = stats.byCategory.slice(5).reduce((sum, c) => sum + c.total, 0);
  const slices = [
    ...topCategories.map((c) => ({
      key: c.categoryId ?? "none",
      value: c.total,
      color: (c.categoryId && categoryById.get(c.categoryId)?.color) || "#868E96",
    })),
    ...(otherShare ? [{ key: "others", value: otherShare, color: "#D8CFC6" }] : []),
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted">{greeting()}{name ? "," : "!"}</p>
          {name && <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">{name}</h1>}
          {!name && <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">Suas finanças</h1>}
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      {/* Hero */}
      <section className="hero-orange relative overflow-hidden rounded-3xl p-5 text-white sm:p-6">
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute -top-10 -right-10 size-56 opacity-20" aria-hidden>
          <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="4" />
          {[0, 72, 144, 216, 288].map((deg) => (
            <line key={deg} x1="50" y1="50" x2="50" y2="8" stroke="white" strokeWidth="3" transform={`rotate(${deg} 50 50)`} />
          ))}
        </svg>
        <p className="relative text-sm font-semibold text-white/95">Saldo em contas</p>
        <Money fit cents={stats.balance} className="relative mt-1 py-0.5 font-display text-[2.4rem] leading-none font-bold tracking-tight sm:text-[2.9rem]" />
        {stats.forecast !== null && (
          <p className="relative mt-2 text-sm text-white/95">
            Previsto para o fim de {monthLabel(month, false).toLowerCase()}: <Money cents={stats.forecast} className="font-semibold" />
          </p>
        )}
        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="min-w-0 rounded-2xl bg-white/16 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-white/95">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/25">
                <ArrowUpRight size={14} strokeWidth={2.6} />
              </span>
              Receitas
            </p>
            <Money fit cents={stats.summary.income} className="mt-1 text-lg font-bold" />
          </div>
          <div className="min-w-0 rounded-2xl bg-white/16 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-white/95">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/25">
                <ArrowDownRight size={14} strokeWidth={2.6} />
              </span>
              Despesas
            </p>
            <Money fit cents={stats.summary.expense} className="mt-1 text-lg font-bold" />
          </div>
        </div>
      </section>

      {transactions.length === 0 && (
        <Card>
          <EmptyState
            title="Vamos começar?"
            text="Registre sua primeira receita ou despesa. Tudo fica salvo neste dispositivo."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => openTransaction()}>
                  <Plus size={18} /> Novo lançamento
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await loadDemoData();
                    notify("Dados de exemplo carregados. Apague-os em Ajustes quando quiser começar.");
                  }}
                >
                  Explorar com dados de exemplo
                </Button>
              </div>
            }
          />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Spending by category */}
        <Card>
          <CardHeader title="Gastos por categoria" />
          {stats.byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhuma despesa em {monthLabel(month).toLowerCase()}.</p>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <Donut slices={slices}>
                <div className="w-[58%]">
                  <p className="text-xs text-muted">Total</p>
                  <Money fit cents={stats.summary.expense} className="text-sm font-bold" />
                </div>
              </Donut>
              <ul className="w-full min-w-0 flex-1 space-y-2">
                {topCategories.map((c) => {
                  const category = c.categoryId ? categoryById.get(c.categoryId) : undefined;
                  return (
                    <li key={c.categoryId ?? "none"} className="flex items-center gap-2.5">
                      <ColorIcon icon={categoryIcon(category?.icon)} color={category?.color ?? "#868E96"} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{category?.name ?? "Sem categoria"}</span>
                      <span className="text-xs text-muted tabular-nums">{Math.round(c.share * 100)}%</span>
                      <Money cents={c.total} className="shrink-0 text-right text-sm font-semibold" />
                    </li>
                  );
                })}
                {otherShare > 0 && (
                  <li className="flex items-center gap-2.5 pl-[2.6rem] text-sm text-muted">
                    <span className="flex-1">Outras categorias</span>
                    <Money cents={otherShare} className="shrink-0 text-right font-semibold" />
                  </li>
                )}
              </ul>
            </div>
          )}
        </Card>

        {/* Upcoming bills */}
        <Card>
          <CardHeader
            title="Contas a pagar"
            action={
              stats.summary.pendingExpense > 0 && (
                <span className="text-sm text-muted">
                  Pendente: <Money cents={stats.summary.pendingExpense} className="font-semibold text-ink" />
                </span>
              )
            }
          />
          {stats.bills.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nada pendente até o fim do mês. 🎉</p>
          ) : (
            <ul className="divide-y divide-line">
              {stats.bills.map((bill) => {
                const category = bill.categoryId ? categoryById.get(bill.categoryId) : undefined;
                const overdue = bill.date < todayISO();
                const dueToday = bill.date === todayISO();
                return (
                  <li key={bill.id} className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => openTransaction({ id: bill.id })}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <ColorIcon icon={categoryIcon(category?.icon)} color={category?.color ?? "#868E96"} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{bill.description || category?.name}</span>
                        <span className={`text-xs font-semibold ${overdue ? "text-negative" : dueToday ? "text-brand-ink" : "text-muted"}`}>
                          {overdue ? `Atrasada · ${shortDate(bill.date)}` : dueToday ? "Vence hoje" : `Vence ${shortDate(bill.date)}`}
                        </span>
                      </span>
                      <Money cents={bill.amount} className="text-sm font-semibold" />
                    </button>
                    <button
                      type="button"
                      title="Marcar como pago"
                      aria-label={`Marcar ${bill.description || category?.name} como pago`}
                      onClick={async () => {
                        await setPaid(bill.id, true);
                        notify("Marcado como pago.", { label: "Desfazer", run: () => void setPaid(bill.id, false) });
                      }}
                      className="grid size-8 place-items-center rounded-full border-2 border-line text-transparent transition-colors hover:border-positive hover:text-positive"
                    >
                      <Check size={15} strokeWidth={3} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Budgets */}
        <Card>
          <CardHeader
            title="Orçamentos"
            action={
              <button type="button" onClick={() => navigate("orcamentos")} className="text-sm font-semibold text-brand-ink hover:underline">
                Ver todos
              </button>
            }
          />
          {stats.budgets.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted">Defina limites mensais para as categorias e acompanhe os gastos.</p>
              <Button variant="secondary" className="mt-3" onClick={() => navigate("orcamentos")}>
                Criar orçamento
              </Button>
            </div>
          ) : (
            <ul className="space-y-3.5">
              {stats.budgets.map(({ budget, spent, ratio, status }) => {
                const category = categoryById.get(budget.categoryId);
                return (
                  <li key={budget.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{category?.name}</span>
                      <span className="shrink-0 text-muted">
                        <Money cents={spent} className="font-semibold text-ink" /> de <Money cents={budget.amount} />
                      </span>
                    </div>
                    <ProgressBar ratio={ratio} tone={status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* History */}
        <Card>
          <CardHeader
            title="Últimos 6 meses"
            action={
              <span className="flex items-center gap-3 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-positive" /> Receitas
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-orange" /> Despesas
                </span>
              </span>
            }
          />
          <div className="flex h-40 items-end gap-2 sm:gap-3">
            {stats.history.map((h) => (
              <button
                key={h.month}
                type="button"
                onClick={() => setMonth(h.month)}
                title={monthLabel(h.month)}
                className={`group flex h-full flex-1 flex-col items-center justify-end gap-1.5 rounded-lg pt-1 ${h.month === month ? "bg-orange-soft/50" : ""}`}
              >
                <span className="flex h-full w-full items-end justify-center gap-1">
                  <span className="w-2.5 rounded-t-md bg-positive sm:w-3.5" style={{ height: `${(h.income / historyMax) * 100}%` }} />
                  <span className="w-2.5 rounded-t-md bg-orange sm:w-3.5" style={{ height: `${(h.expense / historyMax) * 100}%` }} />
                </span>
                <span className={`text-xs ${h.month === month ? "font-bold text-ink" : "text-muted"}`}>{shortMonthLabel(h.month)}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {stats.cards.length > 0 && (
        <Card>
          <CardHeader title="Cartões de crédito" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {stats.cards.map(({ account, owed }) => (
              <li key={account.id} className="flex items-center gap-3 rounded-xl bg-cream px-3 py-3 [&>div]:min-w-0">
                <ColorIcon icon={CreditCard} color={account.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{account.name}</p>
                  <p className="text-sm text-muted">
                    Fatura: <Money cents={Math.max(0, owed)} className="font-semibold text-ink" />
                  </p>
                </div>
                {owed > 0 && (
                  <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => openTransaction({ type: "transfer", toAccountId: account.id, amount: owed })}>
                    Pagar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Últimos lançamentos"
          action={
            <button type="button" onClick={() => navigate("lancamentos")} className="text-sm font-semibold text-brand-ink hover:underline">
              Ver todos
            </button>
          }
        />
        {stats.recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Seus lançamentos aparecerão aqui.</p>
        ) : (
          <div className="-mx-2">
            {stats.recent.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showDate={shortDate(tx.date)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
