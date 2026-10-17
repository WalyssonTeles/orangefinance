import { z } from "zod";
import type { MemberSummary } from "./db";
import type { Profile } from "./profile";
import { parseSyncData, type SyncData } from "./sync-data";
import type { MirrorCell, MirrorRow } from "./sheets-model";

export const TEMPLATE_HEADERS = {
  "Lançamentos": [
    "id", "data", "tipo", "descricao", "valor", "categoria", "conta", "conta_destino",
    "titular", "status", "observacoes", "serie_id", "parcela_n", "parcelas_total",
    "frequencia", "ciclo_fatura", "origem", "criado_em", "atualizado_em", "excluido_em",
    "rev", "dados_app", "valor_centavos", "repeticao", "ocorrencias", "intervalo_dias",
  ],
  Contas: [
    "id", "nome", "tipo", "titular", "saldo_inicial", "limite", "dia_fechamento",
    "dia_vencimento", "ordem", "arquivada", "criado_em", "atualizado_em", "rev", "dados_app",
  ],
  Categorias: ["id", "nome", "tipo", "icone", "cor", "ordem", "arquivada", "criado_em", "atualizado_em", "rev", "dados_app"],
  "Orçamentos": ["id", "categoria", "limite_mensal", "atualizado_em", "rev", "dados_app"],
} as const;

export type TemplateSheet = keyof typeof TEMPLATE_HEADERS;
export type TemplateRows = { [K in TemplateSheet]: MirrorRow[] };

const value = (input: MirrorCell | null | undefined): MirrorCell => input ?? "";
const date = (stamp: number | null) => stamp === null ? "" : new Date(stamp).toISOString();
const accountType = {
  checking: "Conta corrente", savings: "Poupança", wallet: "Carteira",
  credit: "Cartão de crédito", investment: "Investimentos",
} as const;
const frequencyLabel = {
  daily: "Diária", weekly: "Semanal", fortnightly: "Quinzenal",
  monthly: "Mensal", yearly: "Anual", custom: "Personalizada",
} as const;

export function sheetSerial(iso: string): number {
  const parsed = z.iso.date().safeParse(iso);
  if (!parsed.success) throw new Error("Um lançamento contém uma data inválida para a planilha.");
  const [year, month, day] = iso.split("-").map(Number);
  const stamp = Date.UTC(year, month - 1, day);
  if (new Date(stamp).toISOString().slice(0, 10) !== iso) {
    throw new Error("Um lançamento contém uma data inválida para a planilha.");
  }
  return (stamp - Date.UTC(1899, 11, 30)) / 86_400_000;
}

export function memberLabels(members: readonly MemberSummary[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const member of members) counts.set(member.name, (counts.get(member.name) ?? 0) + 1);
  return new Map(members.map((member) => [
    member.userId,
    counts.get(member.name) === 1 && member.name.trim()
      ? member.name : `${member.name.trim() || "Participante"} · ${member.userId.slice(0, 8)}`,
  ]));
}

export function templatePeople(members: readonly MemberSummary[]): MirrorRow[] {
  const labels = memberLabels(members);
  return members.map((member) => [
    member.userId, labels.get(member.userId)!, member.role === "owner" ? "responsável" : "participante", "",
  ]);
}

