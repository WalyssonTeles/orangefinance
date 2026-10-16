const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isISODate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && toISODate(parseISODate(iso)) === iso;
}

export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function formatDateInput(value: string): string {
  return isISODate(value) ? value.split("-").reverse().join("/") : maskDateInput(value);
}

export function editDateInput(previous: string, entered: string, caret: number, inputType: string) {
  let digits = entered.replace(/\D/g, "").slice(0, 8);
  let before = entered.slice(0, caret).replace(/\D/g, "").length;
  if (inputType.startsWith("delete") && entered !== previous && digits === previous.replace(/\D/g, "")) {
    const index = inputType === "deleteContentBackward" ? before - 1 : before;
    if (index >= 0 && index < digits.length) {
      digits = digits.slice(0, index) + digits.slice(index + 1);
      before = index;
    }
  }
  const text = maskDateInput(digits);
  const [day, month, year] = text.split("/");
  const candidate = text.length === 10 ? `${year}-${month}-${day}` : text;
  let position = 0;
  let count = 0;
  while (position < text.length && count < before) {
    if (/\d/.test(text[position])) count++;
    position++;
  }
  // Incomplete input must reach validation instead of retaining the previous saved date.
  return { text, value: isISODate(candidate) ? candidate : text, caret: position };
}

/** "2026-10-15" → "2026-10" */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonth(): string {
  return monthOf(todayISO());
}

export function yearPage(year: number, currentYear = new Date().getFullYear()): number[] {
  const end = currentYear + Math.ceil((year - currentYear) / 12) * 12;
  return Array.from({ length: 12 }, (_, index) => end - 11 + index);
}

export function calendarDays(month: string): (string | null)[] {
  const first = `${month}-01`;
  if (!isISODate(first)) throw new Error("Informe um mês válido para o calendário.");
  const offset = parseISODate(first).getDay();
  const count = Number(lastDayOfMonth(month).slice(-2));
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const date = addDays(first, index - offset);
    return isISODate(date) ? date : null;
  });
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
}

/** Adds months keeping the day when possible (31/01 + 1 → 28 or 29/02). */
export function addMonths(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toISODate(target);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthLabel(month: string, withYear = true): string {
  const date = parseISODate(`${month}-01`);
  const name = date.toLocaleDateString("pt-BR", { month: "long" });
  return withYear ? `${capitalize(name)} de ${date.getFullYear()}` : capitalize(name);
}

export function shortMonthLabel(month: string): string {
  const name = parseISODate(`${month}-01`).toLocaleDateString("pt-BR", { month: "short" });
  return capitalize(name.replace(".", ""));
}

export function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Hoje";
  if (iso === addDays(today, -1)) return "Ontem";
  if (iso === addDays(today, 1)) return "Amanhã";
  const date = parseISODate(iso);
  const label = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return capitalize(label);
}

export function shortDate(iso: string): string {
  return parseISODate(iso)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "");
}

export function addDays(iso: string, delta: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}
