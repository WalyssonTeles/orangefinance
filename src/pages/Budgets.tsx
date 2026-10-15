import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BudgetForm } from "../components/forms";
import { categoryIcon, ColorIcon } from "../components/icons";
import { Money } from "../components/Money";
import { Button, Card, EmptyState, MonthPicker, PageHeader, ProgressBar } from "../components/ui";
import type { Budget } from "../lib/db";
import { budgetProgress, budgetStatus, totalsByCategory } from "../lib/finance";
import { useApp } from "../state";

export function Budgets() {
  const { data, month, setMonth } = useApp();
  const [editing, setEditing] = useState<Budget | "new" | null>(null);

  const { items, planned, spent, unbudgeted } = useMemo(() => {
    const items = budgetProgress(data.budgets, data.transactions, month);
    const budgeted = new Set(data.budgets.map((b) => b.categoryId));
    const unbudgeted = totalsByCategory(data.transactions, month)
      .filter((t) => !t.categoryId || !budgeted.has(t.categoryId))
      .reduce((sum, t) => sum + t.total, 0);
    return {
      items,
      planned: items.reduce((sum, i) => sum + i.budget.amount, 0),
      spent: items.reduce((sum, i) => sum + i.spent, 0),
      unbudgeted,
    };
  }, [data.budgets, data.transactions, month]);

  const ratio = planned ? spent / planned : 0;

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        subtitle="Limites mensais por categoria de despesa."
        actions={
          <>
            <MonthPicker month={month} onChange={setMonth} />
            <Button onClick={() => setEditing("new")}>
              <Plus size={18} /> Novo
            </Button>
          </>
        }
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum orçamento ainda"
            text="Defina quanto quer gastar por mês em cada categoria. O app avisa quando você chegar perto do limite."
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus size={18} /> Criar orçamento
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <div className="grid gap-1.5 min-[400px]:grid-cols-3 min-[400px]:gap-2 sm:gap-3 [&>div]:flex [&>div]:min-w-0 [&>div]:items-baseline [&>div]:justify-between [&>div]:gap-2 min-[400px]:[&>div]:block">
              <div>
                <p className="text-sm text-muted">Planejado</p>
                <Money fit cents={planned} className="font-display text-[0.95rem] font-bold min-[400px]:text-base sm:text-xl" />
              </div>
              <div>
                <p className="text-sm text-muted">Gasto</p>
                <Money fit cents={spent} className="font-display text-[0.95rem] font-bold min-[400px]:text-base sm:text-xl" />
              </div>
              <div>
                <p className="text-sm text-muted">{planned - spent < 0 ? "Excedido" : "Restante"}</p>
                <Money
                  fit
                  cents={Math.abs(planned - spent)}
                  className={`font-display text-[0.95rem] font-bold min-[400px]:text-base sm:text-xl ${planned - spent < 0 ? "text-negative" : "text-positive"}`}
                />
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar ratio={ratio} tone={budgetStatus(ratio)} />
            </div>
            {unbudgeted > 0 && (
              <p className="mt-3 text-sm text-muted">
                Gastos em categorias sem orçamento: <Money cents={unbudgeted} className="font-semibold text-ink" />
              </p>
            )}
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {items.map(({ budget, spent: used, remaining, ratio: r, status }) => {
              const category = data.categoryById.get(budget.categoryId);
              return (
                <button key={budget.id} type="button" onClick={() => setEditing(budget)} className="text-left">
                  <Card className="h-full transition-colors hover:border-orange">
                    <div className="mb-3 flex items-center gap-3">
                      <ColorIcon icon={categoryIcon(category?.icon)} color={category?.color ?? "#868E96"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{category?.name ?? "Categoria removida"}</p>
                        <p className="text-sm text-muted">
                          <Money cents={used} className="font-semibold text-ink" /> de <Money cents={budget.amount} />
                        </p>
                      </div>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${
                          status === "over" ? "bg-negative/10 text-negative" : status === "warning" ? "bg-orange-soft text-brand-ink" : "bg-positive/10 text-positive"
                        }`}
                      >
                        {Number.isFinite(r) ? `${Math.round(r * 100)}%` : "—"}
                      </span>
                    </div>
                    <ProgressBar ratio={r} tone={status} />
                    <p className={`mt-2 text-sm ${remaining < 0 ? "font-semibold text-negative" : "text-muted"}`}>
                      {remaining < 0 ? "Excedeu " : "Restam "}
                      <Money cents={Math.abs(remaining)} className="font-semibold" />
                    </p>
                  </Card>
                </button>
              );
            })}
          </div>
        </>
      )}

      {editing && <BudgetForm budget={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
