import type { ReactNode } from "react";

export interface DonutSlice {
  key: string;
  value: number;
  color: string;
}

/** Lightweight SVG donut chart; slices are drawn with stroke-dasharray on one circle each. */
export function Donut({ slices, children, size = 168 }: { slices: DonutSlice[]; children?: ReactNode; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = 15.9155; // circumference = 100
  let offset = 25;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" className="size-full" role="img" aria-label="Gráfico de gastos por categoria">
        <circle cx="21" cy="21" r={radius} fill="none" stroke="#F2E8DF" strokeWidth="6" />
        {total > 0 &&
          slices.map((slice) => {
            const pct = (slice.value / total) * 100;
            const gap = slices.length > 1 ? Math.min(0.8, pct / 3) : 0;
            const dash = `${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}`;
            const element = (
              <circle
                key={slice.key}
                cx="21"
                cy="21"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="6"
                strokeDasharray={dash}
                strokeDashoffset={offset}
              />
            );
            offset -= pct;
            return element;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
