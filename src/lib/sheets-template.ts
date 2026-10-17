import { z } from "zod";
import templateUrl from "../../Instructions/orange-finance-modelo-individual.xlsx?url";
import sharedTemplateUrl from "../../Instructions/orange-finance-modelo-compartilhado.xlsx?url";
import { backupSchema } from "./backup-schema";
import type { MemberSummary } from "./db";
import type { Profile } from "./profile";
import { chunks, sheetsRequest } from "./sheets-mirror";
import { transactionTotals } from "./sheets-model";
import {
  sheetSerial, TEMPLATE_HEADERS, templateFilterOptions, templatePeople, templateProfile, templateRows, type TemplateSheet,
} from "./sheets-template-model";
import { parseSyncData, type SyncData } from "./sync-data";

const sheetsEndpoint = "https://sheets.googleapis.com/v4/spreadsheets";
const driveEndpoint = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType";
const sheetId = z.string().regex(/^[A-Za-z0-9_-]+$/);
const imported = z.object({ id: sheetId, mimeType: z.literal("application/vnd.google-apps.spreadsheet") });
const spreadsheet = z.object({
  sheets: z.array(z.object({ properties: z.object({
    sheetId: z.number().int().nonnegative(), title: z.string(),
    gridProperties: z.object({ rowCount: z.number().int().positive(), columnCount: z.number().int().positive() }),
  }) })),
});
const writeResult = z.object({ totalUpdatedRows: z.number().int().nonnegative() });
const readResult = z.object({ values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).optional() });
const selectionResult = z.object({ valueRanges: z.array(readResult) });
const transactionSchema = backupSchema.shape.transactions.element;

export async function createStyledSpreadsheet(
  token: string, name: string, fetcher: typeof fetch = fetch, assetFetcher: typeof fetch = fetch,
): Promise<string> {
  return createFromTemplate(token, name, templateUrl, fetcher, assetFetcher);
}

export async function createSharedStyledSpreadsheet(
  token: string, name: string, fetcher: typeof fetch = fetch, assetFetcher: typeof fetch = fetch,
): Promise<string> {
  return createFromTemplate(token, name, sharedTemplateUrl, fetcher, assetFetcher);
}

async function createFromTemplate(
  token: string, name: string, url: string, fetcher: typeof fetch, assetFetcher: typeof fetch,
): Promise<string> {
  if (!token) throw new Error("Autorize o Google antes de criar a planilha.");
  if (!name.trim()) throw new Error("Informe um nome para a planilha.");
  const asset = await assetFetcher(url);
  if (!asset.ok) throw new Error("Não foi possível carregar o modelo de planilha do aplicativo.");
  const file = await asset.blob();
  const boundary = `orange-finance-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify({ name, mimeType: "application/vnd.google-apps.spreadsheet" }),
    `\r\n--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    file, `\r\n--${boundary}--`,
  ]);
  const response = await fetcher(driveEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("A sessão Google expirou. Autorize novamente.");
    if (response.status === 403) throw new Error("O Google Drive não autorizou a criação da planilha.");
    if (response.status === 429) throw new Error("Limite do Google Drive atingido. Tente novamente mais tarde.");
    throw new Error("Não foi possível converter o modelo XLSX em uma planilha Google.");
  }
  const result = imported.safeParse(await response.json());
  if (!result.success) throw new Error("O Google não confirmou a conversão do modelo em planilha.");
  return result.data.id;
}

export async function prepareStyledSpreadsheet(
  token: string, id: string, data: SyncData, fetcher: typeof fetch = fetch,
  members: readonly MemberSummary[] | null = null,
): Promise<void> {
  await ensureStyledCapacity(token, id, data, fetcher, true, members);
  const ranges = [
    "'Lançamentos'!A2:Z", "'Contas'!A2:N", "'Categorias'!A2:K",
    "'Orçamentos'!A2:F", members ? "'Pessoas'!A2:D" : "'Perfil'!B2:B4",
  ];
  const response = z.object({ clearedRanges: z.array(z.string()) }).safeParse(await sheetsRequest(
    `${sheetsEndpoint}/${encodeURIComponent(id)}/values:batchClear`, token, { ranges }, fetcher,
  ));
  if (!response.success || response.data.clearedRanges.length !== ranges.length) {
    throw new Error("O Google não confirmou a remoção dos dados fictícios do modelo.");
  }
}

