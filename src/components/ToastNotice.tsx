import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Toast } from "../state";

export function ToastNotice({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const element = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    let gesture: { id: number; x: number; y: number; axis: "x" | "y" | null } | null = null;
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        gesture = null;
        setDragging(false);
        setOffset(0);
        return;
      }
      const rect = element.current?.getBoundingClientRect();
      const touch = event.touches[0];
      if (!rect || touch.clientX < rect.left || touch.clientX > rect.right || touch.clientY < rect.top || touch.clientY > rect.bottom) return;
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, axis: null };
    };
    const move = (event: TouchEvent) => {
      const touch = Array.from(event.touches).find((item) => item.identifier === gesture?.id);
      if (!gesture || !touch) return;
      const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
      if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 8) gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (gesture.axis !== "x") return;
      if (event.cancelable) event.preventDefault();
      setDragging(true);
      setOffset(dx);
    };
    const end = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === gesture?.id);
      if (!gesture || !touch) return;
      const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
      const horizontal = gesture.axis === "x" || (!gesture.axis && Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy));
      if (event.type === "touchend" && horizontal && event.cancelable) event.preventDefault();
      if (event.type === "touchend" && horizontal && Math.abs(dx) >= 64) onDismiss();
      gesture = null;
      setDragging(false);
      setOffset(0);
    };
    // Consume horizontal swipes only; ordinary taps still reach the page underneath.
    const options = { passive: true, capture: true };
    document.addEventListener("touchstart", start, options);
    document.addEventListener("touchmove", move, { passive: false, capture: true });
    document.addEventListener("touchend", end, { passive: false, capture: true });
    document.addEventListener("touchcancel", end, options);
    return () => {
      document.removeEventListener("touchstart", start, true);
      document.removeEventListener("touchmove", move, true);
      document.removeEventListener("touchend", end, true);
      document.removeEventListener("touchcancel", end, true);
    };
  }, [onDismiss]);

  return <div ref={element} role="status"
    className={`pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[90] mx-auto flex max-w-xl items-center gap-4 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg ${dragging ? "" : "transition-[transform,opacity] duration-200"}`}
    style={{ transform: `translateX(${offset}px)`, opacity: Math.max(0, 1 - Math.abs(offset) / (element.current?.offsetWidth || 400)) }}>
    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{toast.message}</span>
    {toast.action && <button type="button" className="pointer-events-auto min-h-11 shrink-0 rounded-lg px-2 font-bold text-orange hover:underline"
      onClick={() => { onDismiss(); toast.action?.run(); }}>{toast.action.label}</button>}
    <button type="button" aria-label="Fechar notificação"
      className="pointer-events-auto hidden size-11 shrink-0 place-items-center rounded-xl text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-orange [@media(hover:hover)]:grid"
      onClick={onDismiss}><X size={20} aria-hidden="true" /></button>
  </div>;
}
