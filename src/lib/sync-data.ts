import { z } from "zod";
import { backupSchema } from "./backup-schema";
import type { FinanceDB } from "./db";
import { DEFAULT_ACCOUNT, DEFAULT_CATEGORIES } from "./repo";
import { validateInvoices } from "./invoices";

const schema = backupSchema.omit({ app: true, version: true, exportedAt: true, settings: true }).extend({
  settings: z.array(z.object({ key: z.literal("userName"), value: z.string() })).max(1),
});

export type SyncData = z.infer<typeof schema>;
export type ConflictChoice = "local" | "remote";
export interface Conflict {
  table: keyof SyncData;
  id: string;
  label: string;
  local: unknown;
  remote: unknown;
}

export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

export const TABLES = ["accounts", "categories", "transactions", "budgets", "settings"] as const;

export function parseSyncData(value: unknown): SyncData {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Os dados de sincronização são inválidos. Nenhum dado local foi substituído.");
  for (const table of TABLES) {
    const keys = result.data[table].map((row) => "id" in row ? row.id : row.key);
    if (new Set(keys).size !== keys.length) throw new Error("A sincronização contém registros duplicados.");
  }

  return result.data;
}

export function hasUserData(data: SyncData): boolean {
  if (data.transactions.length || data.budgets.length || data.settings.some((setting) => setting.value.trim() !== "")) return true;
  if (data.accounts.length === 0 && data.categories.length === 0) return false;
  const accounts = data.accounts.map(({ id: _id, createdAt: _created, updatedAt: _updated, holderId, ...fields }) => ({
    ...fields, ...(holderId ? { holderId } : {}),
  }));
  const categories = data.categories.map(({ id: _id, createdAt: _created, updatedAt: _updated, ...fields }) => stable(fields)).sort();
  return stable(accounts) !== stable([{ ...DEFAULT_ACCOUNT, deletedAt: null }]) ||
    stable(categories) !== stable(DEFAULT_CATEGORIES.map((category) => stable({ ...category, deletedAt: null })).sort());
}

export async function readSyncData(database: FinanceDB): Promise<SyncData> {
  const [accounts, categories, transactions, budgets, userName] = await Promise.all([
    database.accounts.toArray(),
    database.categories.toArray(),
    database.transactions.toArray(),
    database.budgets.toArray(),
    database.settings.get("userName"),
  ]);
  return parseSyncData({
    accounts, categories, transactions, budgets,
    settings: userName ? [userName] : [],
  });
}

export async function applySyncData(database: FinanceDB, data: SyncData): Promise<void> {
  await database.accounts.clear();
  await database.categories.clear();
  await database.transactions.clear();
  await database.budgets.clear();
  await database.accounts.bulkPut(data.accounts);
  await database.categories.bulkPut(data.categories);
  await database.transactions.bulkPut(data.transactions);
  await database.budgets.bulkPut(data.budgets);
  await database.settings.delete("userName");
  await database.settings.bulkPut(data.settings);
  await database.settings.put({ key: "seeded", value: true });
}

type Keyed = { id: string } | { key: string };
const rowKey = (row: Keyed) => "id" in row ? row.id : row.key;

function mergeRows<T extends Keyed>(
  table: keyof SyncData, base: T[], local: T[], remote: T[], conflicts: Conflict[], choice?: ConflictChoice,
): T[] {
  const b = new Map(base.map((row) => [rowKey(row), row]));
  const l = new Map(local.map((row) => [rowKey(row), row]));
  const r = new Map(remote.map((row) => [rowKey(row), row]));
  const output: T[] = [];
  for (const id of [...new Set([...b.keys(), ...l.keys(), ...r.keys()])].sort()) {
    const old = b.get(id), left = l.get(id), right = r.get(id);
    let selected: T | undefined;
    if (stable(left) === stable(right) || stable(right) === stable(old)) selected = left;
    else if (stable(left) === stable(old)) selected = right;
    else {
      const row = left ?? right;
      const label = row && "description" in row && typeof row.description === "string" ? row.description
        : row && "name" in row && typeof row.name === "string" ? row.name : id;
      conflicts.push({ table, id, label, local: left, remote: right });
      selected = choice === "remote" ? right : left;
    }
    if (selected) output.push(selected);
  }
  return output;
}

export function mergeSyncData(base: SyncData, local: SyncData, remote: SyncData, choice?: ConflictChoice) {
  const conflicts: Conflict[] = [];
  const data: SyncData = {
    accounts: mergeRows("accounts", base.accounts, local.accounts, remote.accounts, conflicts, choice),
    categories: mergeRows("categories", base.categories, local.categories, remote.categories, conflicts, choice),
    transactions: mergeRows("transactions", base.transactions, local.transactions, remote.transactions, conflicts, choice),
    budgets: mergeRows("budgets", base.budgets, local.budgets, remote.budgets, conflicts, choice),
    settings: mergeRows("settings", base.settings, local.settings, remote.settings, conflicts, choice),
  };
  return { data, conflicts, signature: stable(conflicts) };
}

export function validateReferences(data: SyncData): void {
  validateInvoices(data.accounts, data.transactions);
  const accounts = new Set(data.accounts.filter((a) => a.deletedAt === null).map((a) => a.id));
  const categories = new Set(data.categories.filter((c) => c.deletedAt === null).map((c) => c.id));
  if (data.transactions.some((t) => t.deletedAt === null && (
    !accounts.has(t.accountId) || (t.toAccountId !== null && !accounts.has(t.toAccountId)) ||
    (t.categoryId !== null && !categories.has(t.categoryId))
  )) || data.budgets.some((b) => b.deletedAt === null && !categories.has(b.categoryId))) {
    throw new Error("Há lançamentos ou orçamentos vinculados a contas/categorias removidas em outro aparelho. Exporte um backup e corrija os vínculos antes de tentar novamente.");
  }
}
