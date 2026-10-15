import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Account, AccountType, Budget, Category, CategoryKind } from "../lib/db";
import { deleteAccount, deleteBudget, deleteCategory, saveAccount, saveBudget, saveCategory } from "../lib/repo";
import { useApp } from "../state";
import { ACCOUNT_TYPES, CATEGORY_ICONS, ColorIcon, PALETTE, categoryIcon } from "./icons";
import { Modal } from "./Modal";
import { MoneyInput } from "./MoneyInput";
import { Button, ColorSwatches, Field, inputClass, Segmented, Switch } from "./ui";

function FormFooter({
  formId,
  onClose,
  onDelete,
  deleteLabel,
}: {
  formId: string;
  onClose: () => void;
  onDelete?: () => void;
  deleteLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming && onDelete) {
    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm font-semibold">{deleteLabel}</span>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Excluir
        </Button>
      </div>
    );
  }
  return (
    <>
      {onDelete && (
        <Button variant="danger" className="px-3" aria-label="Excluir" onClick={() => setConfirming(true)}>
          <Trash2 size={18} />
        </Button>
      )}
      <Button variant="ghost" className="ml-auto" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form={formId}>
        Salvar
      </Button>
    </>
  );
}

function ErrorText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm font-semibold text-negative">
      {text}
    </p>
  );
}

/* ---------- Account ---------- */

export function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { notify } = useApp();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [color, setColor] = useState(account?.color ?? PALETTE[0]);
  const [balance, setBalance] = useState(Math.abs(account?.initialBalance ?? 0));
  const [negative, setNegative] = useState((account?.initialBalance ?? 0) < 0);
  const [limit, setLimit] = useState(account?.creditLimit ?? 0);
  const [error, setError] = useState("");
  const credit = type === "credit";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome para a conta.");
    // A credit card's opening value is debt (an open invoice), so it is stored as negative.
    const initialBalance = credit ? -balance : negative ? -balance : balance;
    await saveAccount({
      id: account?.id,
      name: name.trim(),
      type,
      color,
      initialBalance,
      creditLimit: credit ? limit : null,
    });
    notify(account ? "Conta atualizada." : "Conta criada.");
    onClose();
  };

  const remove = async () => {
    if (!account) return;
    if (await deleteAccount(account.id)) {
      notify("Conta excluída.");
      onClose();
    } else {
      setError("Esta conta tem lançamentos. Exclua ou mova os lançamentos antes de remover a conta.");
    }
  };

  return (
    <Modal
      open
      title={account ? "Editar conta" : "Nova conta"}
      onClose={onClose}
      footer={<FormFooter formId="account-form" onClose={onClose} onDelete={account ? remove : undefined} deleteLabel="Excluir conta?" />}
    >
      <form id="account-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome">
          <input
            autoFocus={!account}
            className={inputClass}
            value={name}
            maxLength={40}
            placeholder="Ex.: Nubank, Carteira, Poupança"
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-muted">Tipo</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((key) => {
              const { label, icon } = ACCOUNT_TYPES[key];
              const active = key === type;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setType(key)}
                  className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-left text-sm font-semibold transition-colors ${
                    active ? "border-orange bg-orange-soft/60" : "border-line hover:bg-cream"
                  }`}
                >
                  <ColorIcon icon={icon} color={color} size="sm" />
                  <span className="min-w-0 leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Cor">
          <ColorSwatches value={color} colors={PALETTE} onChange={setColor} />
        </Field>
        {credit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Limite do cartão">
              <MoneyInput label="Limite do cartão" value={limit} onChange={setLimit} />
            </Field>
            <Field label="Fatura em aberto hoje" hint="Valor que já está na fatura antes de usar o app.">
              <MoneyInput label="Fatura em aberto hoje" value={balance} onChange={setBalance} />
            </Field>
          </div>
        ) : (
          <div className="space-y-2">
            <Field label="Saldo inicial" hint="Saldo da conta no momento em que você começou a usar o app.">
              <MoneyInput
                label="Saldo inicial"
                value={balance}
                onChange={setBalance}
                tone={negative ? "text-negative" : "text-ink"}
              />
            </Field>
            <Switch label="Saldo negativo" checked={negative} onChange={setNegative} />
          </div>
        )}
        <ErrorText text={error} />
      </form>
    </Modal>
  );
}

/* ---------- Category ---------- */

export function CategoryForm({
  category,
  kind: initialKind,
  onClose,
}: {
  category?: Category;
  kind: CategoryKind;
  onClose: () => void;
}) {
  const { notify } = useApp();
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? initialKind);
  const [icon, setIcon] = useState(category?.icon ?? "more");
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome para a categoria.");
    await saveCategory({ id: category?.id, name: name.trim(), kind, icon, color });
    notify(category ? "Categoria atualizada." : "Categoria criada.");
    onClose();
  };

  const remove = async () => {
    if (!category) return;
    if (await deleteCategory(category.id)) {
      notify("Categoria excluída.");
      onClose();
    } else {
      setError("Esta categoria é usada em lançamentos e não pode ser excluída.");
    }
  };

  return (
    <Modal
      open
      title={category ? "Editar categoria" : "Nova categoria"}
      onClose={onClose}
      footer={
        <FormFooter formId="category-form" onClose={onClose} onDelete={category ? remove : undefined} deleteLabel="Excluir categoria?" />
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-end gap-3">
          <ColorIcon icon={categoryIcon(icon)} color={color} size="lg" />
          <div className="flex-1">
            <Field label="Nome">
              <input
                autoFocus={!category}
                className={inputClass}
                value={name}
                maxLength={30}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
              />
            </Field>
          </div>
        </div>
        {!category && (
          <Segmented
            label="Tipo de categoria"
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Despesa" },
              { value: "income", label: "Receita" },
            ]}
          />
        )}
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-muted">Ícone</legend>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
            {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={icon === key}
                onClick={() => setIcon(key)}
                className={`grid aspect-square place-items-center rounded-xl transition-colors ${
                  icon === key ? "bg-ink text-white" : "text-muted hover:bg-cream hover:text-ink"
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Cor">
          <ColorSwatches value={color} colors={PALETTE} onChange={setColor} />
        </Field>
        <ErrorText text={error} />
      </form>
    </Modal>
  );
}