export async function ensureStyledCapacity(
  token: string, id: string, data: SyncData, fetcher: typeof fetch = fetch, format = false,
  members: readonly MemberSummary[] | null = null,
): Promise<void> {
  const result = spreadsheet.safeParse(await sheetsRequest(
    `${sheetsEndpoint}/${encodeURIComponent(id)}?fields=sheets(properties(sheetId,title,gridProperties))`,
    token, undefined, fetcher,
  ));
  if (!result.success) throw new Error("Não foi possível verificar a estrutura do modelo importado.");
  const rows = templateRows(data, members);
  const requests: unknown[] = [];
  for (const [name, headers] of Object.entries(TEMPLATE_HEADERS) as Array<[TemplateSheet, readonly string[]]>) {
    const sheet = result.data.sheets.find((item) => item.properties.title === name)?.properties;
    if (!sheet) throw new Error(`A aba ${name} não foi encontrada no modelo importado.`);
    const originalColumns = name === "Lançamentos" ? 21 : headers.length - 1;
    if (sheet.gridProperties.columnCount < originalColumns) throw new Error(`A aba ${name} está incompleta.`);
    if (sheet.gridProperties.columnCount < headers.length) {
      requests.push({ appendDimension: { sheetId: sheet.sheetId, dimension: "COLUMNS", length: headers.length - sheet.gridProperties.columnCount } });
    }
    requests.push({ updateDimensionProperties: {
      range: { sheetId: sheet.sheetId, dimension: "COLUMNS", startIndex: originalColumns,
        endIndex: name === "Lançamentos" ? 23 : headers.length },
      properties: { hiddenByUser: true }, fields: "hiddenByUser",
    } });
    if (name === "Lançamentos") {
      for (const [startIndex, endIndex] of [[12, 15], [23, 26]]) requests.push({
        updateDimensionProperties: {
          range: { sheetId: sheet.sheetId, dimension: "COLUMNS", startIndex, endIndex },
          properties: { hiddenByUser: false }, fields: "hiddenByUser",
        },
      });
    }
    const maximum = name === "Lançamentos" ? 20001 : 5001;
    if (rows[name].length + 1 > maximum) throw new Error(`A aba ${name} excede o limite de ${maximum - 1} registros do Dashboard.`);
    if (sheet.gridProperties.rowCount < maximum) {
      requests.push({ appendDimension: { sheetId: sheet.sheetId, dimension: "ROWS", length: maximum - sheet.gridProperties.rowCount } });
    }
    const formats: Array<{ column: number; type: "DATE" | "CURRENCY"; pattern: string }> =
      name === "Lançamentos"
        ? [{ column: 1, type: "DATE", pattern: "dd/MM/yyyy" },
          { column: 4, type: "CURRENCY", pattern: '"R$" #,##0.00' },
          { column: 15, type: "DATE", pattern: "dd/MM/yyyy" }]
        : name === "Contas"
          ? [4, 5].map((column) => ({ column, type: "CURRENCY" as const, pattern: '"R$" #,##0.00' }))
          : name === "Orçamentos"
            ? [{ column: 2, type: "CURRENCY", pattern: '"R$" #,##0.00' }] : [];
    for (const columnFormat of format ? formats : []) requests.push({ repeatCell: {
      range: { sheetId: sheet.sheetId, startRowIndex: 1, endRowIndex: maximum, startColumnIndex: columnFormat.column, endColumnIndex: columnFormat.column + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: columnFormat.type, pattern: columnFormat.pattern } } },
      fields: "userEnteredFormat.numberFormat",
    } });
  }
  const peopleSheet = members ? "Pessoas" : "Perfil";
  const profile = result.data.sheets.find((item) => item.properties.title === peopleSheet)?.properties;
  const metadata = result.data.sheets.find((item) => item.properties.title === "Metadados");
  if (!profile || !metadata || !result.data.sheets.some((item) => item.properties.title === "Dashboard")) {
    throw new Error(`O modelo importado não contém Dashboard, ${peopleSheet} e Metadados.`);
  }
  if (members && profile.gridProperties.rowCount < members.length + 1) {
    requests.push({ appendDimension: {
      sheetId: profile.sheetId, dimension: "ROWS", length: members.length + 1 - profile.gridProperties.rowCount,
    } });
  }
  const dashboard = result.data.sheets.find((item) => item.properties.title === "Dashboard")?.properties;
  if (!dashboard) throw new Error("O Dashboard não foi encontrado no modelo.");
  const dashboardBackgroundEnd = Math.min(21, dashboard.gridProperties.columnCount);
  if (dashboardBackgroundEnd > 14) requests.push({ repeatCell: {
    range: {
      sheetId: dashboard.sheetId,
      startRowIndex: 0,
      endRowIndex: Math.min(84, dashboard.gridProperties.rowCount),
      startColumnIndex: 14,
      endColumnIndex: dashboardBackgroundEnd,
    },
    cell: { userEnteredFormat: { backgroundColorStyle: {
      rgbColor: { red: 251 / 255, green: 247 / 255, blue: 244 / 255 },
    } } },
    fields: "userEnteredFormat.backgroundColorStyle",
  } });
  const selectors = [
    { column: 1, source: "A2:A300", hint: "Escolha o ano." },
    { column: 3, source: "B2:B13", hint: "Escolha o mês." },
    { column: 5, source: "D2:D5001", hint: "Escolha a conta." },
    ...(members ? [{ column: 7, source: "E2:E5001", hint: "Escolha o titular." }] : []),
  ];
  for (const selector of selectors) requests.push({ setDataValidation: {
    range: { sheetId: dashboard.sheetId, startRowIndex: 5, endRowIndex: 6,
      startColumnIndex: selector.column, endColumnIndex: selector.column + 2 },
    rule: {
      condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: `='_Listas'!${selector.source}` }] },
      strict: true, showCustomUi: true, inputMessage: selector.hint,
    },
  } }, { repeatCell: {
    range: { sheetId: dashboard.sheetId, startRowIndex: 5, endRowIndex: 6,
      startColumnIndex: selector.column, endColumnIndex: selector.column + 2 },
    cell: { userEnteredFormat: { textFormat: {
      bold: true, fontSize: 11, foregroundColor: { red: 194 / 255, green: 65 / 255, blue: 12 / 255 },
    } } },
    fields: "userEnteredFormat.textFormat.bold,userEnteredFormat.textFormat.fontSize,userEnteredFormat.textFormat.foregroundColor",
  } });
  await sheetsRequest(`${sheetsEndpoint}/${encodeURIComponent(id)}:batchUpdate`, token, { requests }, fetcher);
}

