import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigError =
  !url && !key
    ? "Sincronização não configurada nesta versão do aplicativo."
    : !url || !key || !URL.canParse(url) || new URL(url).protocol !== "https:" || !key.startsWith("sb_publishable_")
      ? "Configuração Supabase inválida. Use a URL HTTPS e apenas a chave publishable."
      : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: false },
    });
