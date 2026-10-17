import { z } from "zod";

const CLIENT_ID = "668213545509-4f5qg4ugqt4e8h0ood7l84d1c9qi5avf.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const tokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.string(),
});

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(options: {
        client_id: string;
        scope: string;
        callback: (response: unknown) => void;
        error_callback: (error: { type: string }) => void;
      }): TokenClient;
    };
  };
}

declare global {
  interface Window { google?: GoogleIdentity }
}

let token: { value: string; expiresAt: number } | null = null;
let loading: Promise<void> | null = null;

function loadIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => window.google?.accounts.oauth2 ? resolve() : reject(new Error("O login do Google não foi carregado."));
    script.onerror = () => reject(new Error("Não foi possível carregar o login do Google. Confira sua conexão."));
    document.head.appendChild(script);
  }).catch((cause: unknown) => {
    loading = null;
    throw cause;
  });
  return loading;
}

export function preloadSheetsIdentity(): Promise<void> {
  return loadIdentity();
}

export function currentSheetsToken(): string | null {
  return token && token.expiresAt > Date.now() + 60_000 ? token.value : null;
}

export async function authorizeSheets(): Promise<string> {
  if (!navigator.onLine) throw new Error("Conecte-se à internet para autorizar o Google Sheets.");
  await loadIdentity();
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback(response) {
        const parsed = tokenResponse.safeParse(response);
        if (!parsed.success || !parsed.data.scope.split(" ").includes(SCOPE)) {
          reject(new Error("O acesso aos arquivos criados pelo Orange Finance não foi autorizado."));
          return;
        }
        token = { value: parsed.data.access_token, expiresAt: Date.now() + parsed.data.expires_in * 1000 };
        resolve(token.value);
      },
      error_callback() { reject(new Error("A autorização do Google foi cancelada ou bloqueada pelo navegador.")); },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export function clearSheetsToken(): void {
  token = null;
}