function sheetRange(sheet: string, row: number): string {
  return `'${sheet.replaceAll("'", "''")}'!A${row}`;
}

export async function writeStyledSnapshot(
  token: string, id: string, input: SyncData, profile: Profile | null, fetcher: typeof fetch = fetch,
  members: readonly MemberSummary[] | null = null, spaceName = "Pessoal",
): Promise<number> {
  const data = parseSyncData(input);
  await ensureStyledCapacity(token, id, data, fetcher, false, members);
  const tables = templateRows(data, members);
  const valuesBySheet: Array<[string, Array<Array<string | number>>]> = [
    ...Object.entries(TEMPLATE_HEADERS).map(([sheet, headers]) =>
      [sheet, [Array.from(headers), ...tables[sheet as TemplateSheet]]] as [string, Array<Array<string | number>>]),
    members
      ? ["Pessoas", [["id", "nome", "papel", "entrou_em"], ...templatePeople(members)]]
      : ["Perfil", [["campo", "valor"], ...templateProfile(data, profile)]],
    ["Metadados", [
      ["chave", "valor"], ["schema_version", "1"], ["modelo_versao", "1.3.0"],
      ["tipo_planilha", members ? "compartilhada" : "individual"], ["nome_do_espaco", spaceName], ["dados_de_exemplo", "não"],
      ["revisao_global", Date.now()], ["criado_em", new Date().toISOString()],
    ]],
  ];
  let calls = 0;
  for (const [sheet, values] of valuesBySheet) {
    let start = 1;
    for (const batch of chunks(values)) {
      const result = writeResult.safeParse(await sheetsRequest(
        `${sheetsEndpoint}/${encodeURIComponent(id)}/values:batchUpdate`,
        token, { valueInputOption: "RAW", data: [{ range: sheetRange(sheet, start), majorDimension: "ROWS", values: batch }] },
        fetcher,
      ));
      if (!result.success || result.data.totalUpdatedRows !== batch.length) {
        throw new Error(`O Google não confirmou todas as linhas da aba ${sheet}. Tente reenviar.`);
      }
      calls++;
      start += batch.length;
    }
  }
  const filters = templateFilterOptions(data, members);
  const ranges = ["'_Listas'!A2:A300", "'_Listas'!D2:D5001",
    ...(members ? ["'_Listas'!E2:E5001"] : [])];
  const cleared = z.object({ clearedRanges: z.array(z.string()) }).safeParse(await sheetsRequest(
    `${sheetsEndpoint}/${encodeURIComponent(id)}/values:batchClear`, token, { ranges }, fetcher,
  ));
  if (!cleared.success || cleared.data.clearedRanges.length !== ranges.length) {
    throw new Error("Não foi possível atualizar as opções dos filtros do Dashboard.");
  }
  const listData = [
    { range: "'_Listas'!A2", values: filters.years.map((year) => [year]) },
    { range: "'_Listas'!D2", values: filters.accounts.map((account) => [account]) },
    ...(members ? [{ range: "'_Listas'!E2", values: filters.holders.map((holder) => [holder]) }] : []),
  ];
  const filterResult = writeResult.safeParse(await sheetsRequest(
    `${sheetsEndpoint}/${encodeURIComponent(id)}/values:batchUpdate`, token,
    { valueInputOption: "RAW", data: listData.map((entry) => ({ ...entry, majorDimension: "ROWS" })) }, fetcher,
  ));
  if (!filterResult.success || filterResult.data.totalUpdatedRows < filters.years.length) {
    throw new Error("O Google não confirmou a atualização dos filtros do Dashboard.");
  }
  calls++;
  const selections = selectionResult.safeParse(await sheetsRequest(
    `${sheetsEndpoint}/${encodeURIComponent(id)}/values:batchGet?` +
      `ranges=${encodeURIComponent("'Dashboard'!F6")}` +
      (members ? `&ranges=${encodeURIComponent("'Dashboard'!H6")}` : "") +
      "&valueRenderOption=UNFORMATTED_VALUE",
    token, undefined, fetcher,
  ));
  if (!selections.success || selections.data.valueRanges.length !== (members ? 2 : 1)) {
    throw new Error("Não foi possível verificar os filtros selecionados no Dashboard.");
  }
  const selectedAccount = selections.data.valueRanges[0].values?.[0]?.[0];
  const selectedHolder = selections.data.valueRanges[1]?.values?.[0]?.[0];
  const defaults = [
    ...(!filters.accounts.includes(String(selectedAccount ?? "")) ? [{ range: "'Dashboard'!F6", values: [["Todas"]] }] : []),
    ...(members && !filters.holders.includes(String(selectedHolder ?? ""))
      ? [{ range: "'Dashboard'!H6", values: [["Todos"]] }] : []),
  ];
  if (defaults.length) {
    const restored = writeResult.safeParse(await sheetsRequest(
      `${sheetsEndpoint}/${encodeURIComponent(id)}/values:batchUpdate`, token,
      { valueInputOption: "RAW", data: defaults.map((entry) => ({ ...entry, majorDimension: "ROWS" })) }, fetcher,
    ));
    if (!restored.success || restored.data.totalUpdatedRows < defaults.length) {
      throw new Error("O Google não confirmou a seleção dos filtros válidos no Dashboard.");
    }
    calls++;
  }
  return calls;
}

