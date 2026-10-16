import { closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Account } from "../lib/db";

function SortableAccount({ account, children, disabled }: { account: Account; children: ReactNode; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseDown={(event) => listeners?.onMouseDown?.(event)} onTouchStart={(event) => listeners?.onTouchStart?.(event)}
      className={`relative min-w-0 ${isDragging ? "rounded-2xl bg-orange-soft/30 outline-2 outline-dashed outline-orange/40" : ""}`}>
      <div className={`h-full [&>button]:w-full ${isDragging ? "invisible" : ""}`}>{children}</div>
      <button type="button" {...attributes} {...listeners} aria-label={`Reordenar ${account.name}. Segure para arrastar ou use as setas do teclado.`}
        className={`absolute top-2 right-2 z-10 grid size-8 touch-none place-items-center rounded-lg bg-surface/90 text-muted hover:bg-orange-soft ${isDragging ? "opacity-0" : ""}`}><GripVertical size={18} /></button>
    </div>
  );
}

export function SortableAccounts({ accounts, onReorder, render, className = "" }: {
  accounts: Account[];
  onReorder: (ids: string[]) => Promise<void>;
  render: (account: Account) => ReactNode;
  className?: string;
}) {
  const [order, setOrder] = useState(accounts.map((account) => account.id));
  const [active, setActive] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const suppressedUntil = useRef(0);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(() => { if (!active && !saving) setOrder(accounts.map((account) => account.id)); }, [accounts, active, saving]);
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const dragged = active ? byId.get(active) : undefined;
  return (
    <div onClickCapture={(event) => { if (active || Date.now() < suppressedUntil.current) { event.preventDefault(); event.stopPropagation(); } }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={({ active: item }) => { if (!saving) setActive(String(item.id)); }}
        onDragOver={({ active: item, over }) => {
          if (!over || saving || item.id === over.id) return;
          setOrder((previous) => arrayMove(previous, previous.indexOf(String(item.id)), previous.indexOf(String(over.id))));
        }}
        onDragCancel={() => { setActive(null); setOrder(accounts.map((account) => account.id)); suppressedUntil.current = Date.now() + 350; }}
        onDragEnd={() => {
          setActive(null);
          suppressedUntil.current = Date.now() + 350;
          setSaving(true);
          void onReorder(order).finally(() => setSaving(false));
        }}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
            {order.map((id) => { const account = byId.get(id); return account ? <SortableAccount key={id} account={account} disabled={saving}>{render(account)}</SortableAccount> : null; })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 250, easing: "ease" }}>
          {dragged && <div className="pointer-events-none scale-[1.025] rounded-2xl shadow-2xl [&>button]:w-full">{render(dragged)}</div>}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
