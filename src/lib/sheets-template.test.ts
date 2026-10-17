import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceDB } from "./db";
import { seedDefaults } from "./repo";
import { readSyncData, type SyncData } from "./sync-data";
import {
  accountLabels, memberLabels, sheetSerial, TEMPLATE_HEADERS, templateFilterOptions, templatePeople, templateRows,
} from "./sheets-template-model";
import {
  createSharedStyledSpreadsheet, createStyledSpreadsheet, prepareStyledSpreadsheet,
  readStyledTransactions, reconcileStyledTransactions, writeStyledSnapshot,
} from "./sheets-template";
import type { MemberSummary } from "./db";

const databases: FinanceDB[] = [];
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.delete())));

async function fixture(): Promise<SyncData> {
  const database = new FinanceDB(`template-${crypto.randomUUID()}`);
  databases.push(database);
  await seedDefaults(database);
  const account = (await database.accounts.toArray())[0];
  const category = (await database.categories.where("kind").equals("expense").first())!;
  await database.transactions.put({
    id: "tx-1", type: "expense", amount: 12345, description: '=HYPERLINK("https://example.com")',
    date: "2026-10-17", accountId: account.id, toAccountId: null, categoryId: category.id,
    paid: true, notes: "", groupId: null, installment: null, installments: null,
    createdAt: 1000, updatedAt: 2000, deletedAt: null,
  });
  return readSyncData(database);
}

const sheetTitles = ["Dashboard", "Lançamentos", "Contas", "Categorias", "Orçamentos", "Perfil", "Metadados", "Leia-me", "_Listas", "_Calc"];
function apiMock(titles = sheetTitles, selectedAccount = "Todas") {
  const requests: Array<{ url: string; body: Record<string, unknown> | null }> = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const address = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
    requests.push({ url: address, body });
    if (address.includes("?fields=sheets")) return {
      ok: true, json: async () => ({ sheets: titles.map((title, sheetId) => ({
        properties: { title, sheetId, gridProperties: { rowCount: 150, columnCount: title === "Dashboard" ? 21 : title === "Lançamentos" ? 21 :
          title === "Contas" ? 13 : title === "Categorias" ? 10 : title === "Orçamentos" ? 5 : 14 } },
      })) }),
    } as Response;
    if (address.includes("values:batchGet")) return {
      ok: true, json: async () => ({ valueRanges: [
        { values: [[selectedAccount]] },
        ...(address.includes("H6") ? [{ values: [["Todos"]] }] : []),
      ] }),
    } as Response;
    if (address.endsWith("values:batchClear")) return { ok: true, json: async () => ({
      clearedRanges: (body?.ranges as string[]),
    }) } as Response;
    if (address.endsWith("values:batchUpdate")) return { ok: true, json: async () => ({
      totalUpdatedRows: ((body?.data as Array<{ values: unknown[] }>)[0].values.length),
    }) } as Response;
    return { ok: true, json: async () => ({}) } as Response;
  });
  return { fetcher: fetcher as typeof fetch, requests };
}

