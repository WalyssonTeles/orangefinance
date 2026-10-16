import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db as appDatabase, FinanceDB, type Transaction } from "./db";
import { accountBalances, groupByDate, monthSummary, upcomingBills } from "./finance";
import { loadDemoData } from "./demo";
import { cardCycle, cardInvoices, effectiveTransactions, validateInvoices } from "./invoices";
import { occurrenceDate, type Frequency } from "./recurrence";
import {
  changeRecurrence, createBatch, createTransaction, deleteTransaction, exportBackup, importBackup, parseBackup,
  payInvoice, reopenInvoice, reorderAccounts, saveAccount, seedDefaults, setPaid, undoBatch, updateTransaction, wipeAll,
} from "./repo";
import { mergeSyncData, parseSyncData, readSyncData, validateReferences } from "./sync-data";

const databases: FinanceDB[] = [];
let db: FinanceDB;
beforeEach(async () => {
  db = new FinanceDB(`v12-${crypto.randomUUID()}`);
  databases.push(db);
  await seedDefaults(db);
});
afterEach(async () => { await Promise.all(databases.splice(0).map((database) => database.delete())); });

async function draft(date = "2026-10-19", amount = 10000) {
  return {
    type: "expense" as const, amount, description: "Limpeza Thaline", date,
    accountId: (await db.accounts.toArray()).find((account) => account.type !== "credit")!.id,
    toAccountId: null, categoryId: (await db.categories.where("kind").equals("expense").first())!.id,
    paid: true, notes: "",
  };
}
async function card(closingDay = 20, dueDay = 28) {
  const id = await saveAccount({ name: "Cartão", type: "credit", color: "#FF8A1F", initialBalance: 0, creditLimit: 100000, closingDay, dueDay }, db);
  return (await db.accounts.get(id))!;
}
const records = async (ids: string[]) => (await db.transactions.bulkGet(ids)).filter((tx): tx is Transaction => !!tx);

