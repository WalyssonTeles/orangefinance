import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeSheets, clearSheetsToken, currentSheetsToken } from "./google-sheets-auth";

afterEach(() => {
  clearSheetsToken();
  vi.unstubAllGlobals();
});

describe("autorização temporária do Google Sheets", () => {
  it("aceita apenas token com permissão drive.file e o mantém somente em memória", async () => {
    let scope = "https://www.googleapis.com/auth/drive.file";
    const requestAccessToken = vi.fn();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {
      google: { accounts: { oauth2: { initTokenClient: ({ callback }: { callback: (response: unknown) => void }) => ({
        requestAccessToken() {
          requestAccessToken();
          callback({ access_token: "temporario", expires_in: 3600, scope });
        },
      }) } } },
    });
    await expect(authorizeSheets()).resolves.toBe("temporario");
    expect(currentSheetsToken()).toBe("temporario");
    expect(requestAccessToken).toHaveBeenCalledOnce();
    clearSheetsToken();
    expect(currentSheetsToken()).toBeNull();
    scope = "openid email";
    await expect(authorizeSheets()).rejects.toThrow("não foi autorizado");
    expect(currentSheetsToken()).toBeNull();
  });
});
