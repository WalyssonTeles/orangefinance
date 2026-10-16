import type { ButtonHTMLAttributes, ReactNode } from "react";
export { MonthPicker } from "./MonthPicker";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-[1.05rem] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-press",
  secondary: "bg-orange-soft text-brand-ink hover:bg-orange-soft-hover",
  ghost: "text-muted hover:bg-ink/5 hover:text-ink",
  danger: "bg-negative/10 text-negative hover:bg-negative/15",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[0.95rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/5 hover:text-ink ${className}`}
      {...props}
    />
  );
}

export function PageHeader({ title, subtitle, actions, actionsClassName = "" }: { title: string; subtitle?: ReactNode; actions?: ReactNode; actionsClassName?: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">{title}</h1>
        {subtitle && <div className="mt-1 text-muted">{subtitle}</div>}
      </div>
      {actions && <div className={`flex flex-wrap items-center gap-2 ${actionsClassName}`}>{actions}</div>}
    </header>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-cream/60 px-3 text-[0.95rem] outline-none transition-colors placeholder:text-muted/70 focus:border-orange focus:bg-surface";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; activeClass?: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-ink/5 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`h-9 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors ${
              active ? (option.activeClass ?? "bg-surface text-ink shadow-sm") : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl py-1 text-left text-[0.95rem] font-medium"
    >
      {label}
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-positive" : "bg-ink/20"}`}>
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${checked ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}

export function ProgressBar({ ratio, tone }: { ratio: number; tone: "ok" | "warning" | "over" }) {
  const color = { ok: "bg-positive", warning: "bg-orange", over: "bg-negative" }[tone];
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink/8">
      <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-full bg-orange-soft">
        <span className="size-6 rounded-full border-4 border-orange" />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ColorSwatches({ value, colors, onChange }: { value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={`size-8 rounded-full transition-transform ${value === color ? "scale-110 ring-2 ring-ink ring-offset-2" : ""}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
