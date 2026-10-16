import { Check, ChevronDown, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { navigate } from "../lib/router";
import { useSync } from "../sync-context";

export function SpaceSwitcher() {
  const sync = useSync();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!sync.bound || !sync.activeSpace) return null;
  const label = (kind: string, name: string) => (kind === "personal" ? "Pessoal" : name);
  const disabled = sync.busy || sync.syncing;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-1 rounded-full bg-orange-soft px-3 py-1 text-sm font-semibold text-brand-ink transition-colors hover:bg-orange-soft-hover"
      >
        <span className="truncate">{label(sync.activeSpace.kind, sync.activeSpace.name)}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="fade-in absolute left-0 z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
          {sync.spaces.map((space) => {
            const active = space.id === sync.activeSpace?.id;
            return (
              <button
                key={space.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={disabled}
                onClick={async () => {
                  setOpen(false);
                  if (!active) await sync.switchSpace(space.id);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-cream disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label(space.kind, space.name)}</span>
                  <span className="block text-xs font-normal text-muted">{space.kind === "personal" ? "Só você" : "Compartilhado"}</span>
                </span>
                {active && <Check size={16} className="shrink-0 text-brand-ink" />}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("ajustes", "compartilhado");
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-line px-3 py-2.5 text-left text-sm font-semibold text-brand-ink hover:bg-cream"
          >
            <Settings2 size={16} /> Gerenciar espaços
          </button>
        </div>
      )}
    </div>
  );
}
