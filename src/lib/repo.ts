import { db, type Account, type Budget, type Category, type FinanceDB, type Transaction } from "./db";
import { addMonths, isISODate } from "./dates";
import { splitInstallments } from "./finance";
import { backupSchema } from "./backup-schema";
import { cardCycle, cardInvoices, invoicePayment, validateInvoices } from "./invoices";
import { occurrenceDate, transactionRepeat, validateRepeat, type Repeat } from "./recurrence";
export type { RepeatMode } from "./recurrence";

type Draft<T> = Omit<T, "id" | "createdAt" | "updatedAt" | "deletedAt"> & { id?: string };

const uid = () => crypto.randomUUID();
const stamp = () => Date.now();

function fresh<T>(draft: Draft<T>, now = stamp()): T {
  return { ...draft, id: draft.id ?? uid(), createdAt: now, updatedAt: now, deletedAt: null } as T;
}

export const DEFAULT_CATEGORIES: Array<Pick<Category, "name" | "kind" | "icon" | "color">> = [
  { name: "Alimentação", kind: "expense", icon: "utensils", color: "#E8590C" },
  { name: "Mercado", kind: "expense", icon: "cart", color: "#2F9444" },
  { name: "Moradia", kind: "expense", icon: "home", color: "#8B5E3C" },
  { name: "Contas da casa", kind: "expense", icon: "bolt", color: "#F59F00" },
  { name: "Transporte", kind: "expense", icon: "car", color: "#1C7ED6" },
  { name: "Saúde", kind: "expense", icon: "heart", color: "#C2255C" },
  { name: "Educação", kind: "expense", icon: "book", color: "#7048E8" },
  { name: "Lazer", kind: "expense", icon: "party", color: "#0C8599" },
  { name: "Compras", kind: "expense", icon: "bag", color: "#D6336C" },
  { name: "Assinaturas", kind: "expense", icon: "tv", color: "#5F3DC4" },
  { name: "Pets", kind: "expense", icon: "paw", color: "#A0522D" },
  { name: "Outros gastos", kind: "expense", icon: "more", color: "#868E96" },
  { name: "Salário", kind: "income", icon: "briefcase", color: "#247A52" },
  { name: "Freelance", kind: "income", icon: "laptop", color: "#1C7ED6" },
  { name: "Investimentos", kind: "income", icon: "trending", color: "#5C940D" },
  { name: "Presentes", kind: "income", icon: "gift", color: "#D6336C" },
  { name: "Outras receitas", kind: "income", icon: "more", color: "#868E96" },
];

export const DEFAULT_ACCOUNT: Omit<Account, "id" | "createdAt" | "updatedAt" | "deletedAt"> = {
  name: "Conta principal", type: "checking", color: "#FF8A1F", initialBalance: 0, creditLimit: null,
};

/** Creates the starter categories and account on the very first run. */
export function defaultRecords() {
  const now = stamp();
  return {
    categories: DEFAULT_CATEGORIES.map((c, i) => fresh<Category>(c, now + i)),
    accounts: [
      fresh<Account>(DEFAULT_ACCOUNT, now),
    ],
  };
}

export async function seedDefaults(database: FinanceDB = db): Promise<void> {
  await database.transaction("rw", database.categories, database.accounts, database.settings, async () => {
    if (await database.settings.get("seeded")) return;
    const initial = defaultRecords();
    await database.categories.bulkAdd(initial.categories);
    await database.accounts.bulkAdd(initial.accounts);
    await database.settings.put({ key: "seeded", value: true });
  });
}

/* ---------- Transactions ---------- */

export type TransactionDraft = Omit<Draft<Transaction>, "groupId" | "installment" | "installments">;

async function prepareDraft(draft: TransactionDraft, database: FinanceDB, legacyCredit = false): Promise<TransactionDraft> {
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0) throw new Error("Informe um valor maior que zero.");
  if (!isISODate(draft.date)) throw new Error("Informe uma data válida.");
  const account = await database.accounts.get(draft.accountId);
  if (!account || account.deletedAt !== null) throw new Error("Escolha uma conta ativa.");
  if (draft.type === "transfer") {
    const target = draft.toAccountId ? await database.accounts.get(draft.toAccountId) : null;
    if (!target || target.deletedAt !== null || target.id === account.id) throw new Error("Escolha uma conta de destino diferente da origem.");
  } else {
    const category = draft.categoryId ? await database.categories.get(draft.categoryId) : null;
    if (!category || category.deletedAt !== null || category.kind !== draft.type) throw new Error("Escolha uma categoria compatível com o lançamento.");
  }
  if (draft.type === "expense" && account.type === "credit") {
    if (legacyCredit) return draft;
    const cycle = draft.invoiceKey && draft.invoiceDueDate ? { invoiceKey: draft.invoiceKey, invoiceDueDate: draft.invoiceDueDate } : cardCycle(account, draft.date);
    await requireOpenInvoice(cycle.invoiceKey, database);
    return { ...draft, ...cycle, paid: false, invoicePaymentKey: null };
  }
  return { ...draft, invoiceKey: null, invoiceDueDate: null, invoicePaymentKey: null };
}

