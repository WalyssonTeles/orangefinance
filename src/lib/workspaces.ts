import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.enum(["personal", "shared"]),
  role: z.enum(["owner", "member"]),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const memberSchema = z.object({ user_id: z.uuid(), email: z.string(), role: z.enum(["owner", "member"]) });
export type WorkspaceMember = z.infer<typeof memberSchema>;
export const invitationSchema = z.object({ id: z.uuid(), email: z.string(), expires_at: z.string() });
export type WorkspaceInvitation = z.infer<typeof invitationSchema>;

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