export async function readStyledTransactions(
  token: string, id: string, fetcher: typeof fetch = fetch,
): Promise<Array<Array<string | number | boolean>>> {
  const range = encodeURIComponent("'Lançamentos'!A1:W20001");
  const result = readResult.safeParse(await sheetsRequest(
    `${sheetsEndpoint}/${encodeURIComponent(id)}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
    token, undefined, fetcher,
  ));
  if (!result.success ||
    JSON.stringify(result.data.values?.[0]) !== JSON.stringify(TEMPLATE_HEADERS["Lançamentos"].slice(0, 23))) {
    throw new Error("Os cabeçalhos da planilha com modelo foram alterados.");
  }
  return result.data.values?.slice(1) ?? [];
}

export function reconcileStyledTransactions(data: SyncData, raw: unknown, byHolder = false) {
  const parsed = z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).safeParse(raw);
  if (!parsed.success) throw new Error("Os lançamentos recebidos da planilha são inválidos.");
  const transactions = parsed.data.map((row) => {
    if (![23, TEMPLATE_HEADERS["Lançamentos"].length].includes(row.length) || typeof row[21] !== "string") {
      throw new Error("Há uma linha incompleta na planilha com modelo.");
    }
    let payload: unknown;
    try { payload = JSON.parse(row[21]); }
    catch { throw new Error("Há dados técnicos inválidos na planilha com modelo."); }
    const tx = transactionSchema.safeParse(payload);
    if (!tx.success || row[0] !== tx.data.id || row[1] !== sheetSerial(tx.data.date) ||
      row[4] !== tx.data.amount / 100 || row[22] !== tx.data.amount ||
      row[19] !== (tx.data.deletedAt === null ? "" : new Date(tx.data.deletedAt).toISOString())) {
      throw new Error("Um lançamento da planilha diverge dos dados técnicos.");
    }
    return tx.data;
  });
  const local = transactionTotals(parseSyncData(data).transactions, byHolder);
  const remote = transactionTotals(transactions, byHolder);
  return { local, remote, matches: JSON.stringify(local) === JSON.stringify(remote) };
}
