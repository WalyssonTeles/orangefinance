import Dexie, { type EntityTable } from "dexie";

export type TxType = "expense" | "income" | "transfer";
export type CategoryKind = "expense" | "income";
export type AccountType = "checking" | "savings" | "wallet" | "credit" | "investment";

/** Fields shared by every synced record. Amounts are always integer cents. */
export interface SyncRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Account extends SyncRecord {
  name: string;
  type: AccountType;
  color: string;
  /** Opening balance. For credit cards a negative value is an open invoice. */
  initialBalance: number;
  creditLimit: number | null;
}

export interface Category extends SyncRecord {
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
}

export interface Transaction extends SyncRecord {
  type: TxType;
  amount: number;
  description: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  paid: boolean;
  notes: string;
  groupId: string | null;
  installment: number | null;
  installments: number | null;
}

export interface Budget extends SyncRecord {
  categoryId: string;
  amount: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class FinanceDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  categories!: EntityTable<Category, "id">;
  transactions!: EntityTable<Transaction, "id">;
  budgets!: EntityTable<Budget, "id">;
  settings!: EntityTable<Setting, "key">;

  constructor(name = "orange-finance") {
    super(name);
    this.version(1).stores({
      accounts: "id, type, updatedAt",
      categories: "id, kind, updatedAt",
      transactions: "id, date, accountId, toAccountId, categoryId, groupId, updatedAt",
      budgets: "id, categoryId, updatedAt",
      settings: "key",
    });
  }
}

export const db = new FinanceDB();
