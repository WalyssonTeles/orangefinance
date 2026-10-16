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
  saveAccount,
  seedDefaults,
  updateTransaction,
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

  it("edits only one entry of a series by default", async () => {
    const ids = await createTransaction(await draft(), { mode: "monthly", count: 4 }, db);
    expect(await updateTransaction(ids[2], { amount: 150_00 }, "one", db)).toEqual([ids[2]]);
    const amounts = (await db.transactions.bulkGet(ids)).map((t) => t!.amount);
    expect(amounts).toEqual([120_00, 120_00, 150_00, 120_00]);
  });

  it("edits this and the following entries with every field except paid, keeping the monthly cadence", async () => {
    const ids = await createTransaction(await draft(), { mode: "monthly", count: 4 }, db);
    const other = (await db.categories.where("kind").equals("expense").toArray())[1];
    const changed = await updateTransaction(ids[1], {
      amount: 180_00, description: "Aluguel novo", categoryId: other.id, notes: "reajuste", date: "2026-02-15", paid: true,
    }, "following", db);
    expect([...changed].sort()).toEqual(ids.slice(1).sort());
    const items = (await db.transactions.bulkGet(ids)).map((t) => t!);
    expect(items.map((t) => t.amount)).toEqual([120_00, 180_00, 180_00, 180_00]);
    expect(items.map((t) => t.description)).toEqual(["Geladeira", "Aluguel novo", "Aluguel novo", "Aluguel novo"]);
    expect(items.map((t) => t.categoryId)).toEqual([items[0].categoryId, other.id, other.id, other.id]);
    expect(items.map((t) => t.date)).toEqual(["2026-01-31", "2026-02-15", "2026-03-15", "2026-04-15"]);
    expect(items.map((t) => t.paid)).toEqual([true, true, false, false]);
    expect(new Set(items.map((t) => t.groupId)).size).toBe(1);
  });

  it("does not touch deleted or previous entries when editing the following ones", async () => {
    const ids = await createTransaction(await draft(100_00), { mode: "installments", count: 4 }, db);
    await deleteTransaction(ids[3], "one", db);
    await updateTransaction(ids[1], { amount: 50_00 }, "following", db);
    const items = (await db.transactions.bulkGet(ids)).map((t) => t!);
    expect(items.map((t) => t.amount)).toEqual([2500, 50_00, 50_00, 2500]);
  });

  it("imports backups from version 0.1 that have no holder field", async () => {
    await createTransaction(await draft(), undefined, db);
    const legacy = JSON.parse(JSON.stringify(await exportBackup(db)));
    for (const tx of legacy.transactions) delete tx.holderId;
    const backup = parseBackup(JSON.stringify(legacy));
    expect(backup.transactions[0].holderId).toBeNull();
  });

  it("keeps fields unknown to this version when parsing backups", async () => {
    await createTransaction(await draft(), undefined, db);
    const future = JSON.parse(JSON.stringify(await exportBackup(db)));
    future.transactions[0].futureField = "preserved";
    expect((parseBackup(JSON.stringify(future)).transactions[0] as unknown as Record<string, unknown>).futureField).toBe("preserved");
  });

  it("imports pre-1.1 accounts without a holder and preserves every existing balance and transaction", async () => {
    await createTransaction(await draft(), undefined, db);
    const legacy = JSON.parse(JSON.stringify(await exportBackup(db)));
    for (const account of legacy.accounts) delete account.holderId;
    const parsed = parseBackup(JSON.stringify(legacy));
    expect(parsed.accounts.every((account) => account.holderId === null)).toBe(true);
    await importBackup(parsed, db);
    expect((await exportBackup(db)).transactions).toEqual(parsed.transactions);
    expect((await db.accounts.toArray()).map((account) => account.initialBalance)).toEqual(legacy.accounts.map((account: { initialBalance: number }) => account.initialBalance));
  });

  it("round-trips account holders without reassigning existing transactions", async () => {
    const [txId] = await createTransaction({ ...await draft(), holderId: "person-a" }, undefined, db);
    const account = await firstAccount();
    await saveAccount({ ...account, holderId: "person-b" }, db);
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    await importBackup(backup, db);
    expect((await db.accounts.get(account.id))?.holderId).toBe("person-b");
    expect((await db.transactions.get(txId))?.holderId).toBe("person-a");
  });
});
