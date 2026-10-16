import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "../lib/db";
import { TransactionRow } from "../components/TransactionRow";
import { Transactions } from "./Transactions";

vi.mock("../state", () => ({
  useApp: () => ({
    data: { accounts: [], transactions: [], categories: [], categoryById: new Map(), accountById: new Map() },
    month: "2026-10",
    setMonth: vi.fn(),
    sharedSpace: false,
    members: [],
    memberById: new Map(),
    openTransaction: vi.fn(),
    notify: vi.fn(),
  }),
}));
vi.mock("../lib/router", () => ({
  useLocation: () => ({ params: new URLSearchParams(), section: null }),
  replaceParams: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("../lib/repo", () => ({
  deleteTransaction: vi.fn(),
  restoreTransactions: vi.fn(),
  setPaid: vi.fn(),
}));

describe("transaction list layout", () => {
  it("keeps search outside collapsed filters and above the list", () => {
    const html = renderToStaticMarkup(<Transactions />);
    const filters = html.indexOf('id="transaction-filters"');
    const filterCardEnd = html.indexOf("</section>", filters);
    const search = html.indexOf('role="search"');
    const list = html.indexOf('aria-label="Lista de lançamentos"');
    expect(filters).toBeGreaterThan(-1);
    expect(html.slice(filters, filterCardEnd)).toContain('hidden=""');
    expect(search).toBeGreaterThan(filterCardEnd);
    expect(search).toBeLessThan(list);
    expect(html.slice(filters, filterCardEnd)).not.toContain('type="search"');
    expect(html).toContain('enterKeyHint="search"');
  });

  it("places secondary sorting before the filters toggle", () => {
    const html = renderToStaticMarkup(<Transactions />);
    const sort = html.indexOf('aria-label="Ordenar do mais antigo para o mais recente"');
    expect(sort).toBeGreaterThan(-1);
    expect(sort).toBeLessThan(html.indexOf('aria-controls="transaction-filters"'));
    expect(html).toContain(">Exibir Filtros</button>");
  });

  it("does not paint or activate closed swipe actions", () => {
    const tx: Transaction = {
      id: "layout-test", createdAt: 1, updatedAt: 1, deletedAt: null,
      type: "income", amount: 10000, description: "Receita", date: "2026-10-16",
      accountId: "account", toAccountId: null, categoryId: null, paid: true,
      notes: "", groupId: null, installment: null, installments: null,
    };
    const html = renderToStaticMarkup(<TransactionRow tx={tx} />);
    expect(html).toMatch(/class="[^"]*pointer-events-none opacity-0"[^>]*aria-hidden="true"/);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Receita, Recebido. Abrir lançamento"');
  });
});