describe("1.2 recurrence and editing", () => {
  it.each([
    ["daily", ["2026-10-19", "2026-10-20", "2026-10-21"]],
    ["weekly", ["2026-10-19", "2026-10-26", "2026-11-02"]],
    ["fortnightly", ["2026-10-19", "2026-11-02", "2026-11-16"]],
    ["monthly", ["2026-10-19", "2026-11-19", "2026-12-19"]],
    ["yearly", ["2026-10-19", "2027-10-19", "2028-10-19"]],
    ["custom", ["2026-10-19", "2026-10-22", "2026-10-25"]],
  ] satisfies [Frequency, string[]][])("creates %s occurrences including the first", async (frequency, dates) => {
    const ids = await createTransaction(await draft(), { mode: "recurring", count: 3, frequency, intervalDays: 3 }, db);
    const txs = await records(ids);
    expect(txs.map((tx) => tx.date)).toEqual(dates);
    expect(txs.map((tx) => tx.paid)).toEqual([true, false, false]);
    expect(txs.every((tx) => tx.amount === 10000)).toBe(true);
  });
  it("anchors monthly/yearly dates instead of accumulating month-end drift", () => {
    expect(occurrenceDate("2028-02-29", 4, { mode: "recurring", frequency: "yearly", count: 5 })).toBe("2032-02-29");
    expect(occurrenceDate("2026-01-31", 2, { mode: "recurring", frequency: "monthly", count: 3 })).toBe("2026-03-31");
  });
  it("turns a unique entry into installments, preserving the original ID and exact total", async () => {
    const original = await draft("2026-10-19", 10001);
    const [id] = await createTransaction(original, undefined, db);
    const createdAt = (await db.transactions.get(id))!.createdAt;
    const ids = await changeRecurrence(id, original, { mode: "installments", count: 3 }, db);
    expect(ids[0]).toBe(id);
    const txs = await records(ids);
    expect(txs.map((tx) => tx.amount)).toEqual([3334, 3334, 3333]);
    expect(txs.reduce((sum, tx) => sum + tx.amount, 0)).toBe(10001);
    expect(txs[0].createdAt).toBe(createdAt);
    expect(txs.map((tx) => tx.installments)).toEqual([3, 3, 3]);
  });
  it("turns a unique entry into fortnightly recurrence without duplicating the first", async () => {
    const original = await draft();
    const [id] = await createTransaction(original, undefined, db);
    const ids = await changeRecurrence(id, original, { mode: "recurring", count: 12, frequency: "fortnightly" }, db);
    expect(ids).toHaveLength(12);
    expect((await db.transactions.toArray()).filter((tx) => tx.deletedAt === null)).toHaveLength(12);
    expect((await records(ids))[1].date).toBe("2026-11-02");
  });
  it("edits weekly following entries without changing their cadence or payment statuses", async () => {
    const ids = await createTransaction(await draft(), { mode: "recurring", count: 4, frequency: "weekly" }, db);
    await updateTransaction(ids[1], { date: "2026-10-27", paid: true, description: "Nova descrição" }, "following", db);
    const txs = await records(ids);
    expect(txs.map((tx) => tx.date)).toEqual(["2026-10-19", "2026-10-27", "2026-11-03", "2026-11-10"]);
    expect(txs.map((tx) => tx.paid)).toEqual([true, true, false, false]);
  });
  it("changes recurrence from the middle, preserving earlier history", async () => {
    const original = await draft();
    const ids = await createTransaction(original, { mode: "recurring", count: 5, frequency: "weekly" }, db);
    const before = await db.transactions.get(ids[0]);
    const changed = await changeRecurrence(ids[2], { ...original, date: "2026-11-02" }, { mode: "recurring", count: 3, frequency: "fortnightly" }, db);
    expect(await db.transactions.get(ids[0])).toEqual(before);
    expect((await records(changed)).map((tx) => tx.date)).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
    expect((await db.transactions.get(ids[3]))!.deletedAt).not.toBeNull();
  });
  it("does not erase paid future occurrences", async () => {
    const original = await draft();
    const ids = await createTransaction(original, { mode: "monthly", count: 3 }, db);
    await setPaid(ids[1], true, db);
    const before = await exportBackup(db);
    await expect(changeRecurrence(ids[0], original, { mode: "none", count: 1 }, db)).rejects.toThrow(/futuras pagas/);
    expect((await exportBackup(db)).transactions).toEqual(before.transactions);
  });
  it("allows editing the last remaining occurrence without requiring new future entries", async () => {
    const ids = await createTransaction(await draft(), { mode: "recurring", count: 2, frequency: "weekly" }, db);
    const last = (await db.transactions.get(ids[1]))!;
    const changed = await changeRecurrence(last.id, last, { mode: "recurring", count: 1, frequency: "fortnightly" }, db);
    expect(changed).toEqual([last.id]);
    expect((await db.transactions.toArray()).filter((tx) => tx.deletedAt === null)).toHaveLength(2);
  });
  it.each([0, -1, 1.5, 1201, NaN])("rejects invalid repetition count %s without partial writes", async (count) => {
    await expect(createTransaction(await draft(), { mode: "recurring", count, frequency: "weekly" }, db)).rejects.toThrow(/ocorrências/);
    expect(await db.transactions.count()).toBe(0);
  });
  it("rejects invalid dates, custom intervals and zero-cent installments", async () => {
    await expect(createTransaction(await draft("2026-02-30"), undefined, db)).rejects.toThrow(/data/);
    await expect(createTransaction(await draft(), { mode: "recurring", count: 3, frequency: "custom", intervalDays: 0 }, db)).rejects.toThrow(/intervalo/);
    await expect(createTransaction(await draft(undefined, 1), { mode: "installments", count: 2 }, db)).rejects.toThrow(/centavo/);
  });
  it("ignores disabled custom-frequency fields after switching back to installments", async () => {
    const ids = await createTransaction(await draft(), { mode: "installments", count: 3, frequency: "custom", intervalDays: 0 }, db);
    expect((await records(ids)).map((tx) => tx.date)).toEqual(["2026-10-19", "2026-11-19", "2026-12-19"]);
    const backup = await exportBackup(db);
    expect(() => parseBackup(JSON.stringify(backup))).not.toThrow();
  });
});

