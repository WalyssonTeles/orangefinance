import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db, type FinanceDB } from "./db";
import { defaultRecords } from "./repo";
import {
  applySyncData, hasUserData, mergeSyncData, parseSyncData, readSyncData, stable, validateReferences,
  type Conflict, type ConflictChoice, type SyncData,
} from "./sync-data";

export interface RemoteSnapshot { revision: number; data: SyncData }
export interface SyncRemote {
  workspaceId: string;
  read(): Promise<RemoteSnapshot | null>;
  write(expectedRevision: number, data: SyncData): Promise<boolean>;
}
export interface Resolution { signature: string; choice: ConflictChoice }

export class SyncConflict extends Error {
  constructor(public conflicts: Conflict[], public signature: string) {
    super("O mesmo registro foi alterado em dois aparelhos. Escolha qual versão manter em Ajustes.");
  }
}

export function supabaseRemote(client: SupabaseClient, workspaceId: string, accessToken: string): SyncRemote {
  return {
    workspaceId,
    async read() {
      const { data, error } = await client.from("workspace_finance").select("revision,data").eq("workspace_id", workspaceId)
        .maybeSingle().setHeader("Authorization", `Bearer ${accessToken}`);
      if (error) throw new Error(`Não foi possível ler a nuvem: ${error.message}`);
      if (data === null) return null;
      const row = z.object({ revision: z.number().int().positive().safe(), data: z.unknown() }).parse(data);
      return { revision: row.revision, data: parseSyncData(row.data) };
    },
    async write(expectedRevision, data) {
      if (new TextEncoder().encode(JSON.stringify(data)).length > 5_000_000) {
        throw new Error("Os dados excedem o limite de 5 MB por conta. Exporte um backup antes de continuar.");
      }
      const { data: written, error } = await client.rpc("write_workspace_finance", {
        p_workspace: workspaceId, p_expected_revision: expectedRevision, p_data: data,
      }).setHeader("Authorization", `Bearer ${accessToken}`);
      if (error) throw new Error(`Não foi possível salvar na nuvem: ${error.message}`);
      if (typeof written !== "boolean") throw new Error("O servidor retornou uma resposta de sincronização incompatível.");
      return written;
    },
  };
}

function tables(database: FinanceDB) {
  return [database.accounts, database.categories, database.transactions, database.budgets, database.settings, database.syncState];
}

export async function connectSync(
  userId: string, remote: SyncRemote, useCloud: boolean | "auto", database: FinanceDB = db,
): Promise<"connected" | "choice-required"> {
  const existing = await database.syncState.get("connection");
  if (existing && existing.userId !== userId) throw new Error("Este navegador já está vinculado a outra conta.");
  if (existing && existing.workspaceId !== remote.workspaceId) throw new Error("Use a troca de espaços para preservar os dados pendentes.");
  if (existing) return "connected";
  for (let attempt = 0; attempt < 4; attempt++) {
    const cloud = await remote.read();
    const local = await database.transaction("r", tables(database), () => readSyncData(database));
    if (useCloud === "auto" && cloud && hasUserData(local) && hasUserData(cloud.data) &&
      stable(local) !== stable(cloud.data)) return "choice-required";
    if (cloud && useCloud === false) throw new Error("Esta conta já tem dados na nuvem. Use os dados da nuvem ou exporte um backup local antes de continuar.");
    if (!cloud && useCloud === true) throw new Error("Esta conta ainda não possui dados na nuvem.");
    const upload = !cloud || (useCloud === "auto" && hasUserData(local) && !hasUserData(cloud.data));
    const selected = upload ? local : cloud!.data;
    validateReferences(selected);
    if (upload && !await remote.write(cloud?.revision ?? 0, selected)) continue;
    await database.transaction("rw", tables(database), async () => {
      const current = await database.syncState.get("connection");
      if (current) {
        if (current.userId === userId && current.workspaceId === remote.workspaceId) return;
        throw new Error("A conta mudou em outra aba. Recarregue o aplicativo.");
      }
      if (stable(await readSyncData(database)) !== stable(local)) {
        throw new Error("Os dados deste aparelho mudaram durante a preparação. Tente novamente; eles foram preservados.");
      }
      await applySyncData(database, selected);
      await database.syncState.put({
        key: "connection", userId, workspaceId: remote.workspaceId,
        revision: (cloud?.revision ?? 0) + (upload ? 1 : 0), base: selected,
      });
    });
    return "connected";
  }
  throw new Error("Não foi possível preparar seus dados agora. Tente novamente; os dados deste aparelho foram preservados.");
}