async function requireOpenInvoice(key: string | null | undefined, database: FinanceDB) {
  const payment = key ? await database.transactions.get(`invoice-payment:${key}`) : undefined;
  if (payment && payment.deletedAt === null && payment.paid && payment.invoicePaymentKey === key) {
    throw new Error("Esta fatura já foi paga. Reabra a fatura em Contas antes de alterar suas compras.");
  }
}

export async function createTransaction(
  draft: TransactionDraft,
  repeat: Repeat = { mode: "none", count: 1 },
  database: FinanceDB = db,
): Promise<string[]> {
  validateRepeat(repeat);
  if (!isISODate(draft.date)) throw new Error("Informe uma data válida.");
  if (draft.type === "transfer" && repeat.mode !== "none") throw new Error("Transferências não permitem repetição.");
  return database.transaction("rw", database.transactions, database.accounts, database.categories, async () => {
  const count = repeat.mode === "none" ? 1 : repeat.count;
  const now = stamp();
  const groupId = count > 1 ? uid() : null;
  const amounts = repeat.mode === "installments" ? splitInstallments(draft.amount, count) : Array(count).fill(draft.amount);
  if (amounts.some((amount) => amount <= 0)) throw new Error("O valor precisa permitir pelo menos um centavo por parcela.");
  const items = await Promise.all(amounts.map(async (amount, i) =>
    fresh<Transaction>(
      {
        ...await prepareDraft({ ...draft, amount, date: occurrenceDate(draft.date, i, repeat), invoiceKey: null, invoiceDueDate: null, paid: i === 0 ? draft.paid : false }, database),
        id: i === 0 ? draft.id : undefined,
        groupId,
        installment: count > 1 ? i + 1 : null,
        installments: repeat.mode === "installments" ? count : null,
        repeatMode: repeat.mode === "monthly" ? "recurring" : repeat.mode,
        frequency: repeat.mode === "monthly" || repeat.mode === "installments" ? "monthly" : repeat.frequency ?? "monthly",
        intervalDays: repeat.mode === "recurring" && repeat.frequency === "custom" ? repeat.intervalDays ?? 14 : 14,
        repeatCount: count,
      },
      now + i,
    ),
  ));
  await database.transactions.bulkAdd(items);
  return items.map((t) => t.id);
  });
}

export type SeriesScope = "one" | "following";

function monthIndex(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + m;
}

/** Items of the same series from `tx` onwards (by installment number, falling back to date). */
async function followingInSeries(tx: Transaction, database: FinanceDB): Promise<Transaction[]> {
  if (!tx.groupId) return [tx];
  const siblings = await database.transactions.where("groupId").equals(tx.groupId).toArray();
  return siblings.filter((t) => t.deletedAt === null && (
    t.installment !== null && tx.installment !== null ? t.installment >= tx.installment : t.date >= tx.date
  ));
}

/**
 * Updates one entry or this and the following entries of its series. For the following entries,
 * every field changes except the paid status, and a new date keeps the monthly cadence.
 */