export function accountLabels(data: SyncData, members: readonly MemberSummary[] | null = null): Map<string, string> {
  const people = members ? memberLabels(members) : null;
  const base = (account: SyncData["accounts"][number]) => {
    if (!people || !account.holderId) return account.name;
    return `${account.name} · ${people.get(account.holderId) ?? `Ex-participante · ${account.holderId.slice(0, 8)}`}`;
  };
  const counts = new Map<string, number>();
  for (const account of data.accounts) {
    const name = base(account);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Map(data.accounts.map((account) => [
    account.id, counts.get(base(account)) === 1 ? base(account) : `${base(account)} · ${account.id.slice(0, 8)}`,
  ]));
}

export function templateFilterOptions(data: SyncData, members: readonly MemberSummary[] | null): {
  years: number[];
  accounts: string[];
  holders: string[];
} {
  const yearsInData = data.transactions.map((tx) => Number(tx.date.slice(0, 4)));
  const current = new Date().getFullYear();
  const start = Math.min(2015, current, ...yearsInData);
  const end = Math.max(current + 5, ...yearsInData);
  if (end - start + 1 > 299) throw new Error("O período dos lançamentos excede o limite do filtro de anos da planilha.");
  const names = accountLabels(data, members);
  const accounts = ["Todas", ...data.accounts.filter((account) => account.deletedAt === null)
    .map((account) => names.get(account.id)!)];
  const labels = members ? memberLabels(members) : new Map<string, string>();
  const former = members ? data.transactions.map((tx) => tx.holderId).filter((id): id is string => !!id && !labels.has(id))
    .map((id) => `Ex-participante · ${id.slice(0, 8)}`) : [];
  return {
    years: Array.from({ length: end - start + 1 }, (_, i) => start + i),
    accounts,
    holders: members ? ["Todos", ...new Set([...labels.values(), ...former])] : [],
  };
}

export function templateRows(input: SyncData, members: readonly MemberSummary[] | null = null): TemplateRows {
  const data = parseSyncData(input);
  const accounts = accountLabels(data, members);
  const categories = new Map(data.categories.map((item) => [item.id, item.name]));
  const label = (id: string | null, names: Map<string, string>) => id === null ? "" : names.get(id) ?? id;
  const people = members ? memberLabels(members) : null;
  const holder = (id: string | null | undefined) => id && people ? people.get(id) ?? `Ex-participante · ${id.slice(0, 8)}` : "";
  return {
    "Lançamentos": data.transactions.map((tx) => [
      tx.id, sheetSerial(tx.date),
      { expense: "Despesa", income: "Receita", transfer: "Transferência" }[tx.type],
      tx.description, tx.amount / 100, label(tx.categoryId, categories), label(tx.accountId, accounts),
      label(tx.toAccountId, accounts), holder(tx.holderId), tx.paid ? "Pago" : "Pendente",
      tx.notes, value(tx.groupId), value(tx.installment), value(tx.installments),
      tx.frequency ? frequencyLabel[tx.frequency] : "",
      tx.invoiceDueDate ? sheetSerial(tx.invoiceDueDate) : "", "app",
      date(tx.createdAt), date(tx.updatedAt), date(tx.deletedAt), tx.updatedAt, JSON.stringify(tx), tx.amount,
      tx.repeatMode === "installments" || (!tx.repeatMode && tx.installments) ? "Parcelada"
        : tx.repeatMode === "recurring" || (!tx.repeatMode && tx.groupId) ? "Recorrente" : "Única",
      tx.repeatCount ?? tx.installments ?? 1,
      tx.frequency === "custom" ? value(tx.intervalDays) : "",
    ]),
    Contas: data.accounts.map((account, index) => [
      account.id, accounts.get(account.id)!, accountType[account.type], holder(account.holderId),
      account.initialBalance / 100, value(account.creditLimit === null ? null : account.creditLimit / 100),
      value(account.closingDay), value(account.dueDay), account.position ?? index + 1,
      account.deletedAt === null ? "" : "Sim", date(account.createdAt), date(account.updatedAt),
      account.updatedAt, JSON.stringify(account),
    ]),
    Categorias: data.categories.map((category, index) => [
      category.id, category.name, category.kind === "expense" ? "Despesa" : "Receita",
      category.icon, category.color, index + 1, category.deletedAt === null ? "" : "Sim",
      date(category.createdAt), date(category.updatedAt), category.updatedAt, JSON.stringify(category),
    ]),
    "Orçamentos": data.budgets.map((budget) => [
      budget.id, label(budget.categoryId, categories), budget.deletedAt === null ? budget.amount / 100 : 0,
      date(budget.updatedAt), budget.updatedAt, JSON.stringify(budget),
    ]),
  };
}

export function templateProfile(data: SyncData, profile: Profile | null): MirrorRow[] {
  const own = profile?.name ?? data.settings.find((item) => item.key === "userName")?.value ?? "";
  return [["nome", own], ["sexo", profile?.gender ?? ""], ["data_nascimento", profile?.birthDate ?? ""]];
}
