import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Transaction, TxType } from "../lib/db";
import { todayISO } from "../lib/dates";
import { FREQUENCIES } from "../lib/recurrence";
import { createBatch, undoBatch, type BatchEntry } from "../lib/repo";
import { useApp } from "../state";
import { DescriptionInput } from "./DescriptionInput";
import { Modal } from "./Modal";
import { MoneyInput } from "./MoneyInput";
import { Select } from "./Select";
import { Button, DatePicker, inputClass } from "./ui";

interface Row extends BatchEntry { key: string }

export function BatchTransactions({ onClose }: { onClose: () => void }) {
  const { data, sharedSpace, members, currentUserId } = useApp();
  const makeRow = (): Row => ({
    key: crypto.randomUUID(),
    draft: {
      type: "expense", amount: 0, description: "", accountId: data.accounts.find((account) => account.type !== "credit")?.id ?? "",
      toAccountId: null, categoryId: "", date: todayISO(), paid: false, notes: "", holderId: sharedSpace ? currentUserId : null,
    },
    repeat: { mode: "none", count: 2, frequency: "monthly", intervalDays: 14 },
  });
  const [rows, setRows] = useState<Row[]>(() => [makeRow()]);
  const [saved, setSaved] = useState<{ records: Transaction[]; rows: Row[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const patch = (key: string, changes: Partial<BatchEntry>) => setRows((previous) => previous.map((row) => row.key === key ? { ...row, ...changes } : row));
  const submit = async () => {
    if (busy || !desktop) return;
    setBusy(true);
    setError("");
    try {
      const records = await createBatch(rows);
      setSaved({ records, rows: structuredClone(rows) });
      setRows([]);
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar o lote."); }
    finally { setBusy(false); }
  };
  const undo = async () => {
    if (!saved || busy) return;
    if (rows.some((row) => row.draft.amount || row.draft.description) && !window.confirm("Recuperar a tabela do lote salvo substituirá as linhas ainda não salvas. Continuar?")) return;
    setBusy(true);
    setError("");
    try {
      await undoBatch(saved.records);
      setRows(saved.rows);
      setSaved(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível desfazer o lote."); }
    finally { setBusy(false); }
  };
  const close = () => {
    if (busy) return;
    if (rows.some((row) => row.draft.amount || row.draft.description) && !window.confirm("Sair sem salvar as linhas desta tabela?")) return;
    onClose();
  };
  return (
    <Modal open wide title="Lançamentos em lote" onClose={close} footer={<div className="flex w-full flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => setRows((previous) => [...previous, makeRow()])} disabled={busy || !desktop || rows.length >= 200}><Plus size={16} /> Nova linha</Button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" onClick={close} disabled={busy}>Fechar</Button>
        <Button disabled={busy || !desktop || rows.length === 0} onClick={() => void submit()}>{busy ? "Processando…" : "Salvar lançamentos"}</Button>
      </div>
    </div>}>
      {saved && <div role="status" className="my-3 flex items-center justify-between gap-4 rounded-xl bg-positive/10 p-3 text-sm font-semibold text-positive">
        <span>Lançamentos realizados com sucesso</span><button type="button" disabled={busy} className="shrink-0 underline" onClick={() => void undo()}>Desfazer lançamentos</button>
      </div>}
      {error && <p role="alert" className="my-3 rounded-xl bg-negative/10 p-3 text-sm font-semibold text-negative">{error}</p>}
      {!desktop ? <p className="py-8 text-muted">Amplie a janela para usar o lançamento em lote. Suas linhas foram mantidas.</p> : <>
        <p className="my-3 text-sm text-muted">Cada linha respeita sua própria data e categoria. A quantidade de ocorrências inclui a primeira. Nada é salvo se uma linha for inválida.</p>
        <fieldset disabled={busy} className="min-w-0">
        <div className="overflow-x-auto pb-3">
          <table className="w-full min-w-[2400px] border-separate border-spacing-2 text-left text-sm">
            <thead><tr>{["#", "Tipo de lançamento", "Valor", "Descrição", "Categoria", "Conta ou cartão", "Data", "Repetição", "Número de parcelas", "Ocorrências", "Frequência", ...(sharedSpace ? ["Titular"] : []), "Status", "Observações", ""].map((label, index) => <th key={index} className="px-1 text-muted">{label}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => {
              const { draft, repeat } = row;
              const account = data.accountById.get(draft.accountId);
              const credit = draft.type === "expense" && account?.type === "credit";
              const changeDraft = (changes: Partial<Row["draft"]>) => patch(row.key, { draft: { ...draft, ...changes } });
              const changeRepeat = (changes: Partial<Row["repeat"]>) => patch(row.key, { repeat: { ...repeat, ...changes } });
              const dateLabel = credit ? "Data da compra" : draft.type === "income" ? draft.paid ? "Data do recebimento" : "Recebimento previsto" : draft.paid ? "Data do pagamento" : "Data de vencimento";
              return <tr key={row.key} className="[&>td]:align-top">
                <td className="pt-3 text-muted">{index + 1}</td>
                <td className="min-w-40"><Select label={`Tipo da linha ${index + 1}`} value={draft.type} disabled={busy} onChange={(type) => {
                  if (type === "income" || type === "expense" || type === "transfer") {
                    patch(row.key, { draft: { ...draft, type: type satisfies TxType, categoryId: null }, ...(type === "transfer" ? { repeat: { ...repeat, mode: "none" } } : {}) });
                  }
                }} options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }, { value: "transfer", label: "Transferência" }]} /></td>
                <td className="min-w-40"><MoneyInput label={`Valor da linha ${index + 1}`} value={draft.amount} onChange={(amount) => changeDraft({ amount })} /></td>
                <td className="min-w-60"><DescriptionInput label={`Descrição da linha ${index + 1}`} value={draft.description} onChange={(description) => changeDraft({ description })} placeholder="Descrição"
                  additionalDescriptions={rows.filter((item) => item.key !== row.key).map((item) => item.draft.description)} /></td>
                <td className="min-w-44"><Select label={`Categoria da linha ${index + 1}`} value={draft.categoryId ?? ""} disabled={draft.type === "transfer" || busy} onChange={(categoryId) => changeDraft({ categoryId })}
                  options={[{ value: "", label: "Selecione" }, ...data.categories.filter((category) => category.kind === draft.type).map((category) => ({ value: category.id, label: category.name }))]} /></td>
                <td className="min-w-52"><Select label={`Conta da linha ${index + 1}`} value={draft.accountId} disabled={busy} onChange={(accountId) => changeDraft({ accountId })}
                  options={[{ value: "", label: "Selecione" }, ...data.accounts.map((item) => ({ value: item.id, label: item.name }))]} />
                {draft.type === "transfer" && <Select label={`Destino da linha ${index + 1}`} className="mt-1" value={draft.toAccountId ?? ""} disabled={busy} onChange={(toAccountId) => changeDraft({ toAccountId })}
                  options={[{ value: "", label: "Conta de destino" }, ...data.accounts.filter((item) => item.id !== draft.accountId).map((item) => ({ value: item.id, label: item.name }))]} />}</td>
                <td className="min-w-44"><DatePicker label={`${dateLabel} da linha ${index + 1}`} required value={draft.date} disabled={busy} onChange={(date) => changeDraft({ date })} /><span className="text-xs text-muted">{dateLabel}</span></td>
                <td className="min-w-40"><Select label={`Repetição da linha ${index + 1}`} value={repeat.mode} disabled={draft.type === "transfer" || busy} onChange={(mode) => {
                  if (mode === "none" || mode === "installments" || mode === "recurring") changeRepeat({ mode });
                }} options={[{ value: "none", label: "Única" }, { value: "installments", label: "Parcelada" }, { value: "recurring", label: "Recorrente" }]} /></td>
                <td className="min-w-40"><input aria-label={`Número de parcelas da linha ${index + 1}`} type="number" min={2} max={1200} className={`${inputClass} disabled:opacity-40`} disabled={repeat.mode !== "installments" || busy} value={repeat.mode === "installments" ? repeat.count || "" : ""} onChange={(event) => changeRepeat({ count: Number(event.target.value) })} /></td>
                <td className="min-w-28"><input aria-label={`Quantidade de ocorrências da linha ${index + 1}`} type="number" min={2} max={1200} className={`${inputClass} disabled:opacity-40`} disabled={repeat.mode !== "recurring" || busy} value={repeat.mode === "recurring" ? repeat.count || "" : ""} onChange={(event) => changeRepeat({ count: Number(event.target.value) })} /></td>
                <td className="min-w-64"><Select label={`Frequência da linha ${index + 1}`} value={repeat.frequency ?? "monthly"} disabled={repeat.mode !== "recurring" || busy} onChange={(value) => {
                  const frequency = FREQUENCIES.find((item) => item.value === value)?.value;
                  if (frequency) changeRepeat({ frequency });
                }} options={FREQUENCIES} />
                {repeat.mode === "recurring" && repeat.frequency === "custom" && <label className="mt-1 block text-xs text-muted">Intervalo em dias<input type="number" min={1} max={3650} className={inputClass} value={repeat.intervalDays || ""} onChange={(event) => changeRepeat({ intervalDays: Number(event.target.value) })} /></label>}</td>
                {sharedSpace && <td className="min-w-40"><Select label={`Titular da linha ${index + 1}`} value={draft.holderId ?? ""} disabled={busy} onChange={(holderId) => changeDraft({ holderId: holderId || null })}
                  options={[{ value: "", label: "Sem titular" }, ...members.map((member) => ({ value: member.userId, label: member.name }))]} /></td>}
                <td className="min-w-48"><Select label={`Status da linha ${index + 1}`} value={credit ? "invoice" : String(draft.paid)} disabled={credit || busy} onChange={(value) => changeDraft({ paid: value === "true" })}
                  options={credit ? [{ value: "invoice", label: "Vinculado à fatura" }] : [{ value: "false", label: "Pendente" }, { value: "true", label: draft.type === "income" ? "Recebido" : "Pago" }]} /></td>
                <td className="min-w-56"><input aria-label={`Observações da linha ${index + 1}`} className={inputClass} maxLength={500} value={draft.notes} disabled={busy} onChange={(event) => changeDraft({ notes: event.target.value })} /></td>
                <td><Button variant="danger" aria-label={`Remover linha ${index + 1}`} disabled={busy} onClick={() => setRows((previous) => previous.filter((item) => item.key !== row.key))}><Trash2 size={16} /></Button></td>
              </tr>;
            })}</tbody>
          </table>
          {rows.length === 0 && <p className="py-8 text-center text-muted">Tabela vazia. Adicione uma nova linha para começar.</p>}
        </div>
        </fieldset>
      </>}
    </Modal>
  );
}
