import { formatBRL, formatSigned } from "../lib/money";
import { useApp } from "../state";
import { Fit } from "./Fit";

interface MoneyProps {
  cents: number;
  signed?: boolean;
  className?: string;
  /** Shrink the font instead of overflowing when the value is wider than its box. */
  fit?: boolean;
}

/** Currency value that respects the "hide values" privacy toggle. */
export function Money({ cents, signed = false, className = "", fit = false }: MoneyProps) {
  const { hidden } = useApp();
  const text = hidden ? "R$ ••••" : signed ? formatSigned(cents) : formatBRL(cents);
  const label = hidden ? "Valor oculto" : undefined;
  if (fit) {
    return (
      <Fit className={`tabular-nums ${className}`}>
        <span aria-label={label}>{text}</span>
      </Fit>
    );
  }
  return (
    <span className={`tabular-nums whitespace-nowrap ${className}`} aria-label={label}>
      {text}
    </span>
  );
}
