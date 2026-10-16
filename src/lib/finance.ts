import type { Account, Budget, Category, Transaction } from "./db";
import { lastDayOfMonth, monthOf, shiftMonth } from "./dates";

export function alive<T extends { deletedAt: number | null }>(items: readonly T[]): T[] {
  return items.filter((item) => item.deletedAt === null);
}

export const isCredit = (account: Pick<Account, "type">) => account.type === "credit";

export interface BalanceOptions {
  /** Include unpaid transactions up to this date (inclusive). */
  forecastUntil?: string;
}

/** Balance of every account: opening balance plus paid movements (and pending ones when forecasting). */
export function accountBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  options: BalanceOptions = {},
): Map<string, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.initialBalance]));
  const add = (id: string | null, delta: number) => {
    if (id && balances.has(id)) balances.set(id, balances.get(id)! + delta);
  };
  for (const tx of transactions) {
    const counts = !!tx.invoiceKey || tx.paid || (options.forecastUntil !== undefined && tx.date <= options.forecastUntil);
    if (!counts) continue;
    if (tx.type === "income") add(tx.accountId, tx.amount);
    else if (tx.type === "expense") add(tx.accountId, -tx.amount);
    else {
      add(tx.accountId, -tx.amount);
      add(tx.toAccountId, tx.amount);
    }
  }
  return balances;
}

/** Sum of the balances of money accounts (credit cards are debt, reported separately). */
export function totalBalance(accounts: readonly Account[], balances: Map<string, number>): number {
  return accounts.filter((a) => !isCredit(a)).reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
}

export function inMonth(tx: Pick<Transaction, "date">, month: string): boolean {
  return monthOf(tx.date) === month;
}

export interface MonthSummary {
  income: number;
  expense: number;
  pendingIncome: number;
  pendingExpense: number;
  net: number;
}

export function monthSummary(transactions: readonly Transaction[], month: string): MonthSummary {
  const summary: MonthSummary = { income: 0, expense: 0, pendingIncome: 0, pendingExpense: 0, net: 0 };
  for (const tx of transactions) {
    if (!inMonth(tx, month) || tx.type === "transfer") continue;
    if (tx.type === "income") {
      summary.income += tx.amount;
      if (!tx.paid) summary.pendingIncome += tx.amount;
    } else {
      summary.expense += tx.amount;
      if (!tx.paid) summary.pendingExpense += tx.amount;
    }
  }
  summary.net = summary.income - summary.expense;
  return summary;
}

export interface CategoryTotal {
  categoryId: string | null;
  total: number;
  share: number;
}

export function totalsByCategory(
  transactions: readonly Transaction[],
  month: string,
  type: "expense" | "income" = "expense",
): CategoryTotal[] {
  const totals = new Map<string | null, number>();
  let sum = 0;
  for (const tx of transactions) {
    if (tx.type !== type || !inMonth(tx, month)) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
    sum += tx.amount;
  }
  return [...totals.entries()]
    .map(([categoryId, total]) => ({ categoryId, total, share: sum ? total / sum : 0 }))
    .sort((a, b) => b.total - a.total);
}

export type BudgetStatus = "ok" | "warning" | "over";

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  ratio: number;
  status: BudgetStatus;
}

export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

export function budgetProgress(
  budgets: readonly Budget[],
  transactions: readonly Transaction[],
  month: string,
): BudgetProgress[] {
  const spentBy = new Map(totalsByCategory(transactions, month).map((t) => [t.categoryId, t.total]));
  return budgets
    .map((budget) => {
      const spent = spentBy.get(budget.categoryId) ?? 0;
      const ratio = budget.amount ? spent / budget.amount : spent > 0 ? Infinity : 0;
      return { budget, spent, remaining: budget.amount - spent, ratio, status: budgetStatus(ratio) };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export interface MonthTotals {
  month: string;
  income: number;
  expense: number;
}

export function monthlyHistory(transactions: readonly Transaction[], endMonth: string, count = 6): MonthTotals[] {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - count + 1));
  const byMonth = new Map(months.map((month) => [month, { month, income: 0, expense: 0 }]));
  for (const tx of transactions) {
    const entry = byMonth.get(monthOf(tx.date));
    if (!entry || tx.type === "transfer") continue;
    entry[tx.type] += tx.amount;
  }
  return months.map((m) => byMonth.get(m)!);
}

/** Unpaid expenses due until the end of `month`, overdue ones first. */
export function upcomingBills(transactions: readonly Transaction[], month: string, limit = 5): Transaction[] {
  const end = lastDayOfMonth(month);
  return transactions
    .filter((tx) => tx.type === "expense" && !tx.paid && (tx.invoiceDueDate ?? tx.date) <= end)
    .sort((a, b) => (a.invoiceDueDate ?? a.date).localeCompare(b.invoiceDueDate ?? b.date) || a.createdAt - b.createdAt)
    .slice(0, limit);
}

/** Splits a total into `count` installments; leftover cents go to the first ones. */
export function splitInstallments(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const rest = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

export function sortTransactions(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function groupByDate(transactions: readonly Transaction[], ascending = false): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  const sorted = sortTransactions(transactions);
  for (const tx of ascending ? sorted.reverse() : sorted) {
    const list = groups.get(tx.date);
    if (list) list.push(tx);
    else groups.set(tx.date, [tx]);
  }
  return [...groups.entries()];
}

export function matchesSearch(tx: Transaction, query: string, categories: Map<string, Category>): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  const category = tx.categoryId ? categories.get(tx.categoryId)?.name ?? "" : "";
  return normalize(`${tx.description} ${tx.notes} ${category}`).includes(q);
}

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function descriptionSuggestions(value: string, descriptions: readonly string[]): string[] {
  const query = normalize(value.trim());
  if (!query) return [];
  const used = new Set<string>();
  return descriptions.map((description) => description.trim()).filter((description) => {
    const normalized = normalize(description);
    if (normalized === query || !normalized.includes(query) || used.has(normalized)) return false;
    used.add(normalized);
    return true;
  });
}
