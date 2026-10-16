import { digitsToCents, formatPlain } from "../lib/money";

interface MoneyInputProps {
  value: number;
  onChange: (cents: number) => void;
  label: string;
  large?: boolean;
  autoFocus?: boolean;
  tone?: string;
}

/** Currency field that fills from the right like banking apps: typing 1, 2, 5, 0 shows 12,50. */
export function MoneyInput({ value, onChange, label, large = false, autoFocus = false, tone = "text-ink" }: MoneyInputProps) {
  return (
    <div
      className={`flex items-baseline gap-2 rounded-xl border border-line bg-cream/60 px-3 transition-colors focus-within:border-orange focus-within:bg-surface ${
        large ? "py-3" : "h-11 items-center"
      }`}
    >
      <span className={`font-semibold text-muted ${large ? "text-xl" : ""}`}>R$</span>
      <input
        aria-label={label}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={formatPlain(value)}
        onChange={(e) => onChange(digitsToCents(e.target.value))}
        onFocus={(e) => {
          const input = e.currentTarget;
          requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
        }}
        className={`w-full min-w-0 bg-transparent font-display tabular-nums outline-none ${tone} ${
          large ? "text-[2.25rem] leading-none font-bold" : "text-[1rem] font-semibold"
        }`}
      />
    </div>
  );
}
