import { createContext, useContext } from "react";
import type { TxType } from "./lib/db";
import type { FinanceData } from "./lib/hooks";

export interface TransactionRequest {
  id?: string;
  type?: TxType;
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  amount?: number;
}

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export interface AppState {
  data: FinanceData;
  month: string;
  setMonth: (month: string) => void;
  hidden: boolean;
  toggleHidden: () => void;
  openTransaction: (request?: TransactionRequest) => void;
  notify: (message: string, action?: Toast["action"]) => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error("useApp precisa estar dentro de AppContext.");
  return state;
}
