import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { FinanceDB } from "./db";
import { seedDefaults, setSetting, wipeAll, exportBackup, importBackup, parseBackup } from "./repo";
import { hasUserData, readSyncData, stable, type SyncData } from "./sync-data";
import { connectSync, switchWorkspace, syncOnce, SyncConflict, type RemoteSnapshot, type SyncRemote } from "./sync";

const databases: FinanceDB[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

function memoryRemote(): SyncRemote & { snapshot: RemoteSnapshot | null; beforeWrite?: () => Promise<void> } {
  return {
    workspaceId: "personal",
    snapshot: null,
    async read() { return structuredClone(this.snapshot); },
    async write(revision, data) {
      if (this.beforeWrite) { const task = this.beforeWrite; this.beforeWrite = undefined; await task(); }
      if ((this.snapshot?.revision ?? 0) !== revision) return false;
      this.snapshot = { revision: revision + 1, data: structuredClone(data) };
      return true;
    },
  };
}

async function device() {
  const db = new FinanceDB(`sync-test-${crypto.randomUUID()}`);
  databases.push(db);
  await seedDefaults(db);
  return db;
}

async function pair() {
  const a = await device(), b = await device(), remote = memoryRemote();
  await connectSync("user-a", remote, false, a);
  await connectSync("user-a", remote, true, b);
  return { a, b, remote };
}

async function rename(db: FinanceDB, name: string) {
  const account = (await db.accounts.toArray())[0];
  await db.accounts.update(account.id, { name, updatedAt: account.updatedAt + 1 });
}

async function getConflict(work: () => Promise<void>): Promise<SyncConflict> {
  try { await work(); }
  catch (error) { if (error instanceof SyncConflict) return error; throw error; }
  throw new Error("Expected a synchronization conflict.");
}

describe("bidirectional synchronization", () => {
  it("automatically connects a new account without asking about seeded starter data", async () => {
    const a = await device(), remote = memoryRemote();
    expect(hasUserData(await readSyncData(a))).toBe(false);
    await expect(connectSync("user-a", remote, "auto", a)).resolves.toBe("connected");
    expect(remote.snapshot?.revision).toBe(1);
    expect((await a.syncState.get("connection"))?.userId).toBe("user-a");
  });

  it("automatically downloads existing account data into an unused device without uploading its seed", async () => {
    const { a, remote } = await pair();
    await rename(a, "Conta existente");
    await syncOnce("user-a", remote, a);
    const fresh = await device();
    await setSetting("hideValues", true, fresh);
    const before = structuredClone(remote.snapshot);
    await expect(connectSync("user-a", remote, "auto", fresh)).resolves.toBe("connected");
    expect(remote.snapshot).toEqual(before);
    expect((await fresh.accounts.toArray())[0].name).toBe("Conta existente");
    expect(await fresh.categories.count()).toBe(17);
    expect((await fresh.settings.get("hideValues"))?.value).toBe(true);
  });

  it("automatically uploads local financial data when the account has no data", async () => {
    const a = await device(), remote = memoryRemote();
    await rename(a, "Meus dados anteriores");
    await expect(connectSync("user-a", remote, "auto", a)).resolves.toBe("connected");
    expect(remote.snapshot?.data.accounts[0].name).toBe("Meus dados anteriores");
  });

  it("does not mistake a starter-only cloud snapshot for personal data", async () => {
    const { remote } = await pair();
    const fresh = await device();
    await rename(fresh, "Conta com dados locais");
    await expect(connectSync("user-a", remote, "auto", fresh)).resolves.toBe("connected");
    expect(remote.snapshot?.data.accounts[0].name).toBe("Conta com dados locais");
    expect(await fresh.categories.count()).toBe(17);
  });

  it("asks only when both the device and the account have different user data, without changing either", async () => {
    const { a, remote } = await pair();
    await rename(a, "Computador");
    await syncOnce("user-a", remote, a);
    const fresh = await device();
    await rename(fresh, "Celular com dados anteriores");
    const before = structuredClone(remote.snapshot);
    const localBefore = await readSyncData(fresh);
    await expect(connectSync("user-a", remote, "auto", fresh)).resolves.toBe("choice-required");
    expect(remote.snapshot).toEqual(before);
    expect(await readSyncData(fresh)).toEqual(localBefore);
    expect(await fresh.syncState.get("connection")).toBeUndefined();
    await expect(connectSync("user-a", remote, true, fresh)).resolves.toBe("connected");
    expect((await fresh.accounts.toArray())[0].name).toBe("Computador");
  });

  it("does not ask when the existing local and account data are already identical", async () => {
    const { a, remote } = await pair();
    await rename(a, "Conta existente");
    await syncOnce("user-a", remote, a);
    const fresh = await device();
    await importBackup(await exportBackup(a), fresh);
    await expect(connectSync("user-a", remote, "auto", fresh)).resolves.toBe("connected");
  });

  it("retries automatic first login if another device initializes the account simultaneously", async () => {
    const a = await device(), b = await device(), remote = memoryRemote();
    await rename(b, "Conta do outro aparelho");
    remote.beforeWrite = async () => { await connectSync("user-a", remote, "auto", b); };
    await expect(connectSync("user-a", remote, "auto", a)).resolves.toBe("connected");
    expect((await a.accounts.toArray())[0].name).toBe("Conta do outro aparelho");
  });

  it("recognizes meaningful changes even without transactions and ignores randomized starter IDs", async () => {
    const a = await device(), b = await device();
    const starter = await readSyncData(a);
    expect(stable(starter)).not.toBe(stable(await readSyncData(b)));
    expect(hasUserData(starter)).toBe(false);
    expect(hasUserData(await readSyncData(b))).toBe(false);
    const account = starter.accounts[0];
    await a.accounts.update(account.id, { initialBalance: 1 });
    expect(hasUserData(await readSyncData(a))).toBe(true);
    await a.accounts.update(account.id, { initialBalance: 0 });
    await setSetting("userName", "Meu nome", a);
    expect(hasUserData(await readSyncData(a))).toBe(true);
    await setSetting("userName", "", a);
    const category = starter.categories[0];
    await a.categories.update(category.id, { deletedAt: 1 });
    expect(hasUserData(await readSyncData(a))).toBe(true);
  });

  it("uploads initial data only with explicit linking and downloads the existing cloud snapshot", async () => {
    const { a, b, remote } = await pair();
    expect(stable(await readSyncData(a))).toBe(stable(await readSyncData(b)));
    expect(remote.snapshot?.revision).toBe(1);
    expect(await b.categories.count()).toBe(17);
  });

  it("combines offline changes to different records from two devices", async () => {
    const { a, b, remote } = await pair();
    await rename(a, "Conta do computador");
    const category = (await b.categories.toArray())[0];
    await b.categories.update(category.id, { name: "Categoria do celular", updatedAt: category.updatedAt + 1 });
    await syncOnce("user-a", remote, a);
    await syncOnce("user-a", remote, b);
    await syncOnce("user-a", remote, a);
    expect(stable(await readSyncData(a))).toBe(stable(await readSyncData(b)));
    expect((await a.accounts.toArray())[0].name).toBe("Conta do computador");
    expect((await a.categories.get(category.id))?.name).toBe("Categoria do celular");
  });

  it.each(["local", "remote"] as const)("pauses conflicts without losing edits, then applies the %s choice", async (choice) => {
    const { a, b, remote } = await pair();
    await rename(a, "Computador");
    await rename(b, "Celular");
    await syncOnce("user-a", remote, a);
    const before = structuredClone(remote.snapshot);
    const conflict = await getConflict(() => syncOnce("user-a", remote, b));
    expect(conflict.conflicts).toHaveLength(1);
    expect(remote.snapshot).toEqual(before);
    expect((await b.accounts.toArray())[0].name).toBe("Celular");
    await syncOnce("user-a", remote, b, { signature: conflict.signature, choice });
    await syncOnce("user-a", remote, a);
    expect((await a.accounts.toArray())[0].name).toBe(choice === "local" ? "Celular" : "Computador");
  });

  it("does not apply a stale conflict decision when a cloud version changes again", async () => {
    const { a, b, remote } = await pair();
    await rename(a, "Computador");
    await rename(b, "Celular");
    await syncOnce("user-a", remote, a);
    const conflict = await getConflict(() => syncOnce("user-a", remote, b));
    await rename(a, "Computador novo");
    await syncOnce("user-a", remote, a);
    await expect(syncOnce("user-a", remote, b, { choice: "local", signature: conflict.signature })).rejects.toBeInstanceOf(SyncConflict);
  });

  it("propagates deletes and complete wipes, preserving the account binding", async () => {
    const { a, b, remote } = await pair();
    const account = (await a.accounts.toArray())[0];
    await a.accounts.update(account.id, { deletedAt: Date.now(), updatedAt: Date.now() });
    await syncOnce("user-a", remote, a);
    await syncOnce("user-a", remote, b);
    expect((await b.accounts.get(account.id))?.deletedAt).not.toBeNull();
    await wipeAll(a);
    await syncOnce("user-a", remote, a);
    await syncOnce("user-a", remote, b);
    expect(stable(await readSyncData(a))).toBe(stable(await readSyncData(b)));
    expect((await b.syncState.get("connection"))?.userId).toBe("user-a");
  });

  it("treats backup imports as local changes and preserves non-synced preferences", async () => {
    const { a, b, remote } = await pair();
    await setSetting("hideValues", true, b);
    const backup = await exportBackup(a);
    backup.accounts[0].name = "Importada";
    await importBackup(backup, a);
    await syncOnce("user-a", remote, a);
    await syncOnce("user-a", remote, b);
    expect((await b.accounts.toArray())[0].name).toBe("Importada");
    expect((await b.settings.get("hideValues"))?.value).toBe(true);
  });

  it("retries after a compare-and-swap collision rather than overwriting the other device", async () => {
    const { a, b, remote } = await pair();
    await rename(a, "Computador");
    const category = (await b.categories.toArray())[0];
    await b.categories.update(category.id, { name: "Celular" });
    remote.beforeWrite = () => syncOnce("user-a", remote, b);
    await syncOnce("user-a", remote, a);
    expect(remote.snapshot?.data.accounts[0].name).toBe("Computador");
    expect(remote.snapshot?.data.categories.find((c) => c.id === category.id)?.name).toBe("Celular");
  });

  it("preserves edits made while a network request is in flight", async () => {
    const { a, remote } = await pair();
    await rename(a, "Primeira");
    remote.beforeWrite = () => rename(a, "Alterada durante envio");
    const conflict = await getConflict(() => syncOnce("user-a", remote, a));
    expect((await a.accounts.toArray())[0].name).toBe("Alterada durante envio");
    await syncOnce("user-a", remote, a, { signature: conflict.signature, choice: "local" });
    expect(remote.snapshot?.data.accounts[0].name).toBe("Alterada durante envio");
  });

  it("does not replace local data or upload it for a different authenticated user", async () => {
    const { a, remote } = await pair();
    const before = structuredClone(remote.snapshot);
    await expect(connectSync("user-b", remote, true, a)).rejects.toThrow(/outra conta/);
    await expect(syncOnce("user-b", remote, a)).rejects.toThrow(/não estão vinculados/);
    expect(remote.snapshot).toEqual(before);
  });

  it("does not silently replace an existing cloud snapshot on first connection", async () => {
    const { remote } = await pair();
    const c = await device();
    const before = structuredClone(remote.snapshot);
    await expect(connectSync("user-a", remote, false, c)).rejects.toThrow(/já tem dados/);
    expect(remote.snapshot).toEqual(before);
    expect(await c.syncState.get("connection")).toBeUndefined();
  });

  it("preserves local data after a network error", async () => {
    const { a } = await pair();
    await rename(a, "Pendente");
    const remote: SyncRemote = {
      workspaceId: "personal",
      async read() { throw new Error("Sem conexão"); },
      async write() { throw new Error("Não deveria escrever"); },
    };
    await expect(syncOnce("user-a", remote, a)).rejects.toThrow("Sem conexão");
    expect((await a.accounts.toArray())[0].name).toBe("Pendente");
  });

  it("keeps private and family data separate and preserves pending offline edits when switching", async () => {
    const { a, remote } = await pair();
    await rename(a, "Conta privada pendente");
    const family = memoryRemote();
    family.workspaceId = "family";
    await switchWorkspace("user-a", family, a);
    expect((await a.accounts.toArray())[0].name).toBe("Conta principal");
    expect((await a.syncState.get("connection"))?.workspaceId).toBe("family");
    await rename(a, "Conta familiar pendente");
    await switchWorkspace("user-a", remote, a);
    expect((await a.accounts.toArray())[0].name).toBe("Conta privada pendente");
    await syncOnce("user-a", remote, a);
    expect(remote.snapshot?.data.accounts[0].name).toBe("Conta privada pendente");
    await switchWorkspace("user-a", family, a);
    expect((await a.accounts.toArray())[0].name).toBe("Conta familiar pendente");
    await syncOnce("user-a", family, a);
    expect(family.snapshot?.data.accounts[0].name).toBe("Conta familiar pendente");
  });

  it("does not send a private snapshot to a family remote selected by another tab", async () => {
    const { a } = await pair();
    const family = memoryRemote();
    family.workspaceId = "family";
    await expect(syncOnce("user-a", family, a)).rejects.toThrow(/espaço/);
    expect(family.snapshot).toBeNull();
  });

  it("rejects invalid cloud records and invalid backups before replacing local data", async () => {
    const { a } = await pair();
    const backup = await exportBackup(a);
    const corrupted = JSON.stringify(backup).replace('"initialBalance":0', '"initialBalance":"invalid"');
    expect(() => parseBackup(corrupted)).toThrow(/inválidos/);
    const before = await readSyncData(a);
    const malformed: SyncRemote = {
      workspaceId: "personal",
      async read() { return { revision: 1, data: { ...before, accounts: [] } }; },
      async write() { return true; },
    };
    const accountId = before.accounts[0].id;
    const invalid: SyncData = { ...before, budgets: [{ id: "invalid", categoryId: "missing", amount: 1, createdAt: 1, updatedAt: 1, deletedAt: null }] };
    const other = await device();
    await expect(connectSync("new-user", { ...malformed, async read() { return { revision: 1, data: invalid }; } }, true, other)).rejects.toThrow(/vinculados/);
    expect(await a.accounts.get(accountId)).toBeDefined();
  });
});
