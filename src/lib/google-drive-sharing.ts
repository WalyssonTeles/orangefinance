import { z } from "zod";
import type { SheetMemberEmail } from "./workspaces";

const permission = z.object({
  id: z.string().min(1),
  type: z.string(),
  role: z.string(),
  emailAddress: z.string().optional(),
});
const permissionList = z.object({
  permissions: z.array(permission).default([]),
  nextPageToken: z.string().optional(),
});
const createdPermission = z.object({ id: z.string().min(1) });

async function driveRequest(
  url: string, token: string, init: RequestInit, fetcher: typeof fetch,
): Promise<unknown> {
  const response = await fetcher(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("A autorização do Google expirou. Autorize novamente.");
    if (response.status === 403) throw new Error("O Google Drive não permitiu compartilhar a planilha. Confirme que ela foi criada pelo app.");
    if (response.status === 429) throw new Error("Limite de compartilhamento do Google atingido. Tente novamente mais tarde.");
    throw new Error("Não foi possível atualizar o acesso dos participantes à planilha.");
  }
  return response.json();
}

export async function shareSpreadsheetReadOnly(
  token: string, spreadsheetId: string, members: readonly SheetMemberEmail[], fetcher: typeof fetch = fetch,
): Promise<number> {
  if (!token) throw new Error("Autorize o Google antes de compartilhar a planilha.");
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheetId)) throw new Error("Identificador de planilha inválido.");
  const unique = new Map<string, SheetMemberEmail>();
  for (const member of members) unique.set(member.email.trim().toLowerCase(), member);

  const existing = new Map<string, z.infer<typeof permission>>();
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      fields: "nextPageToken,permissions(id,type,role,emailAddress)",
      pageSize: "100",
      ...(pageToken ? { pageToken } : {}),
    });
    const parsed = permissionList.safeParse(await driveRequest(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions?${params}`,
      token, { method: "GET" }, fetcher,
    ));
    if (!parsed.success) throw new Error("O Google Drive retornou permissões inválidas.");
    for (const item of parsed.data.permissions) {
      if (item.type === "user" && item.emailAddress) existing.set(item.emailAddress.toLowerCase(), item);
    }
    pageToken = parsed.data.nextPageToken;
  } while (pageToken);

  let changed = 0;
  for (const email of unique.keys()) {
    const current = existing.get(email);
    if (current?.role === "reader") continue;
    const url = current
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions/${encodeURIComponent(current.id)}?fields=id`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions?sendNotificationEmail=false&fields=id`;
    const result = createdPermission.safeParse(await driveRequest(url, token, {
      method: current ? "PATCH" : "POST",
      body: JSON.stringify(current ? { role: "reader" } : { type: "user", role: "reader", emailAddress: email }),
    }, fetcher));
    if (!result.success) throw new Error("O Google Drive não confirmou a permissão de leitura de um participante.");
    changed++;
  }
  return changed;
}
