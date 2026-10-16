import { useId, useMemo, useRef, useState } from "react";
import { descriptionSuggestions } from "../lib/finance";
import { useApp } from "../state";
import { DropdownMenu, dropdownOptionClass } from "./DropdownMenu";
import { inputClass } from "./ui";

export function DescriptionInput({ value, onChange, placeholder, label = "Descrição", additionalDescriptions = [] }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string; additionalDescriptions?: readonly string[] }) {
  const { data } = useApp();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useMemo(() => {
    if (!focused || !value.trim()) return [];
    return descriptionSuggestions(value, [...additionalDescriptions, ...data.transactions.filter((tx) => tx.type === "expense").map((tx) => tx.description)]);
  }, [value, focused, data.transactions, additionalDescriptions]);
  const open = focused && suggestions.length > 0;
  const choose = (description: string) => { onChange(description); setFocused(false); setActive(-1); };
  return (
    <div className="relative">
      <input ref={input} className={inputClass} value={value} maxLength={80} placeholder={placeholder} autoComplete="off" aria-label={label}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        onFocus={() => setFocused(true)}
        onChange={(event) => { onChange(event.target.value); setFocused(true); setActive(-1); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setFocused(false); }
          if (event.key === "Tab") { setFocused(false); setActive(-1); }
          if (!open) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive((previous) => event.key === "ArrowDown" ? Math.min(previous + 1, suggestions.length - 1) : Math.max(previous - 1, 0));
          }
          if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(suggestions[active]); }
        }} />
      {open && <DropdownMenu anchor={input} id={`${id}-list`} label="Descrições já utilizadas" count={suggestions.length} active={active} onDismiss={() => { setFocused(false); setActive(-1); }}>
        {suggestions.map((description, index) => <li key={description} id={`${id}-${index}`} role="option" aria-selected={active === index}
          onClick={() => choose(description)}
          className={`${dropdownOptionClass} ${active === index ? "bg-orange-soft" : ""}`}><span className="truncate">{description}</span></li>)}
      </DropdownMenu>}
    </div>
  );
}