export async function updateTransaction(
  id: string, changes: Partial<TransactionDraft>, scope: SeriesScope = "one", database: FinanceDB = db,
): Promise<string[]> {
  return database.transaction("rw", database.transactions, database.accounts, database.categories, async () => {
    const tx = await database.transactions.get(id);
    if (!tx || tx.deletedAt !== null) throw new Error("Lançamento não encontrado.");
    if (tx.invoicePaymentKey) throw new Error("Gerencie o pagamento desta fatura em Contas.");
    await requireOpenInvoice(tx.invoiceKey, database);
    const now = stamp();
    if (scope === "one" || !tx.groupId) {
      const draft = { ...tx, ...changes };
      if (changes.date && changes.date !== tx.date || changes.accountId && changes.accountId !== tx.accountId || changes.type && changes.type !== tx.type) {
        draft.invoiceKey = null;
        draft.invoiceDueDate = null;
      }
      // Pre-1.2 card entries retain their original semantics until explicitly moved or redated.
      const legacyCredit = !tx.invoiceKey && draft.accountId === tx.accountId && draft.date === tx.date && draft.type === tx.type;
      const prepared = await prepareDraft(draft, database, legacyCredit);
      await database.transactions.update(id, { ...prepared, updatedAt: now });
      return [id];
    }
    const { paid: _paid, date, id: _id, ...shared } = changes;
    const targets = await followingInSeries(tx, database);
    for (const target of targets) {
      await requireOpenInvoice(target.invoiceKey, database);
      const repeat = transactionRepeat(tx);
      const index = (target.installment ?? 1) - (tx.installment ?? 1);
      const nextDate = !date ? target.date : tx.frequency && tx.frequency !== "monthly"
        ? occurrenceDate(date, index, repeat) : addMonths(date, monthIndex(target.date) - monthIndex(tx.date));
      const draft = { ...target, ...shared, ...(target.id === id ? changes : {}), date: nextDate };
      const moved = draft.date !== target.date || draft.accountId !== target.accountId || draft.type !== target.type;
      if (moved) { draft.invoiceKey = null; draft.invoiceDueDate = null; }
      const prepared = await prepareDraft(draft, database, !target.invoiceKey && !moved);
      await database.transactions.update(target.id, { ...prepared, updatedAt: now });
    }
    return targets.map((t) => t.id);
  });
}

export async function setPaid(id: string, paid: boolean, database: FinanceDB = db) {
  return database.transaction("rw", database.transactions, async () => {
  const tx = await database.transactions.get(id);
  if (!tx) throw new Error("Lançamento não encontrado.");
  if (tx.invoiceKey || tx.invoicePaymentKey) throw new Error("O status deste lançamento é controlado pela fatura em Contas.");
  await database.transactions.update(id, { paid, updatedAt: stamp() });
  });
}

/** Soft-deletes a transaction (and, optionally, the following ones of the same series). Returns affected ids. */
export async function deleteTransaction(id: string, scope: SeriesScope = "one", database: FinanceDB = db) {
  return database.transaction("rw", database.transactions, async () => {
  const tx = await database.transactions.get(id);
  if (!tx) throw new Error("Lançamento não encontrado.");
  if (tx.invoicePaymentKey) throw new Error("Reabra esta fatura em Contas para desfazer seu pagamento.");
  const targets = scope === "following" ? await followingInSeries(tx, database) : [tx];
  for (const target of targets) await requireOpenInvoice(target.invoiceKey, database);
  const now = stamp();
  await database.transactions.bulkUpdate(targets.map((t) => ({ key: t.id, changes: { deletedAt: now, updatedAt: now } })));
  return targets.map((t) => t.id);
  });
}

export async function restoreTransactions(ids: string[], database: FinanceDB = db) {
  return database.transaction("rw", database.transactions, async () => {
  for (const tx of await database.transactions.bulkGet(ids)) if (tx) await requireOpenInvoice(tx.invoiceKey, database);
  const now = stamp();
  await database.transactions.bulkUpdate(ids.map((key) => ({ key, changes: { deletedAt: null, updatedAt: now } })));
  });
}

/** Replaces only the selected and future occurrences; earlier history stays untouched. */
export async function changeRecurrence(id: string, draft: TransactionDraft, repeat: Repeat, database: FinanceDB = db) {
  return database.transaction("rw", database.transactions, database.accounts, database.categories, async () => {
    const tx = await database.transactions.get(id);
    if (!tx || tx.deletedAt !== null) throw new Error("Lançamento não encontrado.");
    if (tx.invoicePaymentKey) throw new Error("Gerencie o pagamento desta fatura em Contas.");
    const targets = await followingInSeries(tx, database);
    for (const target of targets) {
      await requireOpenInvoice(target.invoiceKey, database);
      if (target.id !== id && target.paid) throw new Error("Há ocorrências futuras pagas. Marque-as como pendentes antes de mudar a repetição.");
    }
    const now = stamp();
    await database.transactions.bulkUpdate(targets.map((target) => ({ key: target.id, changes: { deletedAt: now, updatedAt: now } })));
    const ids = await createTransaction({ ...draft, id: undefined }, repeat, database);
    const first = (await database.transactions.get(ids[0]))!;
    await database.transactions.delete(first.id);
    await database.transactions.put({ ...first, id, createdAt: tx.createdAt });
    return [id, ...ids.slice(1)];
  });
}

export interface BatchEntry { draft: TransactionDraft; repeat: Repeat }

