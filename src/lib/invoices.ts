import type { Account, Transaction } from "./db";
import { lastDayOfMonth, monthOf, shiftMonth } from "./dates";

export function calendarDate(month: string, day: number): string {
  return `${month}-${String(Math.min(day, Number(lastDayOfMonth(month).slice(-2)))).padStart(2, "0")}`;
}

export function cardCycle(account: Account, date: string): { invoiceKey: string; invoiceDueDate: string } {
  if (!account.closingDay || !account.dueDay) {
    throw new Error(`Configure o fechamento e o vencimento do cartão ${account.name} em Contas.`);
  }
  let closingMonth = monthOf(date);
  if (date >= calendarDate(closingMonth, account.closingDay)) closingMonth = shiftMonth(closingMonth, 1);
  const closingDate = calendarDate(closingMonth, account.closingDay);
  let dueMonth = closingMonth;
  if (calendarDate(dueMonth, account.dueDay) <= closingDate) dueMonth = shiftMonth(dueMonth, 1);
  return { invoiceKey: `${account.id}:${closingMonth}`, invoiceDueDate: calendarDate(dueMonth, account.dueDay) };
}

export function invoicePayment(transactions: readonly Transaction[], key: string): Transaction | undefined {
  return transactions.find((tx) => tx.deletedAt === null && tx.type === "transfer" && tx.paid && tx.invoicePaymentKey === key);
}

export function effectiveTransactions(transactions: readonly Transaction[]): Transaction[] {
  const paid = new Set(transactions.filter((tx) => tx.deletedAt === null && tx.type === "transfer" && tx.paid && tx.invoicePaymentKey).map((tx) => tx.invoicePaymentKey));
  return transactions.map((tx) => tx.invoiceKey ? { ...tx, paid: paid.has(tx.invoiceKey) } : tx);
}

export function validateInvoices(accounts: readonly Account[], transactions: readonly Transaction[]): void {
  const active = transactions.filter((tx) => tx.deletedAt === null);
  const totals = new Map<string, number>();
  for (const tx of active) {
    if (!tx.invoiceKey) continue;
    const card = accounts.find((account) => account.id === tx.accountId && account.deletedAt === null && account.type === "credit");
    if (!card || tx.type !== "expense" || !tx.invoiceKey.startsWith(`${card.id}:`) || !tx.invoiceDueDate || tx.invoicePaymentKey) {
      throw new Error("Há uma compra com vínculo de fatura inválido. Nenhum dado foi substituído.");
    }
    totals.set(tx.invoiceKey, (totals.get(tx.invoiceKey) ?? 0) + tx.amount);
  }
  const payments = new Set<string>();
  for (const tx of active) {
    if (!tx.invoicePaymentKey) continue;
    const key = tx.invoicePaymentKey;
    const source = accounts.find((account) => account.id === tx.accountId);
    if (payments.has(key) || tx.id !== `invoice-payment:${key}` || tx.type !== "transfer" || !tx.paid ||
      !tx.toAccountId || !key.startsWith(`${tx.toAccountId}:`) || !source || source.type === "credit" || tx.amount !== totals.get(key)) {
      throw new Error("O pagamento e as compras de uma fatura divergiram. Reabra a fatura no aparelho que fez o pagamento e sincronize novamente.");
    }
    payments.add(key);
  }
}

export function cardInvoices(transactions: readonly Transaction[], accountId: string) {
  const invoices = new Map<string, { key: string; dueDate: string; amount: number; paid: boolean }>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.accountId !== accountId || tx.type !== "expense" || !tx.invoiceKey || !tx.invoiceDueDate) continue;
    const invoice = invoices.get(tx.invoiceKey) ?? { key: tx.invoiceKey, dueDate: tx.invoiceDueDate, amount: 0, paid: !!invoicePayment(transactions, tx.invoiceKey) };
    invoice.amount += tx.amount;
    invoices.set(tx.invoiceKey, invoice);
  }
  return [...invoices.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
