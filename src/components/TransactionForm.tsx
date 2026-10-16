import { Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { TxType } from "../lib/db";
import { addDays, todayISO } from "../lib/dates";
import { isCredit, splitInstallments } from "../lib/finance";
import { formatBRL } from "../lib/money";
import {
  createTransaction,
  deleteTransaction,
  restoreTransactions,
  updateTransaction,
  type RepeatMode,
  type SeriesScope,
  type TransactionDraft,
} from "../lib/repo";
import { useApp, type TransactionRequest } from "../state";
import { useSync } from "../sync-context";
import { categoryIcon, ColorIcon } from "./icons";
import { Modal } from "./Modal";
import { MoneyInput } from "./MoneyInput";
import { Button, Field, inputClass, Segmented, Switch } from "./ui";

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
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [countText, setCountText] = useState("2");
  const count = Math.max(2, Math.min(120, Math.floor(Number(countText)) || 2));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [holderId, setHolderId] = useState<string>(existing ? existing.holderId ?? "" : currentUserId ?? "");
  const [pendingDraft, setPendingDraft] = useState<TransactionDraft | null>(null);

  const categories = useMemo(
    () => data.categories.filter((c) => c.kind === (type === "income" ? "income" : "expense")),
    [data.categories, type],
  );

  const changeType = (next: TxType) => {
    setType(next);
    setError("");
    const category = categoryId ? data.categoryById.get(categoryId) : undefined;
    if (category && category.kind !== next) setCategoryId(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return setError("Informe um valor maior que zero.");
    if (!data.accountById.has(accountId)) return setError("Escolha uma conta.");
    if (type === "transfer") {
      if (!data.accountById.has(toAccountId)) return setError("Escolha a conta de destino.");
      if (toAccountId === accountId) return setError("As contas de origem e destino precisam ser diferentes.");
    } else if (!categoryId) {
      return setError("Escolha uma categoria.");
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
    if (existing) {
      const ids = await updateTransaction(existing.id, draft, scope);
      notify(ids.length > 1 ? `${ids.length} lançamentos atualizados.` : "Lançamento atualizado.");
    } else {
      const ids = await createTransaction(draft, { mode: type === "transfer" ? "none" : repeat, count });
      notify(ids.length > 1 ? `${ids.length} lançamentos criados.` : "Lançamento adicionado.");
    }
    onClose();
  };

  const remove = async (scope: "one" | "following") => {
    if (!existing) return;
    const ids = await deleteTransaction(existing.id, scope);
    onClose();
    notify(ids.length > 1 ? `${ids.length} lançamentos excluídos.` : "Lançamento excluído.", {
      label: "Desfazer",
      run: () => void restoreTransactions(ids),
    });
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
      <Button variant="secondary" onClick={() => void save(pendingDraft, "one")}>
        Só este
      </Button>
      <Button onClick={() => void save(pendingDraft, "following")}>Este e os próximos</Button>
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
      <Button variant="ghost" className="ml-auto" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form="transaction-form">
        Salvar
      </Button>
    </>
  );

  return (
    <Modal open title={title} onClose={onClose} footer={footer}>
      <form id="transaction-form" onSubmit={submit} className="space-y-4">
        <Segmented label="Tipo de lançamento" value={type} options={TYPE_OPTIONS} onChange={changeType} />

        <MoneyInput
          label="Valor"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError("");
          }}
          large
          autoFocus={!existing}
          tone={type === "income" ? "text-positive" : type === "expense" ? "text-negative" : "text-ink"}
        />

        <Field label="Descrição">
          <input
            className={inputClass}
            value={description}
            maxLength={80}
            placeholder={type === "transfer" ? "Ex.: Pagamento da fatura" : "Ex.: Almoço, conta de luz…"}
            onChange={(e) => setDescription(e.target.value)}
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
                      setError("");
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
            <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{sharedSpace && a.holderId ? ` · ${memberById.get(a.holderId)?.name ?? "Ex-participante"}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {type === "transfer" ? (
            <Field label="Para">
              <select className={inputClass} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{sharedSpace && a.holderId ? ` · ${memberById.get(a.holderId)?.name ?? "Ex-participante"}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Data">
              <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          )}
        </div>

        {type === "transfer" && (
          <Field label="Data">
            <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
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

        <Switch label={paidLabel} checked={paid} onChange={setPaidState} />

        {!existing && type !== "transfer" && (
          <div className="space-y-3">
            <Segmented
              label="Repetição"
              value={repeat}
              onChange={setRepeat}
              options={[
                { value: "none", label: "Única" },
                { value: "installments", label: "Parcelada" },
                { value: "monthly", label: "Mensal" },
              ]}
            />
            {repeat !== "none" && (
              <Field
                label={repeat === "installments" ? "Número de parcelas" : "Repetir por quantos meses"}
                hint={
                  repeat === "installments"
                    ? `${count}x de aproximadamente ${formatBRL(splitInstallments(amount, count)[0])}. Apenas a primeira segue o status acima; as demais ficam pendentes.`
                    : `${count} lançamentos de ${formatBRL(amount)}, um por mês. Os próximos ficam pendentes.`
                }
              >
                <input
                  type="number"
                  min={2}
                  max={120}
                  className={inputClass}
                  value={countText}
                  onChange={(e) => setCountText(e.target.value)}
                  onBlur={() => setCountText(String(count))}
                />
              </Field>
            )}
          </div>
        )}

        {existing?.groupId && (
          <p className="rounded-xl bg-cream px-3 py-2 text-sm text-muted">
            Este lançamento faz parte de uma série. Ao salvar, escolha se as alterações valem só para ele ou também para os
            próximos. Nos próximos, o status de pago/pendente não muda e a nova data mantém a repetição mensal.
          </p>
        )}

        {sharedSpace && (
          <Field label="Titular" hint="A quem pertence esta receita ou despesa. Usado nos relatórios por pessoa.">
            <select className={inputClass} value={holderId} onChange={(e) => setHolderId(e.target.value)}>
              <option value="">Sem titular (da família)</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}{m.userId === currentUserId ? " (você)" : ""}
                </option>
              ))}
              {holderId && !memberById.has(holderId) && <option value={holderId}>Ex-participante</option>}
            </select>
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

        {error && (
          <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm font-semibold text-negative">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
