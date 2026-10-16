import Dexie, { type EntityTable } from "dexie";
import type { SyncData } from "./sync-data";
import type { Workspace } from "./workspaces";

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
  /** Optional owner in shared spaces; absent on accounts created before 1.1. */
  holderId?: string | null;
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
  /** Shared spaces: user who owns the entry. Absent/null for personal entries and data created before 1.0. */
  holderId?: string | null;
}

export interface Budget extends SyncRecord {
  categoryId: string;
  amount: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface SyncConnection {
  key: "connection";
  userId: string;
  workspaceId: string;
  revision: number;
  base: SyncData;
}

export interface WorkspaceCache {
  id: string;
  connection: SyncConnection;
  data: SyncData;
}
export interface WorkspaceCatalog {
  userId: string;
  spaces: Workspace[];
}
export interface MemberSummary {
  userId: string;
  name: string;
  role: "owner" | "member";
}
export interface WorkspaceMembersCache {
  workspaceId: string;
  members: MemberSummary[];
}

export class FinanceDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  categories!: EntityTable<Category, "id">;
  transactions!: EntityTable<Transaction, "id">;
  budgets!: EntityTable<Budget, "id">;
  settings!: EntityTable<Setting, "key">;
  syncState!: EntityTable<SyncConnection, "key">;
  workspaceCache!: EntityTable<WorkspaceCache, "id">;
  workspaceCatalog!: EntityTable<WorkspaceCatalog, "userId">;
  workspaceMembers!: EntityTable<WorkspaceMembersCache, "workspaceId">;

  constructor(name = "orange-finance") {
    super(name);
    this.version(1).stores({
      accounts: "id, type, updatedAt",
      categories: "id, kind, updatedAt",
      transactions: "id, date, accountId, toAccountId, categoryId, groupId, updatedAt",
      budgets: "id, categoryId, updatedAt",
      settings: "key",
    });
    this.version(2).stores({ syncState: "key" });
    this.version(3).stores({ workspaceCache: "id", workspaceCatalog: "userId" });
    this.version(4).stores({ workspaceMembers: "workspaceId" });
  }
}

export const db = new FinanceDB();
