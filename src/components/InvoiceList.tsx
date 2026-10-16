import { useState } from "react";
import type { Account } from "../lib/db";
import { todayISO } from "../lib/dates";
import { cardInvoices } from "../lib/invoices";
import { payInvoice, reopenInvoice } from "../lib/repo";
import { useApp } from "../state";
import { Modal } from "./Modal";
import { Money } from "./Money";
import { Select } from "./Select";
import { Button, DatePicker, Field } from "./ui";

export function InvoiceList({ account }: { account: Account }) {
  const { data, notify } = useApp();
  const invoices = cardInvoices(data.transactions, account.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState(data.accounts.find((item) => item.type !== "credit")?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const invoice = invoices.find((item) => item.key === selected);
  const submit = async () => {
    if (!invoice || busy) return;
    setBusy(true);
    setError("");
    try {
      if (invoice.paid) await reopenInvoice(invoice.key);
      else await payInvoice(invoice.key, source, date);
      notify(invoice.paid ? "Fatura reaberta. O pagamento foi desfeito." : "Fatura paga. As compras vinculadas foram atualizadas.");
      setSelected(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível atualizar a fatura."); }
    finally { setBusy(false); }
  };
  return (
    <>
      {invoices.length > 0 && <details className="mt-3 border-t border-line pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand-ink">Faturas por vencimento ({invoices.length})</summary>
        <ul className="mt-2 max-h-64 space-y-2 overflow-auto">
          {invoices.map((item) => <li key={item.key} className="rounded-xl bg-cream p-3 text-sm">
            <p className="font-semibold">{item.dueDate.split("-").reverse().join("/")} · <Money cents={item.amount} /></p>
            <button type="button" className={`mt-1 font-semibold hover:underline ${item.paid ? "text-positive" : "text-brand-ink"}`} onClick={() => { setSelected(item.key); setError(""); }}>
              {item.paid ? "Paga · Reabrir fatura" : "Marcar fatura como paga"}
            </button>
          </li>)}
        </ul>
      </details>}
      {invoice && <Modal open title={invoice.paid ? "Reabrir fatura" : "Pagar fatura"} onClose={() => { if (!busy) setSelected(null); }}
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>Cancelar</Button><Button className="ml-auto" disabled={busy} onClick={() => void submit()}>{busy ? "Salvando…" : "Confirmar"}</Button></>}>
        <div className="space-y-4">
          <p>{account.name} · Vencimento {invoice.dueDate.split("-").reverse().join("/")} · <Money cents={invoice.amount} /></p>
          {invoice.paid ? <p className="text-sm text-muted">O pagamento sairá do saldo da conta e todas as compras desta fatura voltarão a ficar pendentes.</p> : <>
            <Field label="Conta de pagamento"><Select label="Conta de pagamento" value={source} onChange={setSource}
              options={[{ value: "", label: "Selecione" }, ...data.accounts.filter((item) => item.type !== "credit").map((item) => ({ value: item.id, label: item.name }))]} /></Field>
            <Field label="Data do pagamento"><DatePicker label="Data do pagamento" required value={date} onChange={setDate} /></Field>
            <p className="text-xs text-muted">Uma transferência quita esta fatura inteira. Nenhuma despesa adicional será criada.</p>
          </>}
          {error && <p role="alert" className="text-sm font-semibold text-negative">{error}</p>}
        </div>
      </Modal>}
    </>
  );
}
