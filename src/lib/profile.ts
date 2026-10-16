import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { db, type FinanceDB } from "./db";
import { workspaceRpc } from "./workspaces";

export type Gender = "female" | "male" | "other";

export interface Profile {
  name: string;
  gender: Gender | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  updatedAt: number;
  /** Account the profile belongs to; null while used without signing in. */
  userId: string | null;
  /** Saved locally but not yet confirmed by the server. */
  pending: boolean;
}

export const GENDER_OPTIONS: { value: Gender | ""; label: string }[] = [
  { value: "", label: "Prefiro não informar" },
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "other", label: "Outro" },
];

const storedSchema = z.object({
  name: z.string().max(40),
  gender: z.enum(["female", "male", "other"]).nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  updatedAt: z.number(),
  userId: z.string().nullable(),
  pending: z.boolean(),
});

const serverSchema = z.array(z.object({
  display_name: z.string().nullable(),
  gender: z.enum(["female", "male", "other"]).nullable(),
  birth_date: z.string().nullable(),
  updated_at: z.string(),
}));

export async function readProfile(database: FinanceDB = db): Promise<Profile | null> {
  const parsed = storedSchema.safeParse((await database.settings.get("profile"))?.value);
  return parsed.success ? parsed.data : null;
}

export function validateProfile(input: Pick<Profile, "name" | "gender" | "birthDate">): string | null {
  if (input.name.trim().length > 40) return "O nome pode ter até 40 caracteres.";
  if (input.birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || input.birthDate < "1900-01-01") return "Informe uma data de nascimento válida.";
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (input.birthDate > iso) return "A data de nascimento não pode estar no futuro.";
  }
  return null;
}

export async function saveProfileLocally(
  input: Pick<Profile, "name" | "gender" | "birthDate">, userId: string | null, database: FinanceDB = db,
): Promise<Profile> {
  const error = validateProfile(input);
  if (error) throw new Error(error);
  const profile: Profile = { ...input, name: input.name.trim(), updatedAt: Date.now(), userId, pending: true };
  await database.settings.put({ key: "profile", value: profile });
  return profile;
}

async function pushProfile(client: SupabaseClient, token: string, profile: Profile, userId: string, database: FinanceDB) {
  const savedAt = z.string().parse(await workspaceRpc(client, token, "save_finance_profile", {
    p_display_name: profile.name, p_gender: profile.gender, p_birth_date: profile.birthDate,
  }));
  const current = await readProfile(database);
  // Only clear the pending flag if nothing changed locally while the request was in flight.
  if (current && current.updatedAt === profile.updatedAt) {
    await database.settings.put({ key: "profile", value: { ...current, userId, pending: false, updatedAt: Date.parse(savedAt) || current.updatedAt } });
  }
}

/**
 * Reconciles the local profile with the account: pending local edits for this account are uploaded;
 * otherwise the account profile replaces the local copy. A profile filled before signing in is uploaded
 * only if the account has none yet.
 */
export async function syncProfile(client: SupabaseClient, token: string, userId: string, database: FinanceDB = db): Promise<void> {
  const local = await readProfile(database);
  if (local?.userId === userId && local.pending) return pushProfile(client, token, local, userId, database);
  const rows = serverSchema.parse(await workspaceRpc(client, token, "get_finance_profile"));
  const server = rows[0];
  if (server) {
    const latest = await readProfile(database);
    if (latest?.userId === userId && latest.pending) return;
    await database.settings.put({ key: "profile", value: {
      name: server.display_name ?? "", gender: server.gender, birthDate: server.birth_date,
      updatedAt: Date.parse(server.updated_at) || Date.now(), userId, pending: false,
    } satisfies Profile });
    return;
  }
  if (local && local.userId === null && (local.name || local.gender || local.birthDate)) {
    return pushProfile(client, token, { ...local, userId }, userId, database);
  }
}
