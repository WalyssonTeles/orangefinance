import { describe, expect, it } from "vitest";
import type { Account, Budget, Transaction } from "./db";
import { addMonths, lastDayOfMonth, shiftMonth } from "./dates";
import {
  accountBalances,
  budgetProgress,
  monthlyHistory,
  monthSummary,
  splitInstallments,
  totalBalance,
  totalsByCategory,
  upcomingBills,
} from "./finance";
import { digitsToCents, formatBRL } from "./money";

const base = { createdAt: 1, updatedAt: 1, deletedAt: null };

const account = (id: string, type: Account["type"] = "checking", initialBalance = 0): Account => ({
  ...base,
  id,
  name: id,
  type,
  color: "#000",
  initialBalance,
  creditLimit: null,
});

let seq = 0;
const tx = (partial: Partial<Transaction>): Transaction => ({
  ...base,
  id: `t${++seq}`,
  type: "expense",
  amount: 0,
  description: "",
  date: "2026-10-10",
  accountId: "bank",
  toAccountId: null,
  categoryId: "food",
  paid: true,
  notes: "",
  groupId: null,
  installment: null,
  installments: null,
  ...partial,
});

describe("money", () => {
  it("fills cents from the right like banking apps", () => {
    expect(digitsToCents("1250")).toBe(1250);
    expect(digitsToCents("0,051")).toBe(51);
    expect(digitsToCents("1.234,56")).toBe(123456);
    expect(digitsToCents("")).toBe(0);
  });

  it("formats Brazilian currency", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});

describe("dates", () => {
  it("adds months clamping the day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("shifts months and finds last day", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  });
});

describe("finance", () => {
  const accounts = [account("bank", "checking", 100_00), account("wallet", "wallet"), account("card", "credit")];
  const transactions = [
    tx({ type: "income", amount: 5000_00, categoryId: "salary" }),
    tx({ amount: 300_00 }),
    tx({ amount: 200_00, accountId: "card" }),
    tx({ type: "transfer", amount: 150_00, accountId: "bank", toAccountId: "card", categoryId: null }),
    tx({ amount: 80_00, paid: false, date: "2026-10-25" }),
    tx({ amount: 999_00, date: "2026-11-01", paid: false }),
  ];

  it("computes paid balances, with credit cards as debt", () => {
    const balances = accountBalances(accounts, transactions);
    expect(balances.get("bank")).toBe(100_00 + 5000_00 - 300_00 - 150_00);
    expect(balances.get("card")).toBe(-200_00 + 150_00);
    expect(totalBalance(accounts, balances)).toBe(4650_00);
  });

  it("forecasts pending transactions until a date", () => {
    const forecast = accountBalances(accounts, transactions, { forecastUntil: "2026-10-31" });
    expect(forecast.get("bank")).toBe(4650_00 - 80_00);
  });

  it("summarizes the month ignoring transfers", () => {
    const summary = monthSummary(transactions, "2026-10");
    expect(summary).toEqual({ income: 5000_00, expense: 580_00, pendingIncome: 0, pendingExpense: 80_00, net: 4420_00 });
  });

  it("groups expenses by category", () => {
    const totals = totalsByCategory(transactions, "2026-10");
    expect(totals).toEqual([{ categoryId: "food", total: 580_00, share: 1 }]);
  });

  it("tracks budget progress and status", () => {
    const budgets: Budget[] = [{ ...base, id: "b", categoryId: "food", amount: 500_00 }];
    const [progress] = budgetProgress(budgets, transactions, "2026-10");
    expect(progress.spent).toBe(580_00);
    expect(progress.remaining).toBe(-80_00);
    expect(progress.status).toBe("over");
  });

  it("lists unpaid bills up to the end of the month", () => {
    expect(upcomingBills(transactions, "2026-10").map((t) => t.amount)).toEqual([80_00]);
  });

  it("builds the monthly history", () => {
    const history = monthlyHistory(transactions, "2026-11", 2);
    expect(history).toEqual([
      { month: "2026-10", income: 5000_00, expense: 580_00 },
      { month: "2026-11", income: 0, expense: 999_00 },
    ]);
  });

  it("splits installments without losing cents", () => {
    expect(splitInstallments(100_00, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(100_00, 3).reduce((a, b) => a + b)).toBe(100_00);
  });
});