export async function createBatch(entries: BatchEntry[], database: FinanceDB = db): Promise<Transaction[]> {
  if (!entries.length || entries.length > 200) throw new Error("Adicione entre 1 e 200 linhas.");
  if (entries.reduce((sum, item) => sum + (item.repeat.mode === "none" ? 1 : item.repeat.count), 0) > 5000) throw new Error("O lote não pode gerar mais de 5.000 lançamentos.");
  return database.transaction("rw", database.transactions, database.accounts, database.categories, async () => {
    const ids: string[] = [];
    for (const [index, entry] of entries.entries()) {
      try { ids.push(...await createTransaction(entry.draft, entry.repeat, database)); }
      catch (error) { throw new Error(`Linha ${index + 1}: ${error instanceof Error ? error.message : "Não foi possível salvar."}`); }
    }
    const records = await database.transactions.bulkGet(ids);
    return records.filter((record): record is Transaction => record !== undefined);
  });
}

export async function undoBatch(records: Transaction[], database: FinanceDB = db) {
  return database.transaction("rw", database.transactions, async () => {
    for (const record of records) {
      const current = await database.transactions.get(record.id);
      if (JSON.stringify(current) !== JSON.stringify(record)) throw new Error("O lote foi alterado depois de salvo. Revise os lançamentos antes de excluí-los.");
      await requireOpenInvoice(record.invoiceKey, database);
    }
    const now = stamp();
    await database.transactions.bulkUpdate(records.map((record) => ({ key: record.id, changes: { deletedAt: now, updatedAt: now } })));
  });
}

export async function payInvoice(key: string, accountId: string, date: string, database: FinanceDB = db) {
  return database.transaction("rw", database.transactions, database.accounts, async () => {
    const all = await database.transactions.toArray();
    if (invoicePayment(all, key)) throw new Error("Esta fatura já foi paga.");
    const card = (await database.accounts.toArray()).find((account) => key.startsWith(`${account.id}:`) && account.type === "credit" && account.deletedAt === null);
    const source = await database.accounts.get(accountId);
    if (!source || source.deletedAt !== null || source.type === "credit") throw new Error("Escolha uma conta de pagamento.");
    if (!isISODate(date)) throw new Error("Informe uma data válida.");
    const invoice = card && cardInvoices(all, card.id).find((item) => item.key === key);
    if (!invoice) throw new Error("Fatura não encontrada.");
    const payment = fresh<Transaction>({
      id: `invoice-payment:${key}`, type: "transfer", accountId, toAccountId: card.id,
      amount: invoice.amount, description: `Pagamento de fatura · ${card.name}`, date, paid: true,
      categoryId: null, notes: "", groupId: null, installment: null, installments: null, invoicePaymentKey: key,
    });
    await database.transactions.put(payment);
  });
}

export async function reopenInvoice(key: string, database: FinanceDB = db) {
  return database.transaction("rw", database.transactions, async () => {
    const payment = invoicePayment(await database.transactions.toArray(), key);
    if (!payment) throw new Error("Esta fatura não está paga.");
    await database.transactions.update(payment.id, { deletedAt: stamp(), updatedAt: stamp() });
  });
}

export async function reorderAccounts(ids: string[], database: FinanceDB = db) {
  return database.transaction("rw", database.accounts, async () => {
    const active = (await database.accounts.toArray()).filter((account) => account.deletedAt === null);
    if (new Set(ids).size !== ids.length || active.length !== ids.length || active.some((account) => !ids.includes(account.id))) throw new Error("A lista de contas mudou. Tente reordenar novamente.");
    const now = stamp();
    await database.accounts.bulkUpdate(ids.map((id, position) => ({ key: id, changes: { position, updatedAt: now } })));
  });
}

/* ---------- Accounts, categories, budgets ---------- */

export async function saveAccount(draft: Draft<Account>, database: FinanceDB = db) {
  return database.transaction("rw", database.accounts, database.transactions, async () => {
  for (const day of [draft.closingDay, draft.dueDay]) if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) throw new Error("Os dias de fechamento e vencimento precisam estar entre 1 e 31.");
  if (draft.id && (await database.accounts.get(draft.id))) {
    const current = await database.accounts.get(draft.id);
    if (current?.type !== draft.type && (await database.transactions.toArray()).some((tx) => tx.deletedAt === null && tx.invoiceKey && tx.accountId === draft.id)) {
      throw new Error("Este cartão possui faturas vinculadas e não pode mudar de tipo.");
    }
    await database.accounts.update(draft.id, { ...draft, updatedAt: stamp() });
    return draft.id;
  }
  const account = fresh<Account>(draft);
  await database.accounts.add(account);
  return account.id;
  });
}

