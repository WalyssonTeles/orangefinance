import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export const dropdownOptionClass = "flex h-11 shrink-0 cursor-pointer items-center gap-2 px-3 text-left hover:bg-orange-soft";

export function DropdownMenu({ anchor, id, label, count, active, onDismiss, children }: {
  anchor: RefObject<HTMLElement | null>;
  id: string;
  label: string;
  count: number;
  active: number;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const menu = useRef<HTMLUListElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number; font: string } | null>(null);

  useLayoutEffect(() => {
    const trigger = anchor.current;
    if (!trigger) return;
    if (window.innerHeight - trigger.getBoundingClientRect().bottom < 54) {
      trigger.scrollIntoView({ block: "center", behavior: "instant" });
    }
    const measure = () => {
      const rect = trigger.getBoundingClientRect();
      if (!trigger.isConnected || trigger.matches(":disabled") || rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        dismiss.current();
        return;
      }
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: rect.width,
        maxHeight: Math.min(178, Math.max(46, window.innerHeight - rect.bottom - 12)),
        font: getComputedStyle(trigger).font,
      });
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !trigger.contains(event.target) && !menu.current?.contains(event.target)) dismiss.current();
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) measure();
    };
    measure();
    const size = new ResizeObserver(measure);
    size.observe(trigger);
    const disabled = new MutationObserver(measure);
    let fieldset = trigger.closest("fieldset");
    while (fieldset) {
      disabled.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
      fieldset = fieldset.parentElement?.closest("fieldset") ?? null;
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", scroll, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("click", outside, true);
    document.addEventListener("focusin", outside);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", scroll, true);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("click", outside, true);
      document.removeEventListener("focusin", outside);
      size.disconnect();
      disabled.disconnect();
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const list = menu.current;
    const option = list?.children.item(active);
    if (!list || !(option instanceof HTMLElement)) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [active, count, position]);

  return position && createPortal(
    <ul ref={menu} id={id} role="listbox" aria-label={label}
      className="fixed z-[80] overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface text-ink shadow-lg"
      style={position}
      onPointerDown={(event) => event.preventDefault()}>
      {children}
    </ul>, document.body,
  );
}
