import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountForm } from "../components/forms";
import { ACCOUNT_TYPES, ColorIcon } from "../components/icons";
import { Money } from "../components/Money";
import { Button, Card, PageHeader, ProgressBar } from "../components/ui";
import type { Account } from "../lib/db";
import { lastDayOfMonth } from "../lib/dates";
import { accountBalances, budgetStatus, isCredit, totalBalance } from "../lib/finance";
import { useApp } from "../state";
import { reorderAccounts } from "../lib/repo";
import { InvoiceList } from "../components/InvoiceList";
import { SortableAccounts } from "../components/SortableAccounts";

export function Accounts() {
  const { data, month, openTransaction, sharedSpace, memberById, notify } = useApp();
  const holderName = (account: Account) => account.holderId ? memberById.get(account.holderId)?.name ?? "Ex-participante" : "Sem titular";
  const [editing, setEditing] = useState<Account | "new" | null>(null);

  const { balances, forecast, total, owed } = useMemo(() => {
    const balances = accountBalances(data.accounts, data.transactions);
    const forecast = accountBalances(data.accounts, data.transactions, { forecastUntil: lastDayOfMonth(month) });
    const owed = data.accounts.filter(isCredit).reduce((sum, a) => sum - (balances.get(a.id) ?? 0), 0);
    return { balances, forecast, total: totalBalance(data.accounts, balances), owed };
  }, [data.accounts, data.transactions, month]);

  const money = data.accounts.filter((a) => !isCredit(a));
  const cards = data.accounts.filter(isCredit);
  const saveOrder = async (ids: string[]) => {
    const group = new Set(ids);
    let index = 0;
    const ordered = data.accounts.map((account) => group.has(account.id) ? ids[index++] : account.id);
    try { await reorderAccounts(ordered); }
    catch (error) { notify(error instanceof Error ? error.message : "Não foi possível salvar a ordem das contas."); }
  };

  return (
    <div>
      <PageHeader
        title="Contas"
        subtitle="Contas bancárias, carteira, investimentos e cartões."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={18} /> Nova conta
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="hero-orange min-w-0 rounded-2xl px-5 py-4 text-white">
          <p className="text-sm font-semibold text-white/95">Saldo em contas</p>
          <Money fit cents={total} className="font-display text-3xl font-bold" />
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-muted">Saldo devedor em cartões</p>
          <Money fit cents={Math.max(0, owed)} className="font-display text-3xl font-bold" />
        </div>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Contas</h2>
      <p className="mb-3 text-xs text-muted">Segure um card para arrastar. Pelo teclado, use o botão de reordenar, Espaço e as setas.</p>
      <SortableAccounts accounts={money} onReorder={saveOrder} className="mb-6" render={(account) => {
          const { icon, label } = ACCOUNT_TYPES[account.type];
          const current = balances.get(account.id) ?? 0;
          const expected = forecast.get(account.id) ?? 0;
          return (
            <button key={account.id} type="button" onClick={() => setEditing(account)} className="text-left">
              <Card className="h-full transition-colors hover:border-orange">
                <div className="flex items-center gap-3">
                  <ColorIcon icon={icon} color={account.color} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{account.name}</p>
                    <p className="text-sm text-muted">{label}</p>
                    {sharedSpace && <p className="truncate text-sm text-muted">Titular: {holderName(account)}</p>}
                  </div>
                </div>
                <Money fit cents={current} className={`mt-4 font-display text-2xl font-bold ${current < 0 ? "text-negative" : ""}`} />
                {expected !== current && (
                  <p className="text-sm text-muted">
                    Previsto no fim do mês: <Money cents={expected} className="font-semibold" />
                  </p>
                )}
              </Card>
            </button>
          );
        }} />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Cartões de crédito</h2>
      </div>
      {cards.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Cadastre um cartão para registrar compras no crédito e acompanhar a fatura. Use{" "}
            <button type="button" className="font-semibold text-brand-ink hover:underline" onClick={() => setEditing("new")}>
              Nova conta
            </button>{" "}
            e escolha o tipo “Cartão de crédito”.
          </p>
        </Card>
      ) : (
        <SortableAccounts accounts={cards} onReorder={saveOrder} render={(card) => {
            const invoice = Math.max(0, -(balances.get(card.id) ?? 0));
            const legacyOwed = Math.max(0, -(accountBalances([card], data.transactions.filter((tx) => !tx.invoiceKey && !tx.invoicePaymentKey)).get(card.id) ?? 0));
            const limit = card.creditLimit ?? 0;
            const ratio = limit ? invoice / limit : 0;
            return (
              <Card key={card.id} className="flex flex-col">
                <button type="button" onClick={() => setEditing(card)} className="flex items-center gap-3 text-left">
                  <ColorIcon icon={ACCOUNT_TYPES.credit.icon} color={card.color} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{card.name}</p>
                    <p className="text-sm text-muted">Cartão de crédito</p>
                    {sharedSpace && <p className="truncate text-sm text-muted">Titular: {holderName(card)}</p>}
                  </div>
                </button>
                <p className="mt-4 text-sm text-muted">Saldo devedor total</p>
                <Money fit cents={invoice} className="font-display text-2xl font-bold" />
                {limit > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <ProgressBar ratio={ratio} tone={budgetStatus(ratio)} />
                    <p className="text-sm text-muted">
                      Disponível: <Money cents={Math.max(0, limit - invoice)} className="font-semibold text-ink" /> de <Money cents={limit} />
                    </p>
                  </div>
                )}
                {!card.closingDay || !card.dueDay ? <button type="button" onClick={() => setEditing(card)} className="mt-3 text-left text-sm font-semibold text-brand-ink hover:underline">Configurar fechamento e vencimento</button>
                  : <p className="mt-3 text-xs text-muted">Fecha dia {card.closingDay} · vence dia {card.dueDay}</p>}
                <InvoiceList account={card} />
                {legacyOwed > 0 && <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => openTransaction({ type: "transfer", toAccountId: card.id, amount: legacyOwed })}
                >
                  Pagar saldo anterior à 1.2
                </Button>}
              </Card>
            );
          }} />
      )}

      {editing && <AccountForm account={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
