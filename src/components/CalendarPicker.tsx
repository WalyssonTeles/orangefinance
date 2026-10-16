import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { addDays, addMonths, calendarDays, currentMonth, isISODate, monthLabel, parseISODate, shiftMonth, shortMonthLabel, todayISO, yearPage } from "../lib/dates";
import { Button, IconButton, inputClass } from "./ui";

export function MonthPicker({ month, onChange, className = "" }: {
  month: string; onChange: (month: string) => void; className?: string;
}) {
  return <CalendarPicker mode="month" value={month} onChange={onChange} className={className} />;
}

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DatePicker(props: DatePickerProps) {
  return <CalendarPicker mode="date" {...props} />;
}

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

function CalendarPicker({ mode, value, onChange, className = "", label, min = "1000-01-01", max = "9999-12-31", required = false, disabled = false }: {
  mode: "month" | "date";
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const dateMode = mode === "date";
  const id = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months" | "years">(dateMode ? "days" : "months");
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const year = Number(visibleMonth.slice(0, 4));
  const [pageEnd, setPageEnd] = useState(new Date().getFullYear());
  const [focusedDate, setFocusedDate] = useState(todayISO);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusGrid = useRef(false);
  const years = yearPage(pageEnd);
  const today = todayISO();
  const monthEnabled = (candidate: string) => /^\d{4}-\d{2}$/.test(candidate) && candidate >= min.slice(0, 7) && candidate <= max.slice(0, 7);
  const yearEnabled = (candidate: number) => candidate >= Number(min.slice(0, 4)) && candidate <= Number(max.slice(0, 4));
  const dateEnabled = (candidate: string) => candidate >= min && candidate <= max;
  const choose = (candidate: string) => { onChange(candidate); setOpen(false); };
  const changeMonth = (candidate: string) => {
    setVisibleMonth(candidate);
    const delta = (Number(candidate.slice(0, 4)) - Number(focusedDate.slice(0, 4))) * 12 + Number(candidate.slice(5, 7)) - Number(focusedDate.slice(5, 7));
    const next = addMonths(focusedDate, delta);
    setFocusedDate(next < min ? min : next > max ? max : next);
  };
  const show = () => {
    const initial = dateMode ? currentMonth() : value;
    const month = initial < min.slice(0, 7) ? min.slice(0, 7) : initial > max.slice(0, 7) ? max.slice(0, 7) : initial;
    setVisibleMonth(month);
    setPageEnd(yearPage(Number(month.slice(0, 4))).at(-1)!);
    const selected = isISODate(value) && value.slice(0, 7) === month ? value : `${month}-${today.slice(-2)}`;
    const initialDate = isISODate(selected) ? selected : `${month}-01`;
    setFocusedDate(initialDate < min ? min : initialDate > max ? max : initialDate);
    setView(dateMode ? "days" : "months");
    focusGrid.current = dateMode;
    setOpen(true);
  };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const button = trigger.current;
    const parentDialog = button?.closest("[role='dialog']");
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect || button?.matches(":disabled") || !rect.width || !rect.height) { setOpen(false); return; }
      setPosition({
        left: Math.max(16, Math.min(rect.right - 360, window.innerWidth - 376)),
        top: Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - (panel.current?.getBoundingClientRect().height ?? 400) - 16)),
      });
    };
    place();
    if (!dateMode) panel.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const size = new ResizeObserver(place);
    if (panel.current) size.observe(panel.current);
    if (anchor.current) size.observe(anchor.current);
    const disabledObserver = new MutationObserver(place);
    let fieldset = button?.closest("fieldset");
    while (fieldset) {
      disabledObserver.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
      fieldset = fieldset.parentElement?.closest("fieldset") ?? null;
    }
    window.addEventListener("resize", place);
    return () => {
      document.body.style.overflow = parentDialog && !parentDialog.isConnected ? "" : previousOverflow;
      window.removeEventListener("resize", place);
      size.disconnect();
      disabledObserver.disconnect();
      if (button?.isConnected) button.focus({ preventScroll: true });
    };
  }, [open, dateMode]);

  useLayoutEffect(() => {
    if (!open || !focusGrid.current) return;
    focusGrid.current = false;
    (panel.current?.querySelector<HTMLButtonElement>("[data-calendar-focus='true']:not(:disabled)") ?? panel.current)?.focus({ preventScroll: true });
  });

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    if (event.key !== "Tab") return;
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled):not([tabindex='-1'])");
    if (!buttons?.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
      event.preventDefault(); first.focus();
    }
  };
  const navigate = (delta: number) => {
    if (view === "years") setPageEnd(pageEnd + delta * 12);
    else changeMonth(shiftMonth(visibleMonth, delta * (view === "days" ? 1 : 12)));
  };
  const canNavigate = (delta: number) => view === "years"
    ? years[0] + delta * 12 <= Number(max.slice(0, 4)) && years[11] + delta * 12 >= Number(min.slice(0, 4))
    : view === "days" ? monthEnabled(shiftMonth(visibleMonth, delta)) : yearEnabled(year + delta);
  const days = view === "days" ? calendarDays(visibleMonth) : [];

  return (
    <div ref={anchor} className={dateMode ? `min-w-0 ${className}` : `inline-flex h-11 min-w-0 items-center rounded-xl border border-line bg-surface ${className}`}>
      {!dateMode && <IconButton label="Mês anterior" onClick={() => onChange(shiftMonth(value, -1))}><ChevronLeft size={18} /></IconButton>}
      <button ref={trigger} type="button" role={dateMode ? "combobox" : undefined} aria-label={dateMode ? label : undefined}
        aria-required={dateMode ? required : undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-calendar` : undefined}
        disabled={disabled} onClick={show}
        className={dateMode ? `${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-40` : "h-full min-w-0 flex-1 px-2 text-center text-[0.95rem] font-semibold sm:min-w-[9.5rem]"}>
        {dateMode ? <><span className={value ? "" : "text-muted"}>{value ? value.split("-").reverse().join("/") : "DD/MM/AAAA"}</span><CalendarDays size={18} className="shrink-0 text-muted" aria-hidden="true" /></> : monthLabel(value)}
      </button>
      {!dateMode && <IconButton label="Próximo mês" onClick={() => onChange(shiftMonth(value, 1))}><ChevronRight size={18} /></IconButton>}
      {open && createPortal(
        <div className="fixed inset-0 z-[60]" onKeyDown={onKey}>
          <div className="absolute inset-0 bg-ink/30 sm:bg-transparent" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panel}
            id={`${id}-calendar`}
            role="dialog"
            aria-modal="true"
            aria-label={dateMode ? "Selecionar data" : "Selecionar mês e ano"}
            tabIndex={-1}
            style={{ "--picker-top": `${position.top}px`, "--picker-left": `${position.left}px` } as CSSProperties}
            className="absolute inset-0 flex flex-col overflow-y-auto bg-surface p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:inset-auto sm:top-[var(--picker-top)] sm:left-[var(--picker-left)] sm:max-h-[calc(100dvh-2rem)] sm:w-[360px] sm:rounded-2xl sm:border sm:border-line sm:p-4 sm:shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{dateMode ? "Selecionar data" : "Selecionar período"}</h2>
              <IconButton label={dateMode ? "Fechar calendário" : "Fechar seletor de data"} onClick={() => setOpen(false)}><X size={20} /></IconButton>
            </div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <IconButton label={view === "days" ? "Mês anterior" : view === "months" ? "Ano anterior" : "12 anos anteriores"} className="disabled:pointer-events-none disabled:opacity-30" disabled={!canNavigate(-1)} onClick={() => navigate(-1)}><ChevronLeft size={20} /></IconButton>
              {view !== "years" ? (
                <button type="button" className="min-h-11 flex-1 rounded-xl font-bold hover:bg-orange-soft"
                  aria-label={view === "days" ? `Selecionar mês, ${monthLabel(visibleMonth)}` : `Selecionar ano, ${year}`}
                  onClick={() => { focusGrid.current = true; if (view === "days") setView("months"); else { setPageEnd(yearPage(year).at(-1)!); setView("years"); } }}>
                  {view === "days" ? monthLabel(visibleMonth) : year}
                </button>
              ) : <h3 className="font-bold" aria-live="polite">{years[0]} – {years.at(-1)}</h3>}
              <IconButton label={view === "days" ? "Próximo mês" : view === "months" ? "Próximo ano" : "Próximos 12 anos"} className="disabled:pointer-events-none disabled:opacity-30" disabled={!canNavigate(1)} onClick={() => navigate(1)}><ChevronRight size={20} /></IconButton>
            </div>
            {view === "days" ? <table role="grid" aria-label={monthLabel(visibleMonth)} className="w-full table-fixed border-separate border-spacing-1">
              <thead><tr>{WEEKDAYS.map((name, index) => <th key={name} scope="col" aria-label={name} className="h-8 text-center text-xs font-semibold text-muted"><span aria-hidden="true">{INITIALS[index]}</span></th>)}</tr></thead>
              <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((date, column) => {
                const selected = date === value;
                return <td key={date ?? column} role="gridcell" aria-selected={selected} className="p-0">
                  {date && <button type="button" disabled={!dateEnabled(date)} tabIndex={date === focusedDate ? 0 : -1} data-calendar-focus={date === focusedDate}
                    aria-label={parseISODate(date).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })} aria-current={date === today ? "date" : undefined}
                    className={`h-11 w-full rounded-xl text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange disabled:cursor-not-allowed disabled:opacity-30 ${selected ? "bg-brand text-white" : `${date.slice(0, 7) === visibleMonth ? "text-ink" : "text-muted/60"} hover:bg-orange-soft ${date === today ? "ring-1 ring-orange" : ""}`}`}
                    onClick={() => choose(date)}
                    onKeyDown={(event) => {
                      const weekday = parseISODate(date).getDay();
                      const moves: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
                      const delta = moves[event.key];
                      const next = delta !== undefined ? addDays(date, delta) : event.key === "PageUp" || event.key === "PageDown" ? addMonths(date, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1)) : null;
                      if (!next) return;
                      event.preventDefault();
                      if (!isISODate(next) || !dateEnabled(next)) return;
                      focusGrid.current = true;
                      setFocusedDate(next);
                      setVisibleMonth(next.slice(0, 7));
                    }}>{Number(date.slice(-2))}</button>}
                </td>;
              })}</tr>)}</tbody>
            </table> : <div className="grid grid-cols-4 gap-2">
              {(view === "months" ? Array.from({ length: 12 }, (_, i) => i + 1) : years).map((item) => {
                const candidate = `${year}-${String(item).padStart(2, "0")}`;
                const active = view === "months" ? candidate === (dateMode ? visibleMonth : value) : item === year;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    data-calendar-focus={view === "months" ? item === Number(visibleMonth.slice(5, 7)) : item === year}
                    disabled={view === "months" ? !monthEnabled(candidate) : !yearEnabled(item)}
                    className={`min-h-14 rounded-xl px-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${active ? "bg-brand text-white" : "bg-cream hover:bg-orange-soft"}`}
                    onClick={() => {
                      focusGrid.current = true;
                      if (view === "years") { changeMonth(`${item}-${visibleMonth.slice(5, 7)}`); setView("months"); }
                      else if (dateMode) { changeMonth(candidate); setView("days"); }
                      else choose(candidate);
                    }}
                  >{view === "months" ? dateMode ? shortMonthLabel(candidate).toUpperCase() : monthLabel(candidate, false) : item}</button>
                );
              })}
            </div>}
            <div className="mt-4 flex gap-2">
              {dateMode && !required && <Button variant="ghost" disabled={!value} onClick={() => choose("")}>Limpar</Button>}
              <Button variant="secondary" className="w-full" disabled={dateMode && !dateEnabled(today)} onClick={() => choose(dateMode ? today : currentMonth())}>{dateMode ? "Hoje" : "Mês atual"}</Button>
            </div>
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