export async function syncOnce(
  userId: string, remote: SyncRemote, database: FinanceDB = db, resolution?: Resolution,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { connection, local } = await database.transaction("r", tables(database), async () => ({
      connection: await database.syncState.get("connection"), local: await readSyncData(database),
    }));
    if (!connection || connection.userId !== userId || connection.workspaceId !== remote.workspaceId) {
      throw new Error("Os dados locais não estão vinculados à conta e ao espaço conectados.");
    }
    const cloud = await remote.read();
    if (!cloud) throw new Error("Os dados da conta foram removidos da nuvem. A cópia local foi preservada; exporte um backup.");
    const merged = mergeSyncData(connection.base, local, cloud.data);
    let selected = merged.data;
    if (merged.conflicts.length) {
      if (!resolution || resolution.signature !== merged.signature) throw new SyncConflict(merged.conflicts, merged.signature);
      selected = mergeSyncData(connection.base, local, cloud.data, resolution.choice).data;
    }
    validateReferences(selected);
    const changed = stable(selected) !== stable(cloud.data);
    if (!changed && stable(local) === stable(selected) && stable(connection.base) === stable(selected) &&
      connection.revision === cloud.revision) return;
    if (changed && !await remote.write(cloud.revision, selected)) continue;
    const applied = await database.transaction("rw", tables(database), async () => {
      const current = await database.syncState.get("connection");
      if (!current || current.userId !== userId || current.workspaceId !== remote.workspaceId) {
        throw new Error("A conta ou o espaço local mudou durante a sincronização.");
      }
      if (stable(current) !== stable(connection) || stable(await readSyncData(database)) !== stable(local)) return false;
      await applySyncData(database, selected);
      await database.syncState.put({
        key: "connection", userId, workspaceId: remote.workspaceId, revision: cloud.revision + (changed ? 1 : 0), base: selected,
      });
      return true;
    });
    if (applied) return;
  }

  throw new Error("Os dados mudaram durante a sincronização. Tente novamente; nenhuma alteração local foi descartada.");
}

export async function switchWorkspace(
  userId: string, remote: SyncRemote, database: FinanceDB = db,
): Promise<void> {
  const cacheId = `${userId}:${remote.workspaceId}`;
  const cached = await database.workspaceCache.get(cacheId);
  let target = cached?.connection;
  let data = cached?.data;
  if (!target || !data) {
    let cloud = await remote.read();
    if (!cloud) {
      const initial: SyncData = { ...defaultRecords(), transactions: [], budgets: [], settings: [] };
      if (!await remote.write(0, initial)) {
        cloud = await remote.read();
        if (!cloud) throw new Error("Não foi possível inicializar o espaço.");
      } else cloud = { revision: 1, data: initial };
    }
    data = parseSyncData(cloud.data);
    target = { key: "connection", userId, workspaceId: remote.workspaceId, revision: cloud.revision, base: data };
  }
  const selected = parseSyncData(data);
  const selectedConnection = target;
  await database.transaction("rw", [...tables(database), database.workspaceCache], async () => {
    const current = await database.syncState.get("connection");
    if (!current || current.userId !== userId) throw new Error("Entre na conta vinculada antes de trocar de espaço.");
    if (current.workspaceId === remote.workspaceId) return;
    const latestCache = await database.workspaceCache.get(cacheId);
    await database.workspaceCache.put({
      id: `${userId}:${current.workspaceId}`, connection: current, data: await readSyncData(database),
    });
    await applySyncData(database, latestCache ? parseSyncData(latestCache.data) : selected);
    await database.syncState.put(latestCache?.connection ?? selectedConnection);
  });
}
