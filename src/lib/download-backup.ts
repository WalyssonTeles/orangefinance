import { todayISO } from "./dates";
import { exportBackup } from "./repo";

export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `orange-finance-backup-${todayISO()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
