import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db, type Account, type Budget, type Category, type Transaction } from "./db";
import { alive } from "./finance";

const EMPTY: never[] = [];

export interface FinanceData {
  ready: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  accountById: Map<string, Account>;
  categoryById: Map<string, Category>;
}

/** Live view of every active record; re-renders whenever IndexedDB changes. */
export function useFinanceData(): FinanceData {
  const accounts = useLiveQuery(() => db.accounts.toArray().then(alive));
  const categories = useLiveQuery(() => db.categories.toArray().then(alive));
  const transactions = useLiveQuery(() => db.transactions.toArray().then(alive));
  const budgets = useLiveQuery(() => db.budgets.toArray().then(alive));

  return useMemo(() => {
    const sortedAccounts = [...(accounts ?? EMPTY)].sort((a, b) => a.createdAt - b.createdAt);
    const sortedCategories = [...(categories ?? EMPTY)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return {
      ready: accounts !== undefined && categories !== undefined && transactions !== undefined && budgets !== undefined,
      accounts: sortedAccounts,
      categories: sortedCategories,
      transactions: transactions ?? EMPTY,
      budgets: budgets ?? EMPTY,
      accountById: new Map(sortedAccounts.map((a) => [a.id, a])),
      categoryById: new Map(sortedCategories.map((c) => [c.id, c])),
    };
  }, [accounts, categories, transactions, budgets]);
}

export function useSetting<T>(key: string, fallback: T): T {
  const value = useLiveQuery(() => db.settings.get(key), [key]);
  return value === undefined ? fallback : (value.value as T);
}
