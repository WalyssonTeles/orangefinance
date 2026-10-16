import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { currentMonth, monthLabel, shiftMonth, yearPage } from "../lib/dates";
import { Button, IconButton } from "./ui";

export function MonthPicker({ month, onChange, className = "" }: {
  month: string; onChange: (month: string) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"months" | "years">("months");
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const [pageEnd, setPageEnd] = useState(new Date().getFullYear());
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const years = yearPage(pageEnd);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current!.getBoundingClientRect();
      setPosition({
        left: Math.max(16, Math.min(rect.right - 360, window.innerWidth - 376)),
        top: Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - (panel.current?.getBoundingClientRect().height ?? 400) - 16)),
      });
    };
    place();
    panel.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("resize", place);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", place);
      document.removeEventListener("keydown", onKey);
      trigger.current?.focus();
    };
  }, [open]);

  return (
    <div ref={anchor} className={`inline-flex h-11 min-w-0 items-center rounded-xl border border-line bg-surface ${className}`}>
      <IconButton label="Mês anterior" onClick={() => onChange(shiftMonth(month, -1))}><ChevronLeft size={18} /></IconButton>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const selectedYear = Number(month.slice(0, 4));
          setYear(selectedYear);
          setPageEnd(yearPage(selectedYear).at(-1)!);
          setView("months");
          setOpen(true);
        }}
        className="h-full min-w-0 flex-1 px-2 text-center text-[0.95rem] font-semibold sm:min-w-[9.5rem]"
      >{monthLabel(month)}</button>
      <IconButton label="Próximo mês" onClick={() => onChange(shiftMonth(month, 1))}><ChevronRight size={18} /></IconButton>
      {open && createPortal(
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-ink/30 sm:bg-transparent" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Selecionar mês e ano"
            tabIndex={-1}
            style={{ "--picker-top": `${position.top}px`, "--picker-left": `${position.left}px` } as CSSProperties}
            className="absolute inset-0 flex flex-col overflow-y-auto bg-surface p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:inset-auto sm:top-[var(--picker-top)] sm:left-[var(--picker-left)] sm:max-h-[calc(100dvh-2rem)] sm:w-[360px] sm:rounded-2xl sm:border sm:border-line sm:p-4 sm:shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Selecionar período</h2>
              <IconButton label="Fechar seletor de data" onClick={() => setOpen(false)}><X size={20} /></IconButton>
            </div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <IconButton label={view === "months" ? "Ano anterior" : "12 anos anteriores"} onClick={() => view === "months" ? setYear(year - 1) : setPageEnd(pageEnd - 12)}><ChevronLeft size={20} /></IconButton>
              {view === "months" ? (
                <button type="button" className="min-h-11 flex-1 rounded-xl font-bold hover:bg-orange-soft" aria-label={`Selecionar ano, ${year}`} onClick={() => { setPageEnd(yearPage(year).at(-1)!); setView("years"); }}>{year}</button>
              ) : <h3 className="font-bold" aria-live="polite">{years[0]} – {years.at(-1)}</h3>}
              <IconButton label={view === "months" ? "Próximo ano" : "Próximos 12 anos"} onClick={() => view === "months" ? setYear(year + 1) : setPageEnd(pageEnd + 12)}><ChevronRight size={20} /></IconButton>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(view === "months" ? Array.from({ length: 12 }, (_, i) => i + 1) : years).map((value) => {
                const candidate = `${year}-${String(value).padStart(2, "0")}`;
                const active = view === "months" ? candidate === month : value === year;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    className={`min-h-14 rounded-xl px-1 text-sm font-semibold transition-colors ${active ? "bg-brand text-white" : "bg-cream hover:bg-orange-soft"}`}
                    onClick={() => {
                      if (view === "years") { setYear(value); setView("months"); }
                      else { onChange(candidate); setOpen(false); }
                    }}
                  >{view === "months" ? monthLabel(candidate, false) : value}</button>
                );
              })}
            </div>
            <Button variant="secondary" className="mt-4 w-full" onClick={() => { onChange(currentMonth()); setOpen(false); }}>Mês atual</Button>
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
