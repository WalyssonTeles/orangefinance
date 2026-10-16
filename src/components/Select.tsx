import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { normalize } from "../lib/finance";
import { DropdownMenu, dropdownOptionClass } from "./DropdownMenu";
import { inputClass } from "./ui";

interface SelectOption { value: string; label: string }

export function Select({ label, value, onChange, options, disabled = false, className = "", fitOptions = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  disabled?: boolean;
  className?: string;
  fitOptions?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActive] = useState(-1);
  const active = Math.min(activeIndex, options.length - 1);
  useEffect(() => { if (disabled || options.length === 0) setOpen(false); }, [disabled, options.length]);
  const selected = options.findIndex((option) => option.value === value);
  const show = (last = false) => {
    trigger.current?.focus({ preventScroll: true });
    setActive(selected >= 0 ? selected : last ? options.length - 1 : 0);
    search.current.text = "";
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  return <>
    <button ref={trigger} type="button" role="combobox" aria-label={label}
      aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
      disabled={disabled || options.length === 0}
      className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={(event) => {
        if (event.key === "Tab") { setOpen(false); return; }
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) show(event.key === "ArrowUp");
          else setActive((active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        } else if ((event.key === "Home" || event.key === "End") && open) {
          event.preventDefault();
          setActive(event.key === "Home" ? 0 : options.length - 1);
        } else if (event.key === "Enter" || (event.key === " " && (!search.current.text || Date.now() - search.current.time > 700))) {
          event.preventDefault();
          if (open) choose(active);
          else show();
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          const now = Date.now();
          const character = normalize(event.key);
          search.current.text = now - search.current.time > 700 ? character : search.current.text + character;
          search.current.time = now;
          const text = [...search.current.text].every((letter) => letter === character) ? character : search.current.text;
          const start = text.length === 1 ? (open ? active : selected) + 1 : 0;
          const match = options.findIndex((_, offset) => normalize(options[(start + offset) % options.length].label).startsWith(text));
          if (match >= 0) {
            const index = (start + match) % options.length;
            if (open) setActive(index);
            else onChange(options[index].value);
          }
        }
      }}>
      <span className="min-w-0 truncate">{options[selected]?.label ?? "Selecione"}</span>
      <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
    {open && <DropdownMenu anchor={trigger} id={`${id}-list`} label={label} count={options.length} active={active} fitOptions={fitOptions} onDismiss={() => setOpen(false)}>
      {options.map((option, index) => <li key={option.value} id={`${id}-${index}`} role="option" aria-selected={value === option.value}
        className={`${dropdownOptionClass} ${active === index ? "bg-orange-soft" : ""}`}
        onPointerMove={(event) => { if (event.pointerType === "mouse") setActive(index); }}
        onClick={() => choose(index)}>
        <span data-option-label className="min-w-0 flex-1 truncate">{option.label}</span>
        {value === option.value && <Check size={16} className="shrink-0 text-orange" aria-hidden="true" />}
      </li>)}
    </DropdownMenu>}
  </>;
}