/* ---------- Budget ---------- */

export function BudgetForm({ budget, onClose }: { budget?: Budget; onClose: () => void }) {
  const { data, notify } = useApp();
  const taken = new Set(data.budgets.filter((b) => b.id !== budget?.id).map((b) => b.categoryId));
  const options = data.categories.filter((c) => c.kind === "expense" && !taken.has(c.id));
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? options[0]?.id ?? "");
  const [amount, setAmount] = useState(budget?.amount ?? 0);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId) return setError("Escolha uma categoria.");
    if (amount <= 0) return setError("Informe um limite maior que zero.");
    await saveBudget({ id: budget?.id, categoryId, amount });
    notify(budget ? "Orçamento atualizado." : "Orçamento criado.");
    onClose();
  };

  const remove = async () => {
    if (!budget) return;
    await deleteBudget(budget.id);
    notify("Orçamento excluído.");
    onClose();
  };

  return (
    <Modal
      open
      title={budget ? "Editar orçamento" : "Novo orçamento"}
      onClose={onClose}
      footer={<FormFooter formId="budget-form" onClose={onClose} onDelete={budget ? remove : undefined} deleteLabel="Excluir orçamento?" />}
    >
      <form id="budget-form" onSubmit={submit} className="space-y-4">
        {options.length === 0 ? (
          <p className="text-muted">Todas as categorias de despesa já têm orçamento.</p>
        ) : (
          <Field label="Categoria">
            <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Limite mensal" hint="O limite se repete todos os meses.">
          <MoneyInput label="Limite mensal" value={amount} onChange={setAmount} large autoFocus={!budget} />
        </Field>
        <ErrorText text={error} />
      </form>
    </Modal>
  );
}
