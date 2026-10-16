import { todayISO } from "./dates";
import { exportBackup, parseBackup } from "./repo";
import { db } from "./db";

export async function downloadBackup(previousVersion = false): Promise<void> {
  const snapshot = previousVersion ? await db.releaseBackups.get("pre-1.2") : undefined;
  if (previousVersion && (!snapshot || !snapshot.data || typeof snapshot.data !== "object")) throw new Error("Não há cópia anterior à versão 1.2 neste navegador.");
  const backup = snapshot && snapshot.data && typeof snapshot.data === "object"
    ? parseBackup(JSON.stringify({ ...snapshot.data, app: "orange-finance", version: 1, exportedAt: new Date().toISOString() }))
    : await exportBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `orange-finance-${previousVersion ? "pre-1.2-" : ""}backup-${todayISO()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
