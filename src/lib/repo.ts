import { db, type Account, type Budget, type Category, type FinanceDB, type Transaction } from "./db";
import { addMonths } from "./dates";
import { splitInstallments } from "./finance";

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

/** Creates the starter categories and account on the very first run. */
export async function seedDefaults(database: FinanceDB = db): Promise<void> {
  await database.transaction("rw", database.categories, database.accounts, database.settings, async () => {
    if (await database.settings.get("seeded")) return;
    const now = stamp();
    await database.categories.bulkAdd(DEFAULT_CATEGORIES.map((c, i) => fresh<Category>(c, now + i)));
    await database.accounts.add(
      fresh<Account>({ name: "Conta principal", type: "checking", color: "#FF8A1F", initialBalance: 0, creditLimit: null }, now),
    );
    await database.settings.put({ key: "seeded", value: true });
  });
}

/* ---------- Transactions ---------- */

export type RepeatMode = "none" | "installments" | "monthly";

export type TransactionDraft = Omit<Draft<Transaction>, "groupId" | "installment" | "installments">;

export async function createTransaction(
  draft: TransactionDraft,
  repeat: { mode: RepeatMode; count: number } = { mode: "none", count: 1 },
  database: FinanceDB = db,
): Promise<string[]> {
  const count = repeat.mode === "none" ? 1 : Math.max(2, Math.min(120, Math.floor(repeat.count)));
  const now = stamp();
  if (count === 1) {
    const tx = fresh<Transaction>({ ...draft, groupId: null, installment: null, installments: null }, now);
    await database.transactions.add(tx);
    return [tx.id];
  }
  const groupId = uid();
  const amounts = repeat.mode === "installments" ? splitInstallments(draft.amount, count) : Array(count).fill(draft.amount);
  const items = amounts.map((amount, i) =>
    fresh<Transaction>(
      {
        ...draft,
        id: undefined,
        amount,
        date: addMonths(draft.date, i),
        paid: i === 0 ? draft.paid : false,
        groupId,
        installment: i + 1,
        installments: repeat.mode === "installments" ? count : null,
      },
      now + i,
    ),
  );
  await database.transactions.bulkAdd(items);
  return items.map((t) => t.id);
}

export async function updateTransaction(id: string, changes: Partial<TransactionDraft>, database: FinanceDB = db) {
  await database.transactions.update(id, { ...changes, updatedAt: stamp() });
}

export async function setPaid(id: string, paid: boolean, database: FinanceDB = db) {
  await database.transactions.update(id, { paid, updatedAt: stamp() });
}

/** Soft-deletes a transaction (and, optionally, the following ones of the same series). Returns affected ids. */
export async function deleteTransaction(id: string, scope: "one" | "following" = "one", database: FinanceDB = db) {
  const tx = await database.transactions.get(id);
  if (!tx) return [];
  let targets = [tx];
  if (scope === "following" && tx.groupId) {
    targets = (await database.transactions.where("groupId").equals(tx.groupId).toArray()).filter(
      (t) => t.deletedAt === null && t.date >= tx.date,
    );
  }
  const now = stamp();
  await database.transactions.bulkUpdate(targets.map((t) => ({ key: t.id, changes: { deletedAt: now, updatedAt: now } })));
  return targets.map((t) => t.id);
}

export async function restoreTransactions(ids: string[], database: FinanceDB = db) {
  const now = stamp();
  await database.transactions.bulkUpdate(ids.map((key) => ({ key, changes: { deletedAt: null, updatedAt: now } })));
}

/* ---------- Accounts, categories, budgets ---------- */

export async function saveAccount(draft: Draft<Account>, database: FinanceDB = db) {
  if (draft.id && (await database.accounts.get(draft.id))) {
    await database.accounts.update(draft.id, { ...draft, updatedAt: stamp() });
    return draft.id;
  }
  const account = fresh<Account>(draft);
  await database.accounts.add(account);
  return account.id;
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

export const BACKUP_VERSION = 1;

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
  return backup as Backup;
}

/** Replaces every local record with the backup content. */
export async function importBackup(backup: Backup, database: FinanceDB = db) {
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
  const tables = [database.accounts, database.categories, database.transactions, database.budgets, database.settings];
  await database.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
  await seedDefaults(database);
}
