import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberSummary } from "./db";

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.enum(["personal", "shared"]),
  role: z.enum(["owner", "member"]),
});
export type Workspace = z.infer<typeof workspaceSchema>;
const spaceMemberSchema = z.object({ user_id: z.uuid(), display_name: z.string(), role: z.enum(["owner", "member"]) });
const JOIN_CODE = /^[A-HJ-NP-Z2-9]{10}$/;

/** Uppercases and removes spaces/hyphens so codes typed or pasted in any format are accepted. */
export function normalizeJoinCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE.test(normalizeJoinCode(code));
}

export async function workspaceRpc(
  client: SupabaseClient, token: string, name: string, args?: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args).setHeader("Authorization", `Bearer ${token}`);
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchWorkspaces(client: SupabaseClient, token: string): Promise<Workspace[]> {
  await workspaceRpc(client, token, "ensure_personal_finance_workspace");
  const data = await workspaceRpc(client, token, "list_finance_workspaces");
  const parsed = z.array(workspaceSchema).safeParse(data);
  if (!parsed.success) throw new Error("A lista de espaços retornada pelo servidor é inválida.");
  return parsed.data;
}

export async function fetchMembers(client: SupabaseClient, token: string, workspaceId: string): Promise<MemberSummary[]> {
  const data = await workspaceRpc(client, token, "list_finance_space_members", { p_workspace: workspaceId });
  const parsed = z.array(spaceMemberSchema).safeParse(data);
  if (!parsed.success) throw new Error("A lista de participantes retornada pelo servidor é inválida.");
  return parsed.data.map((m) => ({ userId: m.user_id, name: m.display_name, role: m.role }));
}

export async function fetchJoinCode(client: SupabaseClient, token: string, workspaceId: string): Promise<string> {
  return z.string().regex(JOIN_CODE).parse(await workspaceRpc(client, token, "get_finance_join_code", { p_workspace: workspaceId }));
}

export async function regenerateJoinCode(client: SupabaseClient, token: string, workspaceId: string): Promise<string> {
  return z.string().regex(JOIN_CODE).parse(await workspaceRpc(client, token, "regenerate_finance_join_code", { p_workspace: workspaceId }));
}

export async function joinByCode(client: SupabaseClient, token: string, code: string): Promise<string> {
  const normalized = normalizeJoinCode(code);
  if (!JOIN_CODE.test(normalized)) throw new Error("O código tem 10 letras e números. Confira e tente novamente.");
  const id = await workspaceRpc(client, token, "join_finance_workspace", { p_code: normalized });
  if (id === null) throw new Error("Código não encontrado. Confira com quem compartilhou o espaço.");
  return z.uuid().parse(id);
}

export async function createSharedSpace(client: SupabaseClient, token: string, name: string): Promise<string> {
  return z.uuid().parse(await workspaceRpc(client, token, "create_family_workspace", { p_name: name.trim() }));
}
