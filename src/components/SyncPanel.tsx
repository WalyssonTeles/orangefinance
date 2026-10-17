import { useState } from "react";
import { downloadBackup } from "../lib/download-backup";
import { supabaseConfigError } from "../lib/supabase";
import { useSync } from "../sync-context";
import { Button, Card, CardHeader } from "./ui";
import { clearSheetsToken } from "../lib/google-sheets-auth";

export function SyncPanel({ onboarding = false }: { onboarding?: boolean }) {
  const sync = useSync();
  const [backupError, setBackupError] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="Conta e sincronização" />
      {supabaseConfigError ? <p role="alert" className="text-sm text-muted">{supabaseConfigError}</p> : (
        <div className="space-y-4">
          {!sync.session ? (
            <>
              <p className="text-sm text-muted">
                Entre com a mesma conta Google em todos os aparelhos para sincronizar. Se este navegador já foi vinculado,
                os dados só serão exibidos após entrar novamente na mesma conta. O armazenamento local não é criptografado;
                use bloqueio de tela e não compartilhe o perfil do navegador.
              </p>
              <Button disabled={sync.busy || !sync.online} onClick={() => void sync.signInWithGoogle()}>
                {sync.busy ? "Abrindo Google..." : "Entrar com Google"}
              </Button>
              <p className="text-xs text-muted">
                Você será redirecionado ao Google e voltará ao aplicativo neste navegador. Não pedimos sua senha nem
                acesso às mensagens do Gmail. Não é necessário receber código por e-mail.
              </p>
            </>
          ) : (
            <>
              <p className="break-all text-sm">Conta: <strong>{sync.session.user.email}</strong></p>
              {!sync.wrongAccount && sync.bound && sync.activeSpace?.kind === "shared" && (
                <p className="text-sm text-muted">Espaço aberto: <strong>{sync.activeSpace.name}</strong>. Gerencie em Espaço compartilhado.</p>
              )}
              {sync.wrongAccount ? (
                <p role="alert" className="text-sm text-negative">
                  Este navegador tem dados de outra conta. Saia e entre na conta originalmente vinculada.
                  Para usar outra conta, utilize outro perfil do navegador.
                </p>
              ) : onboarding ? (
                <div className="space-y-3 text-sm">
                  {sync.initialChoice ? (
                    <>
                      <p className="font-semibold">Encontramos dados diferentes neste aparelho e na sua conta.</p>
                      <p>Para não perder nada, salve uma cópia dos dados deste aparelho antes de continuar com os dados da sua conta.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" disabled={sync.busy} onClick={async () => {
                          try { await downloadBackup(); setBackupError(null); }
                          catch (cause) { setBackupError(cause instanceof Error ? cause.message : "Não foi possível salvar a cópia."); }
                        }}>Salvar cópia deste aparelho</Button>
                        <Button disabled={sync.busy || !sync.online} onClick={() => {
                          if (window.confirm("Continuar com os dados da sua conta? Os dados deste aparelho serão substituídos. Salve uma cópia antes se quiser mantê-los.")) void sync.connect(true);
                        }}>Continuar com minha conta</Button>
                      </div>
                    </>
                  ) : (
                    <p role="status">
                      {!sync.online ? "Conecte-se à internet para carregar seus dados. Continuaremos automaticamente quando a conexão voltar."
                        : sync.error ? "Não conseguimos carregar seus dados agora. Nada foi apagado."
                          : "Preparando seus dados... Isso acontece automaticamente."}
                    </p>
                  )}
                  {sync.error && <Button variant="secondary" disabled={sync.busy || !sync.online} onClick={async () => {
                    try { await sync.refreshSpaces(); setBackupError(null); await sync.connect("auto"); }
                    catch (cause) { setBackupError(cause instanceof Error ? cause.message : "Não foi possível carregar sua conta."); }
                  }}>Tentar novamente</Button>}
                </div>
              ) : (
                <>
                  <p role="status" className="text-sm text-muted">
                    {!sync.online ? "Offline: alterações pendentes ficam neste aparelho." : sync.syncing ? "Sincronizando..."
                      : sync.lastSynced ? `Última sincronização: ${sync.lastSynced.toLocaleTimeString("pt-BR")}.`
                        : "Aguardando sincronização."}
                    {" "}Enquanto o app estiver aberto, a verificação ocorre a cada 15 segundos e após alterações locais.
                  </p>
                  <Button variant="secondary" disabled={sync.busy || sync.syncing || !sync.online} onClick={() => void sync.synchronize()}>
                    Sincronizar agora
                  </Button>
                  {sync.conflict && (
                    <div role="alert" className="space-y-3 rounded-xl bg-orange-soft p-3 text-sm">
                      <p className="font-semibold">Alterações conflitantes: {sync.conflict.conflicts.length}</p>
                      <p>Escolha a versão para todos os registros listados. As alterações em outros registros serão preservadas.</p>
                      <ul className="space-y-2">
                        {sync.conflict.conflicts.map((item) => (
                          <li key={`${item.table}:${item.id}`}>
                            <p className="font-semibold">{item.table}: {item.label}</p>
                            <details>
                              <summary className="cursor-pointer">Comparar versões</summary>
                              <p>Neste aparelho:</p>
                              <pre className="max-h-48 overflow-auto text-xs">{item.local === undefined ? "Removido" : JSON.stringify(item.local, null, 2)}</pre>
                              <p>Na nuvem:</p>
                              <pre className="max-h-48 overflow-auto text-xs">{item.remote === undefined ? "Removido" : JSON.stringify(item.remote, null, 2)}</pre>
                            </details>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={sync.syncing || !sync.online} onClick={() => void sync.synchronize({ choice: "local", signature: sync.conflict!.signature })}>Manter versões deste aparelho</Button>
                        <Button variant="secondary" disabled={sync.syncing || !sync.online} onClick={() => void sync.synchronize({ choice: "remote", signature: sync.conflict!.signature })}>Manter versões da nuvem</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {sync.bound && <p className="text-xs text-muted">Ao sair, alterações ainda não enviadas ficam neste aparelho. Entre novamente na mesma conta para retomá-las.</p>}
              <Button variant="ghost" disabled={sync.busy || sync.syncing} onClick={() => {
                clearSheetsToken();
                void sync.signOut();
              }}>Sair desta conta neste aparelho</Button>
            </>
          )}
          {(sync.error || backupError) && <p role="alert" className="break-words text-sm text-negative">{sync.error || backupError}</p>}
          {sync.message && <p role="status" className="text-sm text-positive">{sync.message}</p>}
          {!sync.online && <p role="status" className="text-sm text-muted">Sem conexão com a internet.</p>}
        </div>
      )}
    </Card>
  );
}
