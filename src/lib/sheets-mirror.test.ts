import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceDB } from "./db";
import { seedDefaults } from "./repo";
import { readSyncData, type SyncData } from "./sync-data";
import { mirrorRows, reconcileMirrorTransactions, SHEETS_COLUMNS } from "./sheets-model";
import { createMirrorSpreadsheet, readMirrorTransactions, writeInitialMirrorSnapshot } from "./sheets-mirror";

const databases: FinanceDB[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

async function fixture(): Promise<SyncData> {
  const database = new FinanceDB(`sheets-test-${crypto.randomUUID()}`);
  databases.push(database);
  await seedDefaults(database);
  const account = (await database.accounts.toArray())[0];
  const category = (await database.categories.where("kind").equals("expense").first())!;
  await database.transactions.put({
    id: crypto.randomUUID(), type: "expense", amount: 12345,
    date: "2026-10-17", description: '=HYPERLINK("https://example.com")',
    accountId: account.id, toAccountId: null, categoryId: category.id,
    paid: true, notes: "Compra", groupId: null, installment: null, installments: null,
    createdAt: 1000, updatedAt: 2000, deletedAt: null,
    repeatMode: "recurring", frequency: "monthly", repeatCount: 2,
  });
  return readSyncData(database);
}

describe("espelho do Google Sheets", () => {
  it("mantém centavos, IDs, datas, exclusões e campos técnicos sem transformar descrições em fórmulas", async () => {
    const data = await fixture();
    const rows = mirrorRows(data);
    const row = rows["Lançamentos"][0];
    expect(row.length).toBe(SHEETS_COLUMNS["Lançamentos"].length);
    expect(row[3]).toBe('=HYPERLINK("https://example.com")');
    expect(row[4]).toBe(12345);
    expect(row[5]).toBe("");
    expect(row[17]).toBe("1970-01-01T00:00:01.000Z");
    expect(row[19]).toBe("");
    expect(JSON.parse(String(row[22]))).toEqual(data.transactions[0]);
    expect(rows.Contas[0][4]).toBe(0);
    expect(rows.Categorias).toHaveLength(data.categories.length);

    const removed = structuredClone(data);
    removed.transactions[0].deletedAt = 3000;
    expect(mirrorRows(removed)["Lançamentos"][0][19]).toBe("1970-01-01T00:00:03.000Z");
  });

  it("concilia totais por conta, mês e tipo e detecta divergências", async () => {
    const data = await fixture();
    const rows = mirrorRows(data)["Lançamentos"];
    expect(reconcileMirrorTransactions(data, rows)).toMatchObject({
      matches: true, local: [{ month: "2026-10", type: "expense", count: 1, cents: 12345 }],
    });
    expect(reconcileMirrorTransactions(data, [])).toMatchObject({ matches: false });
    const edited = structuredClone(rows);
    edited[0][4] = 1;
    expect(() => reconcileMirrorTransactions(data, edited)).toThrow("divergente");
    const removed = structuredClone(data);
    removed.transactions[0].deletedAt = 3000;
    expect(reconcileMirrorTransactions(removed, mirrorRows(removed)["Lançamentos"]).local).toEqual([]);
  });

  it("cria abas congeladas e envia lotes RAW sem uma chamada por lançamento", async () => {
    const data = await fixture();
    const tx = data.transactions[0];
    data.transactions = Array.from({ length: 5000 }, (_, i) => ({
      ...tx, id: `tx-${i}`, date: i % 2 ? "2026-09-17" : "2026-10-17",
    }));
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push({ url: String(url), body });
      if (String(url).endsWith("/spreadsheets")) {
        return { ok: true, json: async () => ({ spreadsheetId: "sheet-1" }) } as Response;
      }
      const batch = (body.data as Array<{ values: unknown[] }>)[0];
      return { ok: true, json: async () => ({ totalUpdatedRows: batch.values.length }) } as Response;
    });
    const id = await createMirrorSpreadsheet("token", "Orange Finance", fetcher as typeof fetch);
    const calls = await writeInitialMirrorSnapshot("token", id, data, fetcher as typeof fetch);
    expect(id).toBe("sheet-1");
    expect(calls).toBe(16);
    expect(requests[0].body.sheets).toEqual(expect.arrayContaining([
      expect.objectContaining({ properties: expect.objectContaining({
        title: "Lançamentos", gridProperties: expect.objectContaining({ frozenRowCount: 1 }),
      }) }),
    ]));
    expect(requests.slice(1).every(({ body }) => body.valueInputOption === "RAW")).toBe(true);
    const firstBatch = (requests[1].body.data as Array<{ values: Array<Array<string | number>> }>)[0];
    expect(firstBatch.values[0]).toEqual(Array.from(SHEETS_COLUMNS["Lançamentos"]));
    expect(firstBatch.values[1][0]).toBe("tx-0");
    expect(requests.length).toBe(calls + 1);
  });

  it("não confirma sucesso para respostas inválidas ou escritas incompletas", async () => {
    const data = await fixture();
    const invalid = vi.fn(async () => ({ ok: true, json: async () => ({ totalUpdatedRows: 0 }) } as Response));
    await expect(writeInitialMirrorSnapshot("token", "sheet", data, invalid as typeof fetch)).rejects.toThrow("não confirmou");
    const denied = vi.fn(async () => ({ ok: false, status: 403 } as Response));
    await expect(createMirrorSpreadsheet("token", "Espelho", denied as typeof fetch)).rejects.toThrow("Sem permissão");
    expect(invalid).toHaveBeenCalledTimes(1);
  });

  it("lê a planilha com valores numéricos e rejeita cabeçalhos alterados", async () => {
    const data = await fixture();
    const rows = mirrorRows(data)["Lançamentos"];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      return { ok: true, json: async () => ({ values: [Array.from(SHEETS_COLUMNS["Lançamentos"]), ...rows] }) } as Response;
    });
    const remote = await readMirrorTransactions("token", "sheet-1", fetcher as typeof fetch);
    expect(reconcileMirrorTransactions(data, remote).matches).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const changed = vi.fn(async () => ({
      ok: true, json: async () => ({ values: [["coluna alterada"], ...rows] }),
    } as Response));
    await expect(readMirrorTransactions("token", "sheet-1", changed as typeof fetch)).rejects.toThrow("cabeçalhos");
  });
});