describe("modelo individual do Google Sheets", () => {
  it("mapeia datas seriais, valores em reais para o Dashboard e preserva centavos nos dados técnicos", async () => {
    const data = await fixture();
    const rows = templateRows(data);
    const tx = rows["Lançamentos"][0];
    expect(sheetSerial("2026-10-17")).toBe(46312);
    expect(() => sheetSerial("2026-02-30")).toThrow("data inválida");
    expect(tx).toHaveLength(TEMPLATE_HEADERS["Lançamentos"].length);
    expect(tx[1]).toBe(sheetSerial("2026-10-17"));
    expect(tx[3]).toBe('=HYPERLINK("https://example.com")');
    expect(tx[4]).toBe(123.45);
    expect(tx[21]).toBe(JSON.stringify(data.transactions[0]));
    expect(tx[22]).toBe(12345);
    expect(tx.slice(23)).toEqual(["Única", 1, ""]);
    expect(reconcileStyledTransactions(data, rows["Lançamentos"]).matches).toBe(true);
    const modified = structuredClone(rows["Lançamentos"]);
    modified[0][4] = 1;
    expect(() => reconcileStyledTransactions(data, modified)).toThrow("diverge");
    data.transactions[0] = { ...data.transactions[0], groupId: "series-1",
      repeatMode: "recurring", frequency: "custom", repeatCount: 3, intervalDays: 14 };
    const recurring = templateRows(data)["Lançamentos"][0];
    expect(recurring[14]).toBe("Personalizada");
    expect(recurring.slice(23)).toEqual(["Recorrente", 3, 14]);
    data.budgets.push({
      id: "budget-removed", categoryId: data.categories[0].id, amount: 25000,
      createdAt: 1000, updatedAt: 2000, deletedAt: 3000,
    });
    expect(templateRows(data)["Orçamentos"][0][2]).toBe(0);
  });

  it("converte uma cópia do XLSX sem modificar a planilha simples anterior", async () => {
    const assetFetcher = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["modelo-xlsx"]) } as Response));
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual(expect.objectContaining({
        "Content-Type": expect.stringContaining("multipart/related"),
      }));
      expect(await (init?.body as Blob).text()).toContain("application/vnd.google-apps.spreadsheet");
      return { ok: true, json: async () => ({
        id: "modelo-1", mimeType: "application/vnd.google-apps.spreadsheet",
      }) } as Response;
    });
    await expect(createStyledSpreadsheet("token", "Orange Finance - Pessoal",
      fetcher as typeof fetch, assetFetcher as typeof fetch)).resolves.toBe("modelo-1");
    expect(assetFetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    const notConverted = vi.fn(async () => ({
      ok: true, json: async () => ({ id: "arquivo-excel", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    } as Response));
    await expect(createStyledSpreadsheet("token", "Modelo", notConverted as typeof fetch,
      assetFetcher as typeof fetch)).rejects.toThrow("não confirmou a conversão");
  });

  it("remove exemplos, oculta colunas técnicas e envia 5.000 lançamentos em lotes RAW", async () => {
    const data = await fixture();
    const tx = data.transactions[0];
    data.transactions = Array.from({ length: 5000 }, (_, i) => ({ ...tx, id: `tx-${i}` }));
    const { fetcher, requests } = apiMock();
    await prepareStyledSpreadsheet("token", "modelo-1", data, fetcher);
    expect(requests.some((item) => item.url.endsWith("values:batchClear"))).toBe(true);
    const preparation = requests.find((item) => item.url.endsWith(":batchUpdate"));
    expect(preparation?.body?.requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ updateDimensionProperties: expect.objectContaining({
        properties: { hiddenByUser: true },
      }) }),
      expect.objectContaining({ repeatCell: expect.objectContaining({
        cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/MM/yyyy" } } },
      }) }),
      expect.objectContaining({ repeatCell: expect.objectContaining({
        range: expect.objectContaining({
          startRowIndex: 0, endRowIndex: 84, startColumnIndex: 14, endColumnIndex: 21,
        }),
        cell: { userEnteredFormat: { backgroundColorStyle: {
          rgbColor: { red: 251 / 255, green: 247 / 255, blue: 244 / 255 },
        } } },
      }) }),
    ]));
    const calls = await writeStyledSnapshot("token", "modelo-1", data, null, fetcher);
    expect(calls).toBe(17);
    const writes = requests.filter((item) => item.url.endsWith("values:batchUpdate"));
    expect(writes).toHaveLength(17);
    expect(writes.every((item) => item.body?.valueInputOption === "RAW")).toBe(true);
    const first = (writes[0].body?.data as Array<{ values: Array<Array<string | number>> }>)[0].values;
    expect(first[0]).toEqual(Array.from(TEMPLATE_HEADERS["Lançamentos"]));
    expect(first[1][4]).toBe(123.45);
    expect(first[1][22]).toBe(12345);
    const validations = (preparation?.body?.requests as Array<Record<string, unknown>>)
      .filter((item) => "setDataValidation" in item);
    expect(validations).toHaveLength(3);
    expect(validations[0]).toMatchObject({ setDataValidation: {
      range: { startRowIndex: 5, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 3 },
      rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: "='_Listas'!A2:A300" }] },
        showCustomUi: true },
    } });
    expect(preparation?.body?.requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ repeatCell: expect.objectContaining({
        range: expect.objectContaining({ startRowIndex: 5, startColumnIndex: 1, endColumnIndex: 3 }),
        cell: { userEnteredFormat: { textFormat: expect.objectContaining({ bold: true, fontSize: 11 }) } },
      }) }),
    ]));
    expect(preparation?.body?.requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ updateDimensionProperties: {
        range: expect.objectContaining({ startIndex: 12, endIndex: 15 }),
        properties: { hiddenByUser: false }, fields: "hiddenByUser",
      } }),
    ]));
    const filters = writes.at(-1)?.body?.data as Array<{ range: string; values: unknown[][] }>;
    expect(filters.map((entry) => entry.range)).toEqual(["'_Listas'!A2", "'_Listas'!D2"]);
    expect(filters[1].values[0]).toEqual(["Todas"]);
    expect(templateFilterOptions(data, null).accounts).toHaveLength(data.accounts.length + 1);

    const oldHeader = vi.fn(async () => ({ ok: true, json: async () => ({
      values: [Array.from(TEMPLATE_HEADERS["Lançamentos"].slice(0, 23))],
    }) } as Response));
    await expect(readStyledTransactions("token", "modelo-1", oldHeader as typeof fetch)).resolves.toEqual([]);
  });

  it("usa o modelo compartilhado, preenche Pessoas e separa totais por titular", async () => {
    const data = await fixture();
    const members: MemberSummary[] = [
      { userId: "owner-1", name: "Ana", role: "owner" },
      { userId: "member-2", name: "Bruno", role: "member" },
    ];
    data.transactions[0].holderId = "owner-1";
    data.transactions.push({ ...data.transactions[0], id: "tx-2", holderId: "member-2", amount: 2000 });
    data.accounts[0].holderId = "owner-1";
    const rows = templateRows(data, members);
    expect(rows["Lançamentos"].map((row) => row[8])).toEqual(["Ana", "Bruno"]);
    expect(rows.Contas[0][3]).toBe("Ana");
    data.accounts.push({ ...data.accounts[0], id: "account-bruno", holderId: "member-2" });
    expect(accountLabels(data, members).get(data.accounts[0].id)).toBe(`${data.accounts[0].name} · Ana`);
    expect(accountLabels(data, members).get("account-bruno")).toBe(`${data.accounts[0].name} · Bruno`);
    expect(templateRows(data, members)["Lançamentos"][0][6]).toBe(`${data.accounts[0].name} · Ana`);
    expect(templateFilterOptions(data, members).accounts).toEqual([
      "Todas", `${data.accounts[0].name} · Ana`, `${data.accounts[0].name} · Bruno`,
    ]);
    expect(templatePeople(members)).toEqual([
      ["owner-1", "Ana", "responsável", ""],
      ["member-2", "Bruno", "participante", ""],
    ]);
    expect(reconcileStyledTransactions(data, rows["Lançamentos"], true).local).toHaveLength(2);
    expect(reconcileStyledTransactions(data, rows["Lançamentos"], true).matches).toBe(true);
    expect(templateFilterOptions(data, members).holders).toEqual(["Todos", "Ana", "Bruno"]);
    const repeated = memberLabels([{ ...members[0], name: "Ana" }, { ...members[1], name: "Ana" }]);
    expect(repeated.get("member-2")).toBe("Ana · member-2");

    const assetFetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("compartilhado");
      return { ok: true, blob: async () => new Blob(["modelo compartilhado"]) } as Response;
    });
    const converter = vi.fn(async () => ({ ok: true, json: async () => ({
      id: "modelo-compartilhado", mimeType: "application/vnd.google-apps.spreadsheet",
    }) } as Response));
    await expect(createSharedStyledSpreadsheet("token", "Nossa família",
      converter as typeof fetch, assetFetcher as typeof fetch)).resolves.toBe("modelo-compartilhado");

    const { fetcher, requests } = apiMock(sheetTitles.map((title) => title === "Perfil" ? "Pessoas" : title));
    await prepareStyledSpreadsheet("token", "modelo-compartilhado", data, fetcher, members);
    const clear = requests.find((item) => item.url.endsWith("values:batchClear"));
    expect(clear?.body?.ranges).toContain("'Pessoas'!A2:D");
    const preparation = requests.find((item) => item.url.endsWith(":batchUpdate"));
    expect((preparation?.body?.requests as Array<Record<string, unknown>>)
      .filter((item) => "setDataValidation" in item)).toHaveLength(4);
    await writeStyledSnapshot("token", "modelo-compartilhado", data, null, fetcher, members, "Nossa família");
    const writes = requests.filter((item) => item.url.endsWith("values:batchUpdate"));
    const people = writes.find((item) => String((item.body?.data as Array<{ range: string }>)[0].range).includes("Pessoas"));
    expect((people?.body?.data as Array<{ values: unknown[][] }>)[0].values[1]).toEqual(["owner-1", "Ana", "responsável", ""]);
    const metadata = writes.find((item) => String((item.body?.data as Array<{ range: string }>)[0].range).includes("Metadados"));
    expect((metadata?.body?.data as Array<{ values: unknown[][] }>)[0].values[3]).toEqual(["tipo_planilha", "compartilhada"]);
    const filters = writes.at(-1)?.body?.data as Array<{ range: string; values: unknown[][] }>;
    expect(filters[2]).toMatchObject({ range: "'_Listas'!E2", values: [["Todos"], ["Ana"], ["Bruno"]] });
  });

  it("substitui uma conta selecionada cujo rótulo antigo não existe mais", async () => {
    const data = await fixture();
    const { fetcher, requests } = apiMock(sheetTitles, "Conta principal · id-antigo");
    await writeStyledSnapshot("token", "modelo-1", data, null, fetcher);
    const dashboardWrite = requests.filter((item) => item.url.endsWith("values:batchUpdate")).at(-1);
    expect(dashboardWrite?.body?.data).toEqual([{
      range: "'Dashboard'!F6", majorDimension: "ROWS", values: [["Todas"]],
    }]);
  });
});