describe("1.2 card cycles and a single source of payment status", () => {
  it("puts purchases on the closing day into the next invoice", async () => {
    const account = await card();
    expect(cardCycle(account, "2026-10-19")).toEqual({ invoiceKey: `${account.id}:2026-10`, invoiceDueDate: "2026-10-28" });
    expect(cardCycle(account, "2026-10-20")).toEqual({ invoiceKey: `${account.id}:2026-11`, invoiceDueDate: "2026-11-28" });
  });
  it("handles year boundaries and due dates earlier than closing", async () => {
    const account = await card(25, 5);
    expect(cardCycle(account, "2026-12-24").invoiceDueDate).toBe("2027-01-05");
    expect(cardCycle(account, "2026-12-25").invoiceDueDate).toBe("2027-02-05");
  });
  it("clamps closing/due days to short months", async () => {
    const account = await card(31, 10);
    expect(cardCycle(account, "2026-02-27").invoiceDueDate).toBe("2026-03-10");
    expect(cardCycle(account, "2026-02-28").invoiceDueDate).toBe("2026-04-10");
  });
  it("pays an invoice once, updates derived statuses and never double-counts expenses", async () => {
    const account = await card();
    const original = await draft();
    const ids = await createTransaction({ ...original, accountId: account.id }, undefined, db);
    const raw = (await records(ids))[0];
    expect(raw.paid).toBe(false);
    expect(accountBalances([account], [raw]).get(account.id)).toBe(-10000);
    await payInvoice(raw.invoiceKey!, original.accountId, "2026-10-28", db);
    await expect(payInvoice(raw.invoiceKey!, original.accountId, "2026-10-28", db)).rejects.toThrow(/já foi paga/);
    const txs = effectiveTransactions(await db.transactions.toArray());
    expect(txs.find((tx) => tx.id === raw.id)!.paid).toBe(true);
    expect((await db.transactions.get(raw.id))!.paid).toBe(false);
    expect(monthSummary(txs, "2026-10").expense).toBe(10000);
    const balances = accountBalances(await db.accounts.toArray(), txs);
    expect(balances.get(account.id)).toBe(0);
    expect(balances.get(original.accountId)).toBe(-10000);
    validateInvoices(await db.accounts.toArray(), txs);
    await reopenInvoice(raw.invoiceKey!, db);
    const reopened = effectiveTransactions(await db.transactions.toArray());
    expect(reopened.find((tx) => tx.id === raw.id)!.paid).toBe(false);
    expect(accountBalances(await db.accounts.toArray(), reopened.filter((tx) => tx.deletedAt === null)).get(original.accountId)).toBe(0);
  });
  it("refuses individual paid toggles and edits/deletions on paid invoices", async () => {
    const account = await card();
    const original = await draft();
    const [id] = await createTransaction({ ...original, accountId: account.id }, undefined, db);
    const tx = (await db.transactions.get(id))!;
    await expect(setPaid(id, true, db)).rejects.toThrow(/fatura/);
    await payInvoice(tx.invoiceKey!, original.accountId, "2026-10-28", db);
    await expect(updateTransaction(id, { amount: 20000 }, "one", db)).rejects.toThrow(/já foi paga/);
    await expect(deleteTransaction(id, "one", db)).rejects.toThrow(/já foi paga/);
    await expect(createTransaction({ ...original, accountId: account.id }, undefined, db)).rejects.toThrow(/já foi paga/);
  });
  it("keeps recorded cycles when card configuration changes and rebinds explicitly redated purchases", async () => {
    const account = await card();
    const [id] = await createTransaction({ ...await draft(), accountId: account.id }, undefined, db);
    const before = (await db.transactions.get(id))!;
    await saveAccount({ ...account, closingDay: 10, dueDay: 18 }, db);
    await updateTransaction(id, { description: "Ajustada" }, "one", db);
    expect((await db.transactions.get(id))!.invoiceKey).toBe(before.invoiceKey);
    await updateTransaction(id, { date: "2026-11-11" }, "one", db);
    expect((await db.transactions.get(id))!.invoiceKey).toBe(`${account.id}:2026-12`);
  });
  it("assigns each credit installment to its own invoice", async () => {
    const account = await card();
    const ids = await createTransaction({ ...await draft(), accountId: account.id }, { mode: "installments", count: 3 }, db);
    expect(cardInvoices(await records(ids), account.id).map((invoice) => invoice.dueDate)).toEqual(["2026-10-28", "2026-11-28", "2026-12-28"]);
  });
  it("uses invoice due dates for upcoming bills instead of purchase dates", async () => {
    const account = await card(25, 5);
    const ids = await createTransaction({ ...await draft(), accountId: account.id }, undefined, db);
    const txs = await records(ids);
    expect(upcomingBills(txs, "2026-10")).toHaveLength(0);
    expect(upcomingBills(txs, "2026-11")).toHaveLength(1);
  });
  it("preserves legacy card entries and requires dates for new purchases", async () => {
    const account = await card();
    await db.accounts.update(account.id, { closingDay: null, dueDay: null });
    const [id] = await createTransaction(await draft(), undefined, db);
    await db.transactions.update(id, { accountId: account.id, invoiceKey: null });
    await updateTransaction(id, { description: "Legado" }, "one", db);
    expect((await db.transactions.get(id))!.paid).toBe(true);
    await expect(createTransaction({ ...await draft(), accountId: account.id }, undefined, db)).rejects.toThrow(/Configure/);
  });
  it("detects an offline purchase merged into an already paid invoice", async () => {
    const account = await card();
    const original = await draft();
    const [id] = await createTransaction({ ...original, accountId: account.id }, undefined, db);
    const base = await readSyncData(db);
    await createTransaction({ ...original, accountId: account.id, amount: 5000 }, undefined, db);
    const offline = await readSyncData(db);
    await db.transactions.delete(offline.transactions.find((tx) => tx.id !== id)!.id);
    await payInvoice((await db.transactions.get(id))!.invoiceKey!, original.accountId, "2026-10-28", db);
    const merged = mergeSyncData(base, offline, await readSyncData(db));
    expect(() => validateReferences(merged.data)).toThrow(/divergiram/);
  });
  it("uses one deterministic payment ID when two devices independently pay the same invoice", async () => {
    const account = await card(), original = await draft();
    const [id] = await createTransaction({ ...original, accountId: account.id }, undefined, db);
    const key = (await db.transactions.get(id))!.invoiceKey!;
    const base = await readSyncData(db);
    await payInvoice(key, original.accountId, "2026-10-28", db);
    const left = await readSyncData(db);
    await reopenInvoice(key, db);
    await payInvoice(key, original.accountId, "2026-10-29", db);
    const merged = mergeSyncData(base, left, await readSyncData(db));
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.data.transactions.filter((tx) => tx.deletedAt === null && tx.invoicePaymentKey === key)).toHaveLength(1);
  });
});