async function usedByTransactions(field: "accountId" | "categoryId", id: string, database: FinanceDB) {
  const direct = await database.transactions.where(field).equals(id).filter((t) => t.deletedAt === null).count();
  if (field === "categoryId") return direct;
  const incoming = await database.transactions.where("toAccountId").equals(id).filter((t) => t.deletedAt === null).count();
  return direct + incoming;
}

/** Returns false when the account still has transactions and cannot be removed. */
export async function deleteAccount(id: string, database: FinanceDB = db): Promise<boolean> {
  if (await usedByTransactions("accountId", id, database)) return false;
  const now = stamp();
  await database.accounts.update(id, { deletedAt: now, updatedAt: now });
  return true;
}

export async function saveCategory(draft: Draft<Category>, database: FinanceDB = db) {
  if (draft.id && (await database.categories.get(draft.id))) {
    await database.categories.update(draft.id, { ...draft, updatedAt: stamp() });
    return draft.id;
  }
  const category = fresh<Category>(draft);
  await database.categories.add(category);
  return category.id;
}

export async function deleteCategory(id: string, database: FinanceDB = db): Promise<boolean> {
  if (await usedByTransactions("categoryId", id, database)) return false;
  const now = stamp();
  await database.transaction("rw", database.categories, database.budgets, async () => {
    await database.categories.update(id, { deletedAt: now, updatedAt: now });
    const budgets = await database.budgets.where("categoryId").equals(id).toArray();
    await database.budgets.bulkUpdate(budgets.map((b) => ({ key: b.id, changes: { deletedAt: now, updatedAt: now } })));
  });
  return true;
}

export async function saveBudget(draft: Draft<Budget>, database: FinanceDB = db) {
  if (draft.id && (await database.budgets.get(draft.id))) {
    await database.budgets.update(draft.id, { ...draft, updatedAt: stamp() });
    return draft.id;
  }
  const budget = fresh<Budget>(draft);
  await database.budgets.add(budget);
  return budget.id;
}

export async function deleteBudget(id: string, database: FinanceDB = db) {
  const now = stamp();
  await database.budgets.update(id, { deletedAt: now, updatedAt: now });
}

/* ---------- Settings ---------- */

export async function setSetting(key: string, value: unknown, database: FinanceDB = db) {
  await database.settings.put({ key, value });
}

/* ---------- Backup ---------- */

export const BACKUP_VERSION = 2;

export interface Backup {
  app: "orange-finance";
  version: number;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  settings: { key: string; value: unknown }[];
}

export async function exportBackup(database: FinanceDB = db): Promise<Backup> {
  const [accounts, categories, transactions, budgets, settings] = await Promise.all([
    database.accounts.toArray(),
    database.categories.toArray(),
    database.transactions.toArray(),
    database.budgets.toArray(),
    database.settings.toArray(),
  ]);
  return {
    app: "orange-finance",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    categories,
    transactions,
    budgets,
    settings,
  };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const backup = data as Partial<Backup>;
  if (!backup || backup.app !== "orange-finance") throw new Error("Este arquivo não é um backup do Orange Finance.");
  if (typeof backup.version !== "number" || backup.version > BACKUP_VERSION) {
    throw new Error("Este backup foi criado por uma versão mais nova do app.");
  }
  for (const key of ["accounts", "categories", "transactions", "budgets", "settings"] as const) {
    if (!Array.isArray(backup[key])) throw new Error(`O backup está incompleto: faltam os dados de "${key}".`);
  }
  const parsed = backupSchema.safeParse(data);
  if (!parsed.success) throw new Error("O backup contém registros inválidos ou valores incompatíveis.");
  validateInvoices(parsed.data.accounts, parsed.data.transactions);
  return parsed.data;
}

/** Replaces every local record with the backup content. */
export async function importBackup(backup: Backup, database: FinanceDB = db) {
  validateInvoices(backup.accounts, backup.transactions);
  const tables = [database.accounts, database.categories, database.transactions, database.budgets, database.settings];
  await database.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await database.accounts.bulkAdd(backup.accounts);
    await database.categories.bulkAdd(backup.categories);
    await database.transactions.bulkAdd(backup.transactions);
    await database.budgets.bulkAdd(backup.budgets);
    await database.settings.bulkPut([...backup.settings.filter((s) => s.key !== "seeded"), { key: "seeded", value: true }]);
  });
}

export async function wipeAll(database: FinanceDB = db) {
  const tables = [database.accounts, database.categories, database.transactions, database.budgets, database.settings, database.releaseBackups];
  await database.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
  await seedDefaults(database);
}
