import { z } from "zod";
import type { SyncRecord, Transaction } from "./db";
import { parseSyncData, type SyncData } from "./sync-data";

export const SHEETS_COLUMNS = {
  "Lançamentos": [
    "id", "data", "tipo", "descricao", "valor_centavos", "valor_brl", "categoria", "conta",
    "conta_destino", "titular", "status", "observacoes", "serie_id", "parcela", "total_parcelas",
    "frequencia", "ciclo_fatura", "criado_em", "atualizado_em", "excluido_em", "rev", "origem", "dados_app",
  ],
  Contas: [
    "id", "nome", "tipo", "titular", "saldo_inicial_centavos", "limite_centavos",
    "dia_fechamento", "dia_vencimento", "ordem", "excluido_em", "criado_em", "atualizado_em", "rev", "dados_app",
  ],
  Categorias: ["id", "nome", "tipo", "icone", "cor", "excluido_em", "criado_em", "atualizado_em", "rev", "dados_app"],
  "Orçamentos": ["id", "categoria", "limite_mensal_centavos", "excluido_em", "criado_em", "atualizado_em", "rev", "dados_app"],
  Perfil: ["chave", "valor", "dados_app"],
  Metadados: ["chave", "valor"],
} as const;

export type MirrorSheet = keyof typeof SHEETS_COLUMNS;
export type MirrorCell = string | number;
export type MirrorRow = MirrorCell[];
export type MirrorRows = { [K in MirrorSheet]: MirrorRow[] };

const cell = (value: string | number | null | undefined): MirrorCell => value ?? "";
const date = (value: number | null) => value === null ? "" : new Date(value).toISOString();
const recordCells = (record: SyncRecord) => [
  date(record.createdAt), date(record.updatedAt), date(record.deletedAt), record.updatedAt,
] as const;

export function mirrorRows(input: SyncData): MirrorRows {
  const data = parseSyncData(input);
  const accounts = new Map(data.accounts.map((account) => [account.id, account.name]));
  const categories = new Map(data.categories.map((category) => [category.id, category.name]));
  const label = (id: string | null, names: Map<string, string>) => id === null ? "" : names.get(id) ?? id;

  return {
    "Lançamentos": data.transactions.map((tx) => [
      tx.id, tx.date, { expense: "Despesa", income: "Receita", transfer: "Transferência" }[tx.type],
      tx.description, tx.amount, "", label(tx.categoryId, categories), label(tx.accountId, accounts),
      label(tx.toAccountId, accounts), cell(tx.holderId), tx.paid ? "Pago" : "Pendente",
      tx.notes, cell(tx.groupId), cell(tx.installment), cell(tx.installments), cell(tx.frequency),
      cell(tx.invoiceDueDate), ...recordCells(tx), "app", JSON.stringify(tx),
    ]),
    Contas: data.accounts.map((account) => [
      account.id, account.name, account.type, cell(account.holderId), account.initialBalance,
      cell(account.creditLimit), cell(account.closingDay), cell(account.dueDay), cell(account.position),
      date(account.deletedAt), date(account.createdAt), date(account.updatedAt), account.updatedAt, JSON.stringify(account),
    ]),
    Categorias: data.categories.map((category) => [
      category.id, category.name, category.kind, category.icon, category.color,
      date(category.deletedAt), date(category.createdAt), date(category.updatedAt), category.updatedAt, JSON.stringify(category),
    ]),
    "Orçamentos": data.budgets.map((budget) => [
      budget.id, label(budget.categoryId, categories), budget.amount,
      date(budget.deletedAt), date(budget.createdAt), date(budget.updatedAt), budget.updatedAt, JSON.stringify(budget),
    ]),
    Perfil: data.settings.map((setting) => [setting.key, setting.value, JSON.stringify(setting)]),
    Metadados: [["schema_version", "2"], ["modelo_versao", "1.3.0"], ["tipo_planilha", "espelho"]],
  };
}

const remoteCell = z.union([z.string(), z.number(), z.boolean()]);
const remoteRows = z.array(z.array(remoteCell));
const remoteTransaction = z.object({
  id: z.string(), type: z.enum(["expense", "income", "transfer"]),
  date: z.string(), amount: z.number().int().safe().nonnegative(),
  accountId: z.string(), deletedAt: z.number().nullable(),
});

export interface MirrorTotal {
  accountId: string;
  month: string;
  type: Transaction["type"];
  holderId?: string | null;
  count: number;
  cents: number;
}

export function transactionTotals(
  transactions: readonly (Pick<Transaction, "accountId" | "date" | "type" | "amount" | "deletedAt"> &
    { holderId?: string | null })[],
  byHolder = false,
): MirrorTotal[] {
  const totalsByKey = new Map<string, MirrorTotal>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null) continue;
    const month = tx.date.slice(0, 7);
    const holderId = tx.holderId ?? null;
    const key = JSON.stringify([tx.accountId, month, tx.type, byHolder ? holderId : null]);
    const total = totalsByKey.get(key) ?? {
      accountId: tx.accountId, month, type: tx.type,
      ...(byHolder ? { holderId } : {}), count: 0, cents: 0,
    };
    total.count++;
    total.cents += tx.amount;
    if (!Number.isSafeInteger(total.cents)) throw new Error("O total em centavos excede o limite permitido.");
    totalsByKey.set(key, total);
  }
  return [...totalsByKey.values()].sort((a, b) =>
    a.month.localeCompare(b.month) || a.accountId.localeCompare(b.accountId) ||
    a.type.localeCompare(b.type) || (a.holderId ?? "").localeCompare(b.holderId ?? ""));
}

export function reconcileMirrorTransactions(local: SyncData, remote: unknown): {
  local: MirrorTotal[];
  remote: MirrorTotal[];
  matches: boolean;
} {
  const parsed = remoteRows.safeParse(remote);
  if (!parsed.success) throw new Error("A planilha retornou lançamentos inválidos; a conciliação foi interrompida.");
  const transactions = parsed.data.map((row) => {
    if (row.length !== SHEETS_COLUMNS["Lançamentos"].length || typeof row[22] !== "string") {
      throw new Error("A estrutura da aba Lançamentos não corresponde ao espelho.");
    }
    let payload: unknown;
    try { payload = JSON.parse(row[22]); }
    catch { throw new Error("A planilha contém um lançamento inválido; a conciliação foi interrompida."); }
    const tx = remoteTransaction.safeParse(payload);
    if (!tx.success || row[0] !== tx.data.id || row[1] !== tx.data.date ||
      row[4] !== tx.data.amount || row[7] === "" ||
      row[19] !== date(tx.data.deletedAt)) {
      throw new Error("A planilha contém um lançamento divergente; a conciliação foi interrompida.");
    }
    return tx.data;
  });
  const localTotals = transactionTotals(parseSyncData(local).transactions);
  const remoteTotals = transactionTotals(transactions);
  return { local: localTotals, remote: remoteTotals, matches: JSON.stringify(localTotals) === JSON.stringify(remoteTotals) };
}