describe("1.2 atomic batch, ordering and compatibility", () => {
  it("keeps the sample-data onboarding functional with real paid invoice cycles", async () => {
    await seedDefaults(appDatabase);
    try {
      await loadDemoData();
      const snapshot = await readSyncData(appDatabase);
      validateReferences(snapshot);
      expect(snapshot.transactions.some((tx) => tx.invoicePaymentKey)).toBe(true);
      expect(snapshot.transactions.some((tx) => tx.invoiceKey)).toBe(true);
    } finally { await appDatabase.delete(); }
  });
  it("saves mixed months/types with recurrence and undoes exactly that batch", async () => {
    const original = await draft("2026-04-01");
    const [existing] = await createTransaction(original, undefined, db);
    const incomeCategory = (await db.categories.where("kind").equals("income").first())!.id;
    const saved = await createBatch([
      { draft: { ...original, type: "income", categoryId: incomeCategory }, repeat: { mode: "none", count: 1 } },
      { draft: { ...original, date: "2026-02-02" }, repeat: { mode: "recurring", count: 3, frequency: "weekly" } },
    ], db);
    expect(saved.map((tx) => tx.date).sort()).toEqual(["2026-02-02", "2026-02-09", "2026-02-16", "2026-04-01"]);
    await undoBatch(saved, db);
    expect((await db.transactions.toArray()).filter((tx) => tx.deletedAt === null).map((tx) => tx.id)).toEqual([existing]);
  });
  it("rolls back all lines when any line fails", async () => {
    const original = await draft();
    await expect(createBatch([
      { draft: original, repeat: { mode: "none", count: 1 } },
      { draft: { ...original, categoryId: "missing" }, repeat: { mode: "none", count: 1 } },
    ], db)).rejects.toThrow(/Linha 2/);
    expect(await db.transactions.count()).toBe(0);
  });
  it("does not undo a batch changed after saving", async () => {
    const saved = await createBatch([{ draft: await draft(), repeat: { mode: "none", count: 1 } }], db);
    await updateTransaction(saved[0].id, { notes: "Editado depois" }, "one", db);
    await expect(undoBatch(saved, db)).rejects.toThrow(/alterado/);
    expect((await db.transactions.get(saved[0].id))!.deletedAt).toBeNull();
  });
  it("does not undo a batch whose invoice was paid later", async () => {
    const account = await card(), original = await draft();
    const saved = await createBatch([{ draft: { ...original, accountId: account.id }, repeat: { mode: "none", count: 1 } }], db);
    await payInvoice(saved[0].invoiceKey!, original.accountId, "2026-10-28", db);
    await expect(undoBatch(saved, db)).rejects.toThrow(/já foi paga/);
  });
  it("persists and round-trips account order without changing balances", async () => {
    const account = await card();
    const first = (await db.accounts.toArray()).find((item) => item.id !== account.id)!;
    await reorderAccounts([account.id, first.id], db);
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    await importBackup(backup, db);
    expect((await db.accounts.get(account.id))!.position).toBe(0);
    expect((await db.accounts.get(first.id))!.position).toBe(1);
    expect((await db.accounts.get(first.id))!.initialBalance).toBe(first.initialBalance);
    const sync = parseSyncData(await readSyncData(db));
    expect(sync.accounts.find((item) => item.id === account.id)!.position).toBe(0);
    await expect(reorderAccounts([account.id, account.id], db)).rejects.toThrow(/lista de contas/);
  });
  it("sorts groups and entries in both directions", async () => {
    const saved = await createBatch([
      { draft: await draft("2026-10-19"), repeat: { mode: "none", count: 1 } },
      { draft: await draft("2026-10-20"), repeat: { mode: "none", count: 1 } },
    ], db);
    expect(groupByDate(saved).map(([date]) => date)).toEqual(["2026-10-20", "2026-10-19"]);
    expect(groupByDate(saved, true).map(([date]) => date)).toEqual(["2026-10-19", "2026-10-20"]);
  });
  it("round-trips paid invoices and recurrence through backup and sync schemas", async () => {
    const account = await card(), original = await draft();
    const ids = await createTransaction({ ...original, accountId: account.id }, { mode: "recurring", count: 3, frequency: "fortnightly" }, db);
    await payInvoice((await db.transactions.get(ids[0]))!.invoiceKey!, original.accountId, "2026-10-28", db);
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    await importBackup(backup, db);
    const sync = parseSyncData(await readSyncData(db));
    validateReferences(sync);
    expect(effectiveTransactions(sync.transactions).find((tx) => tx.id === ids[0])!.paid).toBe(true);
    expect(sync.transactions.find((tx) => tx.id === ids[1])!.frequency).toBe("fortnightly");
  });
  it("exports format 2 while accepting genuine legacy-format backups", async () => {
    const exported = await exportBackup(db);
    expect(exported.version).toBe(2);
    const legacy = { ...exported, version: 1 };
    expect(parseBackup(JSON.stringify(legacy)).version).toBe(1);
    expect(() => parseBackup(JSON.stringify({ ...exported, version: 3 }))).toThrow(/mais nova/);
  });
  it("upgrades a real version-4 database without changing records and saves a pre-1.2 snapshot", async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(4).stores({
      accounts: "id, type, updatedAt", categories: "id, kind, updatedAt",
      transactions: "id, date, accountId, toAccountId, categoryId, groupId, updatedAt",
      budgets: "id, categoryId, updatedAt", settings: "key", syncState: "key",
      workspaceCache: "id", workspaceCatalog: "userId", workspaceMembers: "workspaceId",
    });
    const backup = await exportBackup(db);
    await old.open();
    for (const table of ["accounts", "categories", "transactions", "budgets", "settings"] as const) await old.table(table).bulkPut(backup[table]);
    old.close();
    const upgraded = new FinanceDB(name);
    databases.push(upgraded);
    await upgraded.open();
    expect((await exportBackup(upgraded)).accounts).toEqual(backup.accounts);
    const snapshot = await upgraded.releaseBackups.get("pre-1.2");
    expect(snapshot?.data).toMatchObject({ accounts: backup.accounts, transactions: backup.transactions });
    await wipeAll(upgraded);
    expect(await upgraded.releaseBackups.count()).toBe(0);
  });
});
