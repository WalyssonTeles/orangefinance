import type { SupabaseClient } from "@supabase/supabase-js";

const CALLBACK_PARAMS = ["code", "error", "error_code", "error_description"];

export function oauthRedirectUrl(origin: string, base: string): string {
  return new URL(base, origin).href;
}

export async function googleSignInUrl(client: SupabaseClient, redirectTo: string): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "openid email profile",
      queryParams: { prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("O Supabase não retornou o endereço de login com Google.");
  return data.url;
}

export async function completeGoogleSignIn(
  client: SupabaseClient | null, href: string, replaceUrl: (cleanUrl: string) => void,
): Promise<string | null> {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const hasError = url.searchParams.has("error") || fragment.has("error");
  if (!url.searchParams.has("code") && !hasError) return null;

  const code = url.searchParams.get("code");
  const description = url.searchParams.get("error_description") ?? fragment.get("error_description");
  for (const name of CALLBACK_PARAMS) url.searchParams.delete(name);
  url.hash = "/ajustes";
  replaceUrl(url.href);

  if (hasError) return `O login com Google não foi concluído${description ? `: ${description.slice(0, 500)}` : ". Tente novamente."}`;
  if (!client) return "Configure o Supabase antes de concluir o login com Google.";
  if (!code) return "O retorno do Google não contém um código válido. Inicie o login novamente.";
  try {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return null;
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    return `Não foi possível concluir o login com Google.${detail} Inicie novamente e conclua no mesmo navegador e perfil.`;
  }
}
