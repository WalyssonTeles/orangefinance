import { ArrowLeftRight, Check, Clock, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import type { Transaction } from "../lib/db";
import { todayISO } from "../lib/dates";
import { deleteTransaction, restoreTransactions, setPaid, type SeriesScope } from "../lib/repo";
import { useApp } from "../state";
import { categoryIcon, ColorIcon } from "./icons";
import { Modal } from "./Modal";
import { Money } from "./Money";
import { Button } from "./ui";

const DRAWER = 136;
const OPEN_EVENT = "orange:row-open";

export function TransactionRow({ tx, showDate }: { tx: Transaction; showDate?: string }) {
  const { data, openTransaction, notify, memberById, sharedSpace } = useApp();
  const rowId = useId();
  const [offset, setOffset] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const offsetRef = useRef(0);
  const drag = useRef<{ x: number; y: number; start: number; axis: "x" | "y" | null } | null>(null);
  const swipedAt = useRef(0);

  const category = tx.categoryId ? data.categoryById.get(tx.categoryId) : undefined;
  const account = data.accountById.get(tx.accountId);
  const target = tx.toAccountId ? data.accountById.get(tx.toAccountId) : undefined;
  const isTransfer = tx.type === "transfer";
  const overdue = !tx.paid && tx.date < todayISO();
  const open = offset !== 0;

  const holder = sharedSpace && tx.holderId ? memberById.get(tx.holderId)?.name ?? "Ex-participante" : null;
  const title = tx.description || (isTransfer ? "Transferência" : category?.name ?? "Sem categoria");
  const details = isTransfer
    ? `${account?.name ?? "Conta removida"} → ${target?.name ?? "Conta removida"}`
    : [holder, category?.name ?? "Sem categoria", account?.name].filter(Boolean).join(" · ");
  const series = tx.installments ? `${tx.installment}/${tx.installments}` : tx.groupId ? "Mensal" : null;
  const statusLabel = tx.paid ? (tx.type === "income" ? "Recebido" : isTransfer ? "Feita" : "Pago") : overdue ? "Atrasado" : "Pendente";
  const toggleLabel = tx.paid ? "Marcar como pendente" : tx.type === "income" ? "Marcar como recebido" : "Marcar como pago";

  const moveTo = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  useEffect(() => {
    const onOtherOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== rowId) moveTo(0);
    };
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpen);
  }, [rowId]);

  const togglePaid = async () => {
    moveTo(0);
    const next = !tx.paid;
    await setPaid(tx.id, next);
    notify(next ? (tx.type === "income" ? "Marcado como recebido." : "Marcado como pago.") : "Marcado como pendente.", {
      label: "Desfazer",
      run: () => void setPaid(tx.id, !next),
    });
  };

  const remove = async (scope: SeriesScope) => {
    setConfirmDelete(false);
    moveTo(0);
    const ids = await deleteTransaction(tx.id, scope);
    notify(ids.length > 1 ? `${ids.length} lançamentos excluídos.` : "Lançamento excluído.", {
      label: "Desfazer",
      run: () => void restoreTransactions(ids),
    });
  };

  const requestDelete = () => (tx.groupId ? setConfirmDelete(true) : void remove("one"));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, start: offsetRef.current, axis: null };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = e.clientX - state.x;
    const dy = e.clientY - state.y;
    if (state.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "x") {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Capture is an enhancement; swiping still works without it.
        }
      }
    }
    if (state.axis !== "x") return;
    moveTo(Math.max(-DRAWER, Math.min(0, state.start + dx)));
  };

  const onPointerEnd = () => {
    const state = drag.current;
    drag.current = null;
    if (!state || state.axis !== "x") return;
    // Ignore only the click the browser may synthesize right after the swipe, not later taps.
    swipedAt.current = Date.now();
    const reveal = offsetRef.current < -DRAWER / 2;
    moveTo(reveal ? -DRAWER : 0);
    if (reveal) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: rowId }));
  };

  const onRowClick = () => {
    if (Date.now() - swipedAt.current < 350) return;
    if (open) return moveTo(0);
    openTransaction({ id: tx.id });
  };

  const actionButton = "grid size-9 place-items-center rounded-xl transition-colors";

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Touch drawer revealed by swiping left. */}
      <div className="absolute inset-y-0 right-0 flex [@media(hover:hover)]:hidden" style={{ width: DRAWER }} aria-hidden={!open}>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={togglePaid}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-white ${tx.paid ? "bg-brand" : "bg-positive"}`}
        >
          {tx.paid ? <Clock size={20} /> : <Check size={20} strokeWidth={3} />}
          {tx.paid ? "Pendente" : tx.type === "income" ? "Recebido" : "Pago"}
        </button>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={requestDelete}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-negative text-xs font-semibold text-white"
        >
          <Trash2 size={20} />
          Excluir
        </button>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        className={`group relative flex touch-pan-y items-center bg-surface ${drag.current ? "" : "transition-transform duration-200"}`}
      >
        <button
          type="button"
          onClick={onRowClick}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-cream"
          aria-label={`${title}, ${statusLabel}. Abrir lançamento`}
        >
          {isTransfer ? (
            <ColorIcon icon={ArrowLeftRight} color="#70665E" />
          ) : (
            <ColorIcon icon={categoryIcon(category?.icon)} color={category?.color ?? "#868E96"} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{title}</span>
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <span className="truncate">{showDate ? `${showDate} · ${details}` : details}</span>
              {series && <span className="shrink-0 rounded-md bg-ink/6 px-1.5 text-xs font-semibold">{series}</span>}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <Money
              cents={tx.type === "expense" ? -tx.amount : tx.amount}
              signed={!isTransfer}
              className={`font-semibold ${tx.type === "income" ? "text-positive" : isTransfer ? "text-muted" : "text-ink"}`}
            />
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 text-xs font-semibold ${
                tx.paid ? "bg-positive/12 text-positive" : "bg-negative/12 text-negative"
              }`}
            >
              {tx.paid ? <Check size={12} strokeWidth={3} /> : <Clock size={12} strokeWidth={2.5} />}
              {statusLabel}
            </span>
          </span>
        </button>

        {/* Pointer devices: actions appear on hover or keyboard focus. */}
        <div className="flex w-0 shrink-0 items-center gap-1 overflow-hidden opacity-0 transition-opacity group-focus-within:w-auto group-focus-within:pl-1 group-focus-within:opacity-100 group-hover:w-auto group-hover:pl-1 group-hover:opacity-100 [@media(hover:none)]:hidden">
          <button
            type="button"
            onClick={togglePaid}
            title={toggleLabel}
            aria-label={`${toggleLabel}: ${title}`}
            className={`${actionButton} ${tx.paid ? "text-brand-ink hover:bg-orange-soft" : "text-positive hover:bg-positive/12"}`}
          >
            {tx.paid ? <Clock size={18} /> : <Check size={18} strokeWidth={3} />}
          </button>
          <button
            type="button"
            onClick={requestDelete}
            title="Excluir"
            aria-label={`Excluir ${title}`}
            className={`${actionButton} text-negative hover:bg-negative/12`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <Modal
          open
          title="Excluir lançamento?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void remove("one")}>
                Só este
              </Button>
              <Button variant="danger" onClick={() => void remove("following")}>
                Este e os próximos
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted">“{title}” faz parte de uma série. Você poderá desfazer logo após excluir.</p>
        </Modal>
      )}
    </div>
  );
}
