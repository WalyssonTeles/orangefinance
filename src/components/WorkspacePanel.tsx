import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { invitationSchema, memberSchema, workspaceRpc, type WorkspaceInvitation, type WorkspaceMember } from "../lib/workspaces";
import { useSync } from "../sync-context";
import { Button, Field, inputClass } from "./ui";

export function WorkspacePanel() {
  const sync = useSync();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [invitation, setInvitation] = useState("");
  const [createdInvite, setCreatedInvite] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const active = sync.activeSpace;
  const token = sync.session?.access_token;

  const request = useCallback(async (method: string, args?: Record<string, unknown>) => {
    if (!supabase || !token) throw new Error("Entre novamente na sua conta.");
    return workspaceRpc(supabase, token, method, args);
  }, [token]);

  const loadMembers = useCallback(async () => {
    if (!active || active.kind !== "shared" || !navigator.onLine) { setMembers([]); setInvitations([]); return; }
    const memberData = await request("list_finance_members", { p_workspace: active.id });
    const invitationData = active.role === "owner"
      ? await request("list_finance_invitations", { p_workspace: active.id }) : [];
    return { members: z.array(memberSchema).parse(memberData), invitations: z.array(invitationSchema).parse(invitationData) };
  }, [active?.id, active?.kind, active?.role, request]);

  useEffect(() => {
    let disposed = false;
    setCreatedInvite("");
    setMembers([]);
    setInvitations([]);
    setError(null);
    void loadMembers().then((data) => {
      if (!disposed && data) { setMembers(data.members); setInvitations(data.invitations); }
    }).catch((cause: unknown) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : "Não foi possível carregar participantes.");
    });
    return () => { disposed = true; };
  }, [loadMembers]);

  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação.");
    } finally { setBusy(false); }
  };
  const refreshMembers = async () => {
    const data = await loadMembers();
    if (data) { setMembers(data.members); setInvitations(data.invitations); }
  };
  const disabled = busy || sync.busy || sync.syncing;

  return (
    <div className="space-y-4 border-t border-line pt-4">
      <Field label="Espaço financeiro">
        <select className={inputClass} value={active?.id ?? ""} disabled={disabled} onChange={(event) => void sync.switchSpace(event.target.value)}>
          {!active && <option value="">Selecione um espaço disponível</option>}
          {sync.spaces.map((space) => <option key={space.id} value={space.id}>{space.kind === "personal" ? "Pessoal" : "Familiar"} — {space.name}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted">
        Seus dados pessoais não são enviados ao espaço familiar. Cada espaço tem contas e lançamentos próprios.
        Alterações pendentes ficam guardadas separadamente ao trocar. Volte ao espaço para retomar o envio.
      </p>
      <Button variant="ghost" disabled={disabled || !sync.online} onClick={() => void action(async () => {
        await sync.refreshSpaces(); await refreshMembers(); setNotice("Lista atualizada.");
      })}>Atualizar espaços e participantes</Button>
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        void action(async () => {
          const id = z.uuid().parse(await request("create_family_workspace", { p_name: name.trim() }));
          await sync.refreshSpaces();
          await sync.switchSpace(id);
          setName("");
        });
      }}>
        <Field label="Criar espaço familiar">
          <input className={inputClass} placeholder="Ex.: Nossa família" value={name} required maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Button variant="secondary" type="submit" disabled={disabled || !sync.online}>Criar espaço separado</Button>
      </form>
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        void action(async () => {
          const id = z.uuid().parse(await request("accept_finance_invitation", { p_invitation: z.uuid().parse(invitation.trim()) }));
          await sync.refreshSpaces();
          await sync.switchSpace(id);
          setInvitation("");
          setNotice("Convite aceito.");
        });
      }}>
        <Field label="Código de convite familiar">
          <input className={inputClass} value={invitation} required placeholder="Cole o código recebido" onChange={(event) => setInvitation(event.target.value)} />
        </Field>
        <Button variant="secondary" type="submit" disabled={disabled || !sync.online}>Aceitar convite</Button>
      </form>
      {active?.kind === "shared" && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <h3 className="font-semibold">Participantes de {active.name}</h3>
          <p className="text-xs text-muted">Todos os participantes podem consultar e alterar as finanças deste espaço. Somente o responsável gerencia os convites e acessos.</p>
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="break-all">{member.email} ({member.role === "owner" ? "responsável" : "participante"})</span>
                {active.role === "owner" && member.role === "member" && (
                  <Button variant="danger" className="h-9" disabled={disabled || !sync.online} onClick={() => {
                    if (window.confirm("Revogar o acesso deste participante? Isso impede novos acessos à nuvem, mas não apaga cópias que ele já tenha baixado.")) void action(async () => {
                      await request("remove_finance_member", { p_workspace: active.id, p_user: member.user_id });
                      await refreshMembers();
                    });
                  }}>Remover</Button>
                )}
              </li>
            ))}
          </ul>
          {active.role === "owner" ? (
            <>
              <form className="space-y-2" onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  const code = z.uuid().parse(await request("invite_finance_member", { p_workspace: active.id, p_email: email.trim() }));
                  setCreatedInvite(code);
                  await refreshMembers();
                });
              }}>
                <Field label="E-mail de quem deseja convidar">
                  <input type="email" className={inputClass} value={email} required maxLength={254} onChange={(event) => setEmail(event.target.value)} />
                </Field>
                <Button type="submit" disabled={disabled || !sync.online}>Gerar convite para este e-mail</Button>
              </form>
              {createdInvite && (
                <div role="status" className="space-y-2 rounded-xl bg-orange-soft p-3 text-sm">
                  <p>Copie o código e envie por um meio privado à pessoa convidada. Ela deve entrar no app com o e-mail indicado e aceitar o convite em Ajustes. Válido por sete dias; não enviamos este convite automaticamente por e-mail.</p>
                  <input aria-label="Código do convite criado" className={inputClass} readOnly value={createdInvite} onFocus={(event) => event.target.select()} />
                </div>
              )}
              <ul className="space-y-2">
                {invitations.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="break-all">Convite: {item.email} · até {new Date(item.expires_at).toLocaleDateString("pt-BR")}</span>
                    <Button variant="ghost" disabled={disabled || !sync.online} onClick={() => void action(async () => {
                      await request("revoke_finance_invitation", { p_workspace: active.id, p_invitation: item.id });
                      if (createdInvite === item.id) setCreatedInvite("");
                      await refreshMembers();
                    })}>Cancelar convite</Button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Button variant="danger" disabled={disabled || !sync.online} onClick={() => {
              if (window.confirm("Sair deste espaço familiar? Exporte um backup antes: alterações ainda não enviadas não poderão ser sincronizadas após sair.")) void action(async () => {
                await request("leave_finance_workspace", { p_workspace: active.id });
                await sync.refreshSpaces();
              });
            }}>Sair do espaço familiar</Button>
          )}
        </div>
      )}
      {error && <p role="alert" className="break-words text-sm text-negative">{error}</p>}
      {notice && <p role="status" className="text-sm text-positive">{notice}</p>}
    </div>
  );
}
