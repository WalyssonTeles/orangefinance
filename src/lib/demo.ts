import { db } from "./db";
import { addMonths, todayISO } from "./dates";
import { createTransaction, saveAccount, saveBudget, type TransactionDraft } from "./repo";

/** Fills an empty database with ~6 months of realistic sample data so every screen can be explored. */
export async function loadDemoData(): Promise<void> {
  await db.transaction("rw", [db.accounts, db.categories, db.transactions, db.budgets], fill);
}

async function fill() {
  const categories = await db.categories.toArray();
  const cat = (name: string) => categories.find((c) => c.name === name && c.deletedAt === null)?.id ?? null;
  const [first] = (await db.accounts.toArray()).filter((a) => a.deletedAt === null);

  const bank = await saveAccount({
    id: first?.id,
    name: first?.name === "Conta principal" ? "Banco principal" : first?.name ?? "Banco principal",
    type: "checking",
    color: first?.color ?? "#FF8A1F",
    initialBalance: 1250_00,
    creditLimit: null,
  });
  const wallet = await saveAccount({ name: "Carteira", type: "wallet", color: "#2F9444", initialBalance: 180_00, creditLimit: null });
  const card = await saveAccount({ name: "Cartão Laranja", type: "credit", color: "#7048E8", initialBalance: 0, creditLimit: 4000_00 });

  const today = todayISO();
  const monthDay = (offset: number, day: number) => addMonths(`${today.slice(0, 8)}${String(day).padStart(2, "0")}`, offset);
  const add = (draft: Partial<TransactionDraft> & Pick<TransactionDraft, "type" | "amount" | "date" | "accountId">, repeat?: Parameters<typeof createTransaction>[1]) =>
    createTransaction({ description: "", toAccountId: null, categoryId: null, notes: "", paid: true, ...draft }, repeat);

  for (let m = -5; m <= 0; m++) {
    const past = m < 0;
    const due = (day: number) => past || monthDay(m, day) <= today;
    await add({ type: "income", amount: 5200_00, description: "Salário", date: monthDay(m, 5), accountId: bank, categoryId: cat("Salário"), paid: due(5) });
    await add({ type: "expense", amount: 1500_00, description: "Aluguel", date: monthDay(m, 10), accountId: bank, categoryId: cat("Moradia"), paid: due(10) });
    await add({ type: "expense", amount: 620_00 + ((m * 37_00) % 140_00), description: "Supermercado", date: monthDay(m, 8), accountId: card, categoryId: cat("Mercado"), paid: due(8) });
    await add({ type: "expense", amount: 240_00 - m * 18_00, description: "Restaurantes", date: monthDay(m, 14), accountId: card, categoryId: cat("Alimentação"), paid: due(14) });
    await add({ type: "expense", amount: 210_00, description: "Combustível", date: monthDay(m, 3), accountId: bank, categoryId: cat("Transporte"), paid: due(3) });
    await add({ type: "expense", amount: 175_00 + m * 4_00, description: "Conta de luz", date: monthDay(m, 22), accountId: bank, categoryId: cat("Contas da casa"), paid: past });
    await add({ type: "expense", amount: 119_90, description: "Internet", date: monthDay(m, 12), accountId: bank, categoryId: cat("Contas da casa"), paid: past });
    if (m > -3) await add({ type: "income", amount: 900_00, description: "Projeto freelance", date: monthDay(m, 20), accountId: bank, categoryId: cat("Freelance"), paid: due(20) });
    if (past) await add({ type: "transfer", amount: 1050_00, description: "Pagamento da fatura", date: monthDay(m, 7), accountId: bank, toAccountId: card });
  }
  await add({ type: "expense", amount: 55_90, description: "Streaming", date: monthDay(-1, 15), accountId: card, categoryId: cat("Assinaturas"), paid: true }, { mode: "monthly", count: 12 });
  await add({ type: "expense", amount: 2399_00, description: "Notebook", date: monthDay(-1, 18), accountId: card, categoryId: cat("Compras") }, { mode: "installments", count: 10 });
  await add({ type: "expense", amount: 64_50, description: "Farmácia", date: today, accountId: wallet, categoryId: cat("Saúde") });

  for (const [name, amount] of [["Mercado", 800_00], ["Alimentação", 300_00], ["Transporte", 300_00], ["Compras", 400_00]] as const) {
    const categoryId = cat(name);
    if (categoryId) await saveBudget({ categoryId, amount });
  }
}
