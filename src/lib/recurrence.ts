import type { Transaction } from "./db";
import { addDays, addMonths, isISODate, parseISODate } from "./dates";

export type Frequency = NonNullable<Transaction["frequency"]>;
export type RepeatMode = "none" | "installments" | "recurring" | "monthly";
export interface Repeat {
  mode: RepeatMode;
  count: number;
  frequency?: Frequency;
  intervalDays?: number;
}

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "fortnightly", label: "Quinzenalmente" },
  { value: "monthly", label: "Mensalmente" },
  { value: "yearly", label: "Anualmente" },
  { value: "custom", label: "Personalizado" },
];

export const SELECTABLE_FREQUENCIES = FREQUENCIES.filter((item) => item.value !== "custom");

export function recurrenceHint(date: string, frequency: Frequency): string | undefined {
  if (frequency === "daily") return "Dia após dia";
  if (!isISODate(date)) return undefined;
  const day = parseISODate(date);
  const weekday = day.toLocaleDateString("pt-BR", { weekday: "long" });
  if (frequency === "weekly") return `${day.getDay() === 0 || day.getDay() === 6 ? "Todo" : "Toda"} ${weekday}`;
  if (frequency === "fortnightly") {
    const name = weekday.replace("-feira", "");
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} sim, ${name} não`;
  }
  if (frequency === "monthly") return `Todo dia ${day.getDate()} do mês`;
  if (frequency === "yearly") return `Todo dia ${day.getDate()} de ${day.toLocaleDateString("pt-BR", { month: "long" })}`;
  return undefined;
}

export function validateRepeat(repeat: Repeat): void {
  if (!["none", "installments", "recurring", "monthly"].includes(repeat.mode)) throw new Error("Escolha uma repetição válida.");
  if (repeat.mode === "none") return;
  if (!Number.isInteger(repeat.count) || repeat.count < 1 || repeat.count > 1200) {
    throw new Error("Informe entre 1 e 1.200 ocorrências.");
  }
  if (repeat.mode === "installments" || repeat.mode === "monthly") return;
  const frequency = repeat.frequency ?? "monthly";
  if (!FREQUENCIES.some((item) => item.value === frequency)) throw new Error("Escolha uma frequência válida.");
  if (frequency === "custom" && (!Number.isInteger(repeat.intervalDays) || repeat.intervalDays! < 1 || repeat.intervalDays! > 3650)) {
    throw new Error("Informe um intervalo de 1 a 3.650 dias.");
  }
}

export function occurrenceDate(date: string, index: number, repeat: Repeat): string {
  const frequency = repeat.mode === "installments" || repeat.mode === "monthly" ? "monthly" : repeat.frequency ?? "monthly";
  if (frequency === "monthly") return addMonths(date, index);
  if (frequency === "yearly") return addMonths(date, index * 12);
  const days = { daily: 1, weekly: 7, fortnightly: 14, custom: repeat.intervalDays ?? 1 }[frequency];
  return addDays(date, index * days);
}

export function transactionRepeat(tx?: Transaction, remaining?: number): Repeat {
  if (!tx?.groupId) return { mode: "none", count: 2, frequency: "monthly" };
  return {
    mode: tx.repeatMode ?? (tx.installments ? "installments" : "recurring"),
    count: remaining ?? tx.repeatCount ?? tx.installments ?? 2,
    frequency: tx.frequency ?? "monthly",
    intervalDays: tx.intervalDays ?? 14,
  };
}
