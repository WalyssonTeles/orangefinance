import { Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { TxType } from "../lib/db";
import { addDays, isISODate, todayISO } from "../lib/dates";
import { isCredit } from "../lib/finance";
import { cardCycle } from "../lib/invoices";
import { transactionRepeat, validateRepeat, type Repeat } from "../lib/recurrence";
import {
  createTransaction,
  changeRecurrence,
  deleteTransaction,
  restoreTransactions,
  updateTransaction,
  type SeriesScope,
  type TransactionDraft,
} from "../lib/repo";
import { useApp, type TransactionRequest } from "../state";
import { useSync } from "../sync-context";
import { categoryIcon, ColorIcon } from "./icons";
import { Modal } from "./Modal";
import { MoneyInput } from "./MoneyInput";
import { Select } from "./Select";
import { Button, DatePicker, Field, inputClass, Segmented, Switch } from "./ui";
import { DescriptionInput } from "./DescriptionInput";
import { RecurrenceFields } from "./RecurrenceFields";

const TYPE_OPTIONS: { value: TxType; label: string; activeClass: string }[] = [
  { value: "expense", label: "Despesa", activeClass: "bg-surface text-negative shadow-sm" },
  { value: "income", label: "Receita", activeClass: "bg-surface text-positive shadow-sm" },
  { value: "transfer", label: "Transferência", activeClass: "bg-surface text-ink shadow-sm" },
];

export function TransactionForm({ request, onClose }: { request: TransactionRequest; onClose: () => void }) {
  const { data, notify, sharedSpace, members, memberById, currentUserId } = useApp();
  const { activeSpace, bound } = useSync();
  const existing = request.id ? data.transactions.find((t) => t.id === request.id) : undefined;
  const moneyAccounts = data.accounts.filter((a) => !isCredit(a));

  const [type, setType] = useState<TxType>(existing?.type ?? request.type ?? "expense");
  const [amount, setAmount] = useState(existing?.amount ?? request.amount ?? 0);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? request.categoryId ?? null);
  const [accountId, setAccountId] = useState(
    existing?.accountId ?? request.accountId ?? moneyAccounts[0]?.id ?? data.accounts[0]?.id ?? "",
  );
  const [toAccountId, setToAccountId] = useState(
    existing?.toAccountId ?? request.toAccountId ?? data.accounts.find((a) => a.id !== accountId)?.id ?? "",
  );
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [paid, setPaidState] = useState(existing?.paid ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const remaining = existing?.groupId ? data.transactions.filter((tx) => tx.groupId === existing.groupId &&
    (tx.installment != null && existing.installment != null ? tx.installment >= existing.installment : tx.date >= existing.date)).length : undefined;
  const originalRepeat = transactionRepeat(existing, remaining);
  const [repeat, setRepeat] = useState<Repeat>(originalRepeat);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [holderId, setHolderId] = useState<string>(existing ? existing.holderId ?? "" : currentUserId ?? "");
  const [pendingDraft, setPendingDraft] = useState<TransactionDraft | null>(null);
  const recurrenceChanged = repeat.mode !== originalRepeat.mode || repeat.mode !== "none" && (
    repeat.count !== originalRepeat.count || repeat.mode === "recurring" && (
      repeat.frequency !== originalRepeat.frequency || repeat.frequency === "custom" && repeat.intervalDays !== originalRepeat.intervalDays));
  const credit = type === "expense" && data.accountById.get(accountId)?.type === "credit";
  const dateLabel = credit ? "Data da compra" : type === "income" ? paid ? "Data do recebimento" : "Data prevista de recebimento" : paid ? "Data do pagamento" : "Data de vencimento";
  const managedCredit = credit && (!existing || !!existing.invoiceKey || existing.accountId !== accountId || existing.date !== date || recurrenceChanged);
  const selectedAccount = data.accountById.get(accountId);
  const cycleHint = (() => {
    if (!credit || !selectedAccount || !isISODate(date)) return "";
    if (existing?.invoiceKey && date === existing.date && accountId === existing.accountId) return `Vencimento da fatura: ${existing.invoiceDueDate?.split("-").reverse().join("/")}.`;
    try { return `Vencimento da fatura: ${cardCycle(selectedAccount, date).invoiceDueDate.split("-").reverse().join("/")}. Compras no fechamento entram na próxima fatura.`; }
    catch (error) { return error instanceof Error ? error.message : "Configure as datas do cartão em Contas."; }
  })();

  const categories = useMemo(
    () => data.categories.filter((c) => c.kind === (type === "income" ? "income" : "expense")),
    [data.categories, type],
  );

  const changeType = (next: TxType) => {
    setType(next);
    if (next === "transfer") setRepeat((previous) => ({ ...previous, mode: "none" }));
    const category = categoryId ? data.categoryById.get(categoryId) : undefined;
    if (category && category.kind !== next) setCategoryId(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (amount <= 0) return notify("Informe um valor maior que zero.");
    if (!data.accountById.has(accountId)) return notify("Escolha uma conta.");
    if (type === "transfer") {
      if (!data.accountById.has(toAccountId)) return notify("Escolha a conta de destino.");
      if (toAccountId === accountId) return notify("As contas de origem e destino precisam ser diferentes.");
    } else if (!categoryId) {
      return notify("Escolha uma categoria.");
    }
    if (!isISODate(date)) return notify("Informe uma data válida para o lançamento.");
    if (type !== "transfer") {
      try { validateRepeat(repeat); }
      catch (error) { return notify(error instanceof Error ? error.message : "Confira os dados da repetição."); }
    }
    const draft: TransactionDraft = {
      type,
      amount,
      description: description.trim(),
      date,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : null,
      categoryId: type === "transfer" ? null : categoryId,
      paid,
      notes: notes.trim(),
      ...(sharedSpace || existing?.holderId ? { holderId: sharedSpace ? holderId || null : existing?.holderId ?? null } : {}),
    };
    if (existing?.groupId) return setPendingDraft(draft);
    await save(draft, "one");
  };

  const save = async (draft: TransactionDraft, scope: SeriesScope) => {
    if (busy) return;
    setBusy(true);
    try {
    if (existing && recurrenceChanged) {
      const ids = await changeRecurrence(existing.id, draft, repeat);
      notify(`Repetição atualizada: ${ids.length} lançamento(s).`);
    } else if (existing) {
      const ids = await updateTransaction(existing.id, draft, scope);
      notify(ids.length > 1 ? `${ids.length} lançamentos atualizados.` : "Lançamento atualizado.");
    } else {
      const ids = await createTransaction(draft, type === "transfer" ? { mode: "none", count: 1 } : repeat);
      notify(ids.length > 1 ? `${ids.length} lançamentos criados.` : "Lançamento adicionado.");
    }
    onClose();
    } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível salvar o lançamento."); setPendingDraft(null); }
    finally { setBusy(false); }
  };

  const remove = async (scope: "one" | "following") => {
    if (!existing) return;
    try {
    const ids = await deleteTransaction(existing.id, scope);
    onClose();
    notify(ids.length > 1 ? `${ids.length} lançamentos excluídos.` : "Lançamento excluído.", {
      label: "Desfazer",
      run: () => void restoreTransactions(ids).catch((error: unknown) => notify(error instanceof Error ? error.message : "Não foi possível restaurar.")),
    });
    } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível excluir."); setConfirmDelete(false); }
  };

  const paidLabel = type === "income" ? "Recebido" : type === "transfer" ? "Transferência realizada" : "Pago";
  const target = data.accountById.get(toAccountId);
  const title = existing ? "Editar lançamento" : type === "transfer" && target && isCredit(target) ? "Pagar fatura" : "Novo lançamento";

  const footer = pendingDraft ? (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-sm font-semibold">Aplicar alterações em:</span>
      <Button variant="ghost" onClick={() => setPendingDraft(null)}>
        Voltar
      </Button>
      <Button variant="secondary" disabled={busy || recurrenceChanged} onClick={() => void save(pendingDraft, "one")}>
        Só este
      </Button>
      <Button disabled={busy} onClick={() => void save(pendingDraft, "following")}>Este e os próximos</Button>
    </div>
  ) : confirmDelete ? (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-sm font-semibold">Excluir lançamento?</span>
      <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
        Cancelar
      </Button>
      {existing?.groupId ? (
        <>
          <Button variant="danger" onClick={() => remove("one")}>
            Só este
          </Button>
          <Button variant="danger" onClick={() => remove("following")}>
            Este e os próximos
          </Button>
        </>
      ) : (
        <Button variant="danger" onClick={() => remove("one")}>
          Excluir
        </Button>
      )}
    </div>
  ) : (
    <>
      {existing && (
        <Button variant="danger" className="px-3" onClick={() => setConfirmDelete(true)} aria-label="Excluir">
          <Trash2 size={18} />
        </Button>
      )}
      <Button variant="ghost" className="ml-auto" disabled={busy} onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form="transaction-form" disabled={busy}>
        {busy ? "Salvando…" : "Salvar"}
      </Button>
    </>
  );

  return (
    <Modal open title={title} onClose={() => { if (!busy) onClose(); }} footer={footer}>
      <form id="transaction-form" noValidate onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
        <Segmented label="Tipo de lançamento" value={type} options={TYPE_OPTIONS} onChange={changeType} />

        <MoneyInput
          label="Valor"
          value={amount}
          onChange={(v) => {
            setAmount(v);
          }}
          large
          autoFocus={!existing}
          tone={type === "income" ? "text-positive" : type === "expense" ? "text-negative" : "text-ink"}
        />

        <Field label="Descrição">
          <DescriptionInput
            value={description}
            placeholder={type === "transfer" ? "Ex.: Pagamento da fatura" : "Ex.: Almoço, conta de luz…"}
            onChange={setDescription}
          />
        </Field>

        {type !== "transfer" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-muted">Categoria</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {categories.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategoryId(c.id);
                    }}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-xs font-semibold transition-colors ${
                      active ? "border-orange bg-orange-soft/60" : "border-transparent hover:bg-cream"
                    }`}
                  >
                    <ColorIcon icon={categoryIcon(c.icon)} color={c.color} size="sm" />
                    <span className="w-full truncate text-center">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === "transfer" ? "De" : "Conta ou cartão"}>
            <Select label={type === "transfer" ? "De" : "Conta ou cartão"} value={accountId} onChange={setAccountId}
              options={data.accounts.map((a) => ({ value: a.id, label: `${a.name}${sharedSpace && a.holderId ? ` · ${memberById.get(a.holderId)?.name ?? "Ex-participante"}` : ""}` }))} />
          </Field>
          {type === "transfer" ? (
            <Field label="Para">
              <Select label="Para" value={toAccountId} onChange={setToAccountId}
                options={data.accounts.map((a) => ({ value: a.id, label: `${a.name}${sharedSpace && a.holderId ? ` · ${memberById.get(a.holderId)?.name ?? "Ex-participante"}` : ""}` }))} />
            </Field>
          ) : (
            <Field label={dateLabel}>
              <DatePicker label={dateLabel} required value={date} onChange={setDate} />
            </Field>
          )}
        </div>

        {type === "transfer" && (
          <Field label="Data">
            <DatePicker label="Data" required value={date} onChange={setDate} />
          </Field>
        )}

        <div className="flex gap-2">
          {[
            { label: "Hoje", value: todayISO() },
            { label: "Ontem", value: addDays(todayISO(), -1) },
          ].map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => setDate(quick.value)}
              className={`h-8 rounded-lg px-3 text-sm font-semibold ${
                date === quick.value ? "bg-ink text-white" : "bg-ink/5 text-muted hover:text-ink"
              }`}
            >
              {quick.label}
            </button>
          ))}
        </div>

        {managedCredit ? <p role="status" className="rounded-xl bg-cream p-3 text-sm text-muted">{cycleHint} O status é controlado pelo pagamento da fatura em Contas.</p>
          : <Switch label={paidLabel} checked={paid} onChange={setPaidState} />}
        {credit && !managedCredit && <p className="text-xs text-muted">Lançamento anterior à versão 1.2: mantemos o status original. Alterar a data, a conta ou a repetição vinculará a compra a uma fatura.</p>}

        {type !== "transfer" && <RecurrenceFields value={repeat} onChange={setRepeat} date={date} />}

        {existing?.groupId && (
          <p className="rounded-xl bg-cream px-3 py-2 text-sm text-muted">
            Este lançamento faz parte de uma série. Ao salvar, escolha se as alterações valem só para ele ou também para os
            próximos. Mudar a repetição substitui este e os próximos, mantendo o histórico anterior. Alterações comuns preservam o status dos próximos e a frequência original.
          </p>
        )}

        {sharedSpace && (
          <Field label="Titular" hint="A quem pertence esta receita ou despesa. Usado nos relatórios por pessoa.">
            <Select label="Titular" value={holderId} onChange={setHolderId} options={[
              { value: "", label: "Sem titular (da família)" },
              ...members.map((m) => ({ value: m.userId, label: `${m.name}${m.userId === currentUserId ? " (você)" : ""}` })),
              ...(holderId && !memberById.has(holderId) ? [{ value: holderId, label: "Ex-participante" }] : []),
            ]} />
          </Field>
        )}

        {bound && activeSpace && (
          <p className="text-xs text-muted">
            Espaço: <strong>{activeSpace.kind === "personal" ? "Pessoal" : activeSpace.name}</strong>
          </p>
        )}

        <Field label="Observações">
          <textarea
            className={`${inputClass} h-auto min-h-20 resize-y py-2.5`}
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        </fieldset>
      </form>
    </Modal>
  );
}
