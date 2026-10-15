import { ArrowLeftRight, Check, Clock } from "lucide-react";
import type { Transaction } from "../lib/db";
import { todayISO } from "../lib/dates";
import { setPaid } from "../lib/repo";
import { useApp } from "../state";
import { categoryIcon, ColorIcon } from "./icons";
import { Money } from "./Money";

export function TransactionRow({ tx, showDate }: { tx: Transaction; showDate?: string }) {
  const { data, openTransaction, notify } = useApp();
  const category = tx.categoryId ? data.categoryById.get(tx.categoryId) : undefined;
  const account = data.accountById.get(tx.accountId);
  const target = tx.toAccountId ? data.accountById.get(tx.toAccountId) : undefined;
  const isTransfer = tx.type === "transfer";
  const overdue = !tx.paid && tx.date < todayISO();

  const title = tx.description || (isTransfer ? "Transferência" : category?.name ?? "Sem categoria");
  const details = isTransfer
    ? `${account?.name ?? "Conta removida"} → ${target?.name ?? "Conta removida"}`
    : [category?.name ?? "Sem categoria", account?.name].filter(Boolean).join(" · ");
  const series = tx.installments ? `${tx.installment}/${tx.installments}` : tx.groupId ? "Mensal" : null;

  const togglePaid = async () => {
    await setPaid(tx.id, !tx.paid);
    notify(tx.paid ? "Marcado como pendente." : tx.type === "income" ? "Marcado como recebido." : "Marcado como pago.");
  };

  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-cream">
      <button
        type="button"
        onClick={() => openTransaction({ id: tx.id })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Editar ${title}`}
      >
        {isTransfer ? (
          <ColorIcon icon={ArrowLeftRight} color="#70665E" />
        ) : (
          <ColorIcon icon={categoryIcon(category?.icon)} color={category?.color ?? "#868E96"} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <span className="truncate">{showDate ? `${showDate} · ${details}` : details}</span>
            {series && <span className="shrink-0 rounded-md bg-ink/6 px-1.5 text-xs font-semibold">{series}</span>}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Money
          cents={tx.type === "expense" ? -tx.amount : tx.amount}
          signed={!isTransfer}
          className={`font-semibold ${tx.type === "income" ? "text-positive" : isTransfer ? "text-muted" : "text-ink"}`}
        />
        <button
          type="button"
          onClick={togglePaid}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 text-xs font-semibold transition-colors ${
            tx.paid
              ? "text-muted hover:bg-ink/5"
              : overdue
                ? "bg-negative/10 text-negative hover:bg-negative/15"
                : "bg-orange-soft text-brand-ink hover:bg-orange-soft-hover"
          }`}
          title={tx.paid ? "Marcar como pendente" : tx.type === "income" ? "Marcar como recebido" : "Marcar como pago"}
        >
          {tx.paid ? <Check size={12} strokeWidth={3} /> : <Clock size={12} strokeWidth={2.5} />}
          {tx.paid ? (tx.type === "income" ? "Recebido" : isTransfer ? "Feita" : "Pago") : overdue ? "Atrasado" : "Pendente"}
        </button>
      </div>
    </div>
  );
}
