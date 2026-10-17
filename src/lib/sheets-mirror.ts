import { z } from "zod";
import { mirrorRows, SHEETS_COLUMNS, type MirrorRow, type MirrorSheet } from "./sheets-model";
import type { SyncData } from "./sync-data";

const endpoint = "https://sheets.googleapis.com/v4/spreadsheets";
const createdSheet = z.object({ spreadsheetId: z.string().min(1) });
const writeResult = z.object({ totalUpdatedRows: z.number().int().nonnegative() });
const readResult = z.object({ values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).optional() });

export async function sheetsRequest(
  url: string, token: string, body: unknown, fetcher: typeof fetch,
): Promise<unknown> {
  if (!token) throw new Error("Entre com sua conta Google antes de criar o espelho.");
  const response = await fetcher(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("A sessão Google expirou. Entre novamente para continuar o espelho.");
    if (response.status === 403) throw new Error("Sem permissão para editar a planilha do espelho.");
    if (response.status === 429) throw new Error("Limite da API do Google atingido. Tente novamente mais tarde.");
    throw new Error("Não foi possível atualizar o espelho no Google Sheets. Os dados locais foram preservados.");
  }
  return response.json();
}

export async function readMirrorTransactions(
  token: string, spreadsheetId: string, fetcher: typeof fetch = fetch,
): Promise<Array<Array<string | number | boolean>>> {
  if (!spreadsheetId) throw new Error("A planilha do espelho não foi selecionada.");
  const sheetRange = encodeURIComponent("'Lançamentos'!A1:W25001");
  const result = readResult.safeParse(await sheetsRequest(
    `${endpoint}/${encodeURIComponent(spreadsheetId)}/values/${sheetRange}?valueRenderOption=UNFORMATTED_VALUE`,
    token, undefined, fetcher,
  ));
  if (!result.success || JSON.stringify(result.data.values?.[0]) !== JSON.stringify(SHEETS_COLUMNS["Lançamentos"])) {
    throw new Error("Os cabeçalhos da planilha não correspondem ao espelho. Nenhum dado local foi alterado.");
  }
  return result.data.values?.slice(1) ?? [];
}

export async function createMirrorSpreadsheet(
  token: string, name: string, fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!name.trim()) throw new Error("Informe um nome para a planilha.");
  const sheets = Object.entries(SHEETS_COLUMNS).map(([title, columns]) => ({
    properties: {
      title,
      gridProperties: { rowCount: title === "Lançamentos" ? 25001 : 5001, columnCount: columns.length, frozenRowCount: 1 },
    },
  }));
  const result = createdSheet.safeParse(await sheetsRequest(endpoint, token, { properties: { title: name }, sheets }, fetcher));
  if (!result.success) throw new Error("O Google retornou uma planilha sem identificador válido.");
  return result.data.spreadsheetId;
}

export function chunks(rows: readonly MirrorRow[], maxRows = 500, maxBytes = 900_000): MirrorRow[][] {
  const batches: MirrorRow[][] = [];
  let current: MirrorRow[] = [], bytes = 0;
  const encoder = new TextEncoder();
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length;
    if (size > maxBytes) throw new Error("Um registro excede o limite de envio do espelho.");
    if (current.length && (current.length === maxRows || bytes + size > maxBytes)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function range(sheet: MirrorSheet, start: number): string {
  return `'${sheet.replaceAll("'", "''")}'!A${start}`;
}

export async function writeInitialMirrorSnapshot(
  token: string, spreadsheetId: string, data: SyncData, fetcher: typeof fetch = fetch,
): Promise<number> {
  if (!spreadsheetId) throw new Error("A planilha do espelho não foi selecionada.");
  const rows = mirrorRows(data);
  let calls = 0;
  for (const sheet of Object.keys(SHEETS_COLUMNS) as MirrorSheet[]) {
    const values = [Array.from(SHEETS_COLUMNS[sheet]), ...rows[sheet]];
    let start = 1;
    for (const batch of chunks(values)) {
      const result = writeResult.safeParse(await sheetsRequest(
        `${endpoint}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
        token, { valueInputOption: "RAW", data: [{ range: range(sheet, start), majorDimension: "ROWS", values: batch }] },
        fetcher,
      ));
      if (!result.success || result.data.totalUpdatedRows !== batch.length) {
        throw new Error("O Google não confirmou todas as linhas enviadas. O espelho precisa ser conferido.");
      }
      calls++;
      start += batch.length;
    }
  }
  return calls;
}
