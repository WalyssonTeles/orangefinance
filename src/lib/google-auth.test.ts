import { createClient, AuthApiError, type Session } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { completeGoogleSignIn, googleSignInUrl, oauthRedirectUrl } from "./google-auth";

const client = createClient("https://example.supabase.co", "test-publishable-key", {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, flowType: "pkce" },
});
const session: Session = {
  access_token: "test-access-token", refresh_token: "test-refresh-token", expires_in: 3600, token_type: "bearer",
  user: { id: "test-user", aud: "authenticated", created_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {} },
};
afterEach(() => vi.restoreAllMocks());

describe("Google OAuth with PKCE", () => {
  it("returns to the correct production subpath or local root without hashes or query parameters", () => {
    expect(oauthRedirectUrl("https://walyssonteles.github.io", "/orangefinance/"))
      .toBe("https://walyssonteles.github.io/orangefinance/");
    expect(oauthRedirectUrl("http://localhost:5180", "/")).toBe("http://localhost:5180/");
  });

  it("requests only Google identity scopes and allows account selection", async () => {
    const signIn = vi.spyOn(client.auth, "signInWithOAuth").mockResolvedValue({
      data: { provider: "google", url: "https://example.supabase.co/auth/v1/authorize?provider=google" }, error: null,
    });
    await expect(googleSignInUrl(client, "https://walyssonteles.github.io/orangefinance/")).resolves.toContain("provider=google");
    expect(signIn).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://walyssonteles.github.io/orangefinance/",
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
  });

  it("surfaces provider errors instead of returning a fake sign-in URL", async () => {
    vi.spyOn(client.auth, "signInWithOAuth").mockResolvedValue({
      data: { provider: "google", url: null }, error: new AuthApiError("Provider disabled", 400, "provider_disabled"),
    });
    await expect(googleSignInUrl(client, "https://example.com/")).rejects.toThrow("Provider disabled");
  });

  it("ignores normal hash-based application routes", async () => {
    const exchange = vi.spyOn(client.auth, "exchangeCodeForSession");
    const replace = vi.fn();
    expect(await completeGoogleSignIn(client, "https://example.com/orangefinance/#/lancamentos", replace)).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("cleans the callback URL before exchanging the code and then opens Settings", async () => {
    const replace = vi.fn();
    const exchange = vi.spyOn(client.auth, "exchangeCodeForSession").mockImplementation(async () => {
      expect(replace).toHaveBeenCalledWith("https://example.com/orangefinance/?keep=1#/ajustes");
      return { data: { user: session.user, session }, error: null };
    });
    expect(await completeGoogleSignIn(client, "https://example.com/orangefinance/?code=single-use-code&keep=1", replace)).toBeNull();
    expect(exchange).toHaveBeenCalledOnce();
    expect(exchange).toHaveBeenCalledWith("single-use-code");
  });

  it.each(["?error=access_denied&error_description=Cancelado", "#error=access_denied&error_description=Cancelado"])(
    "surfaces OAuth cancellation from %s without exchanging a code", async (suffix) => {
      const exchange = vi.spyOn(client.auth, "exchangeCodeForSession");
      const replace = vi.fn();
      expect(await completeGoogleSignIn(client, `https://example.com/orangefinance/${suffix}`, replace)).toContain("Cancelado");
      expect(exchange).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith("https://example.com/orangefinance/#/ajustes");
    },
  );

  it("explains a missing or expired PKCE verifier and leaves a clean URL", async () => {
    vi.spyOn(client.auth, "exchangeCodeForSession").mockResolvedValue({
      data: { user: null, session: null }, error: new AuthApiError("Invalid code verifier", 400, "bad_code_verifier"),
    });
    const replace = vi.fn();
    expect(await completeGoogleSignIn(client, "https://example.com/?code=expired", replace)).toContain("mesmo navegador");
    expect(replace).toHaveBeenCalledWith("https://example.com/#/ajustes");
  });

  it("reports missing configuration or an empty authorization code", async () => {
    expect(await completeGoogleSignIn(null, "https://example.com/?code=abc", vi.fn())).toContain("Configure");
    expect(await completeGoogleSignIn(client, "https://example.com/?code=", vi.fn())).toContain("código válido");
  });
});
