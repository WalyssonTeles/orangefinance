import { describe, expect, it, vi } from "vitest";
import { shareSpreadsheetReadOnly } from "./google-drive-sharing";

describe("compartilhamento da planilha no Google Drive", () => {
  it("mantém leitores, rebaixa edição e concede leitura sem expor o token no corpo", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (init?.method === "GET") return {
        ok: true,
        json: async () => ({ permissions: [
          { id: "reader-id", type: "user", role: "reader", emailAddress: "reader@example.com" },
          { id: "writer-id", type: "user", role: "writer", emailAddress: "writer@example.com" },
        ] }),
      } as Response;
      return { ok: true, json: async () => ({ id: "permission-id" }) } as Response;
    });

    await expect(shareSpreadsheetReadOnly("secret-token", "valid-sheet-id-123", [
      { userId: crypto.randomUUID(), email: "Reader@example.com" },
      { userId: crypto.randomUUID(), email: "writer@example.com" },
      { userId: crypto.randomUUID(), email: "new@example.com" },
      { userId: crypto.randomUUID(), email: "NEW@example.com" },
    ], fetcher as typeof fetch)).resolves.toBe(2);

    expect(calls).toHaveLength(3);
    expect(calls[1].url).toContain("/permissions/writer-id?fields=id");
    expect(calls[1].init?.method).toBe("PATCH");
    expect(calls[1].init?.body).toBe('{"role":"reader"}');
    expect(calls[2].url).toContain("sendNotificationEmail=false");
    expect(calls[2].init?.method).toBe("POST");
    expect(calls[2].init?.body).toBe('{"type":"user","role":"reader","emailAddress":"new@example.com"}');
    expect(calls.map((call) => call.init?.body).join("")).not.toContain("secret-token");
    expect(calls.every((call) => (call.init?.headers as Record<string, string>).Authorization === "Bearer secret-token")).toBe(true);
  });

  it("expõe erros de autorização e limite sem tentar continuar", async () => {
    for (const [status, message] of [[401, "expirou"], [403, "não permitiu"], [429, "Limite"]] as const) {
      const fetcher = vi.fn(async () => ({ ok: false, status } as Response));
      await expect(shareSpreadsheetReadOnly("token", "valid-sheet-id-123", [],
        fetcher as typeof fetch)).rejects.toThrow(message);
      expect(fetcher).toHaveBeenCalledOnce();
    }
  });
});
