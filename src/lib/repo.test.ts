import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { FinanceDB } from "./db";
import {
  createTransaction,
  DEFAULT_CATEGORIES,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
  exportBackup,
  importBackup,
  parseBackup,
  restoreTransactions,
  seedDefaults,
} from "./repo";

let db: FinanceDB;
let n = 0;

beforeEach(async () => {
  db = new FinanceDB(`test-${++n}`);
  await seedDefaults(db);
});

const firstAccount = async () => (await db.accounts.toArray())[0];
const firstExpenseCategory = async () => (await db.categories.where("kind").equals("expense").toArray())[0];

async function draft(amount = 120_00) {
  return {
    type: "expense" as const,
    amount,
    description: "Geladeira",
    date: "2026-01-31",
    accountId: (await firstAccount()).id,
    toAccountId: null,
    categoryId: (await firstExpenseCategory()).id,
    paid: true,
    notes: "",
  };
}

describe("repository", () => {
  it("seeds defaults only once", async () => {
    await seedDefaults(db);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await db.accounts.count()).toBe(1);
  });

  it("creates installments month by month with the total preserved", async () => {
    const ids = await createTransaction(await draft(100_00), { mode: "installments", count: 3 }, db);
    const items = await db.transactions.bulkGet(ids);
    expect(items.map((t) => t!.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(items.map((t) => t!.amount)).toEqual([3334, 3333, 3333]);
    expect(items.map((t) => t!.paid)).toEqual([true, false, false]);
    expect(items.map((t) => `${t!.installment}/${t!.installments}`)).toEqual(["1/3", "2/3", "3/3"]);
    expect(new Set(items.map((t) => t!.groupId)).size).toBe(1);
  });

  it("soft-deletes the following items of a series and restores them", async () => {
    const ids = await createTransaction(await draft(), { mode: "monthly", count: 4 }, db);
    const removed = await deleteTransaction(ids[1], "following", db);
    expect([...removed].sort()).toEqual(ids.slice(1).sort());
    const alive = (await db.transactions.toArray()).filter((t) => t.deletedAt === null);
    expect(alive.map((t) => t.id)).toEqual([ids[0]]);
    await restoreTransactions(removed, db);
    expect((await db.transactions.toArray()).every((t) => t.deletedAt === null)).toBe(true);
  });

  it("refuses to delete accounts and categories in use", async () => {
    const d = await draft();
    await createTransaction(d, undefined, db);
    expect(await deleteAccount(d.accountId, db)).toBe(false);
    expect(await deleteCategory(d.categoryId, db)).toBe(false);
  });

  it("round-trips a backup", async () => {
    await createTransaction(await draft(), undefined, db);
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    const other = new FinanceDB(`test-${++n}`);
    await importBackup(backup, other);
    expect(await other.transactions.count()).toBe(1);
    expect(await other.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it("rejects files that are not Orange Finance backups", () => {
    expect(() => parseBackup("{}")).toThrow(/não é um backup/);
    expect(() => parseBackup("nope")).toThrow(/JSON válido/);
  });
});
