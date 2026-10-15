const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const plain = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MAX_CENTS = 99_999_999_999;

export function formatBRL(cents: number): string {
  return currency.format(cents / 100);
}

export function formatSigned(cents: number): string {
  if (cents === 0) return formatBRL(0);
  return `${cents > 0 ? "+" : "−"} ${formatBRL(Math.abs(cents))}`;
}

export function formatPlain(cents: number): string {
  return plain.format(cents / 100);
}

/** Bank-app style entry: every typed digit shifts in from the right ("1250" → 12,50). */
export function digitsToCents(text: string): number {
  const digits = text.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  return Math.min(Number(digits.slice(0, 11)), MAX_CENTS);
}
