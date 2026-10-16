import { Check, ChevronRight, Copy, KeyRound, LogOut, Plus, RefreshCw, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useMembers } from "../lib/hooks";
import { navigate, useLocation } from "../lib/router";
import {
  createSharedSpace, fetchJoinCode, joinByCode, normalizeJoinCode, regenerateJoinCode, renameSharedSpace, workspaceRpc,
} from "../lib/workspaces";
import { useApp } from "../state";
import { useSync } from "../sync-context";
import { Button, Card, CardHeader, Field, inputClass } from "./ui";

const message = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export function SharedSpaces() {
  const sync = useSync();
  const { params } = useLocation();
  const selectedId = params.get("id");

  if (!sync.session || !sync.bound) {
    return (
      <Card>
        <p className="text-sm text-muted">
          Para criar um espaço compartilhado ou entrar em um, primeiro entre com sua conta Google.
        </p>
        <Button className="mt-3" onClick={() => navigate("ajustes", "conta")}>Ir para Conta e sincronização</Button>
      </Card>
    );
  }

  const selected = selectedId ? sync.spaces.find((space) => space.id === selectedId && space.kind === "shared") : undefined;
  return selected ? <SpaceDetail key={selected.id} spaceId={selected.id} /> : <SpaceList />;
}

function SpaceList() {
  const sync = useSync();
  const { notify } = useApp();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shared = sync.spaces.filter((space) => space.kind === "shared");

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await work(); }
    catch (cause) { setError(message(cause, "Não foi possível concluir. Tente novamente.")); }
    finally { setBusy(false); }
  };

  const enter = async (id: string, text: string) => {
    await sync.refreshSpaces();
    await sync.switchSpace(id);
    notify(text);
    navigate("ajustes", "compartilhado", { id });
  };

  return (
    <>
      <Card className="p-1.5 sm:p-2">
        {shared.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <span className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-orange-soft text-brand-ink"><Users size={22} /></span>
            <p className="font-semibold">Nenhum espaço compartilhado ainda</p>
            <p className="mt-1 text-sm text-muted">Crie um espaço para a família ou entre com o código que alguém compartilhou.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {shared.map((space) => (
              <li key={space.id}>
                <button
                  type="button"
                  onClick={() => navigate("ajustes", "compartilhado", { id: space.id })}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-cream"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-soft text-brand-ink"><Users size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{space.name}</span>
                    <span className="block text-sm text-muted">
                      {space.role === "owner" ? "Você é o responsável" : "Participante"}
                      {space.id === sync.activeSpace?.id ? " · Aberto agora" : ""}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant={mode === "create" ? "primary" : "secondary"} onClick={() => { setMode("create"); setError(""); }}>
          <Plus size={18} /> Criar novo
        </Button>
        <Button variant={mode === "join" ? "primary" : "secondary"} onClick={() => { setMode("join"); setError(""); }}>
          <KeyRound size={18} /> Inserir código
        </Button>
      </div>

      {mode === "create" && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const id = await sync.withSession((client, token) => createSharedSpace(client, token, name));
                setName("");
                await enter(id, "Espaço criado. Compartilhe o código com quem vai participar.");
              });
            }}
          >
            <Field label="Nome do espaço" hint="Ele começa vazio, com contas e categorias iniciais. Seus dados pessoais não são copiados.">
              <input className={inputClass} required maxLength={80} placeholder="Ex.: Nossa família" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Button type="submit" disabled={busy || !sync.online || !name.trim()}>{busy ? "Criando..." : "Criar espaço"}</Button>
          </form>
        </Card>
      )}

      {mode === "join" && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const id = await sync.withSession((client, token) => joinByCode(client, token, code));
                setCode("");
                await enter(id, "Você entrou no espaço compartilhado.");
              });
            }}
          >
            <Field label="Código do espaço" hint="10 letras e números, recebidos de quem participa do espaço.">
              <input
                className={`${inputClass} font-mono text-lg tracking-[0.2em] uppercase`}
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={14}
                placeholder="ABCDE23456"
                value={code}
                onChange={(e) => setCode(normalizeJoinCode(e.target.value).slice(0, 10))}
              />
            </Field>
            <Button type="submit" disabled={busy || !sync.online || code.length !== 10}>{busy ? "Entrando..." : "Entrar no espaço"}</Button>
          </form>
        </Card>
      )}

      {!sync.online && <p role="status" className="text-sm text-muted">Conecte-se à internet para criar ou entrar em um espaço.</p>}
      {error && <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm font-semibold text-negative">{error}</p>}
    </>
  );
}

function SpaceDetail({ spaceId }: { spaceId: string }) {
  const sync = useSync();
  const { notify, currentUserId } = useApp();
  const space = sync.spaces.find((s) => s.id === spaceId)!;
  const members = useMembers(spaceId);
  const owner = space.role === "owner";
  const active = sync.activeSpace?.id === spaceId;
  const [code, setCode] = useState<string | null>(null);
  const [name, setName] = useState(space.name);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadCode = useCallback(async () => {
    try {
      setCode(await sync.withSession((client, token) => fetchJoinCode(client, token, spaceId)));
    } catch (cause) {
      setError(message(cause, "Não foi possível carregar o código."));
    }
  }, [sync.withSession, spaceId]);

  useEffect(() => {
    void loadCode();
    void sync.refreshMembers(spaceId).catch(() => undefined);
  }, [loadCode, spaceId, sync.refreshMembers]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await work(); }
    catch (cause) { setError(message(cause, "Não foi possível concluir. Tente novamente.")); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o código e copie manualmente.");
    }
  };

  const leave = () => run(async () => {
    if (!window.confirm(`Sair de “${space.name}”? Você deixará de ver e sincronizar os dados deste espaço.`)) return;
    const personal = sync.spaces.find((s) => s.kind === "personal");
    if (active && personal) await sync.switchSpace(personal.id);
    await sync.withSession((client, token) => workspaceRpc(client, token, "leave_finance_workspace", { p_workspace: spaceId }));
    await sync.refreshSpaces();
    notify("Você saiu do espaço.");
    navigate("ajustes", "compartilhado");
  });

  return (
    <>
      <Card>
        <CardHeader title={space.name} />
        <p className="text-sm text-muted">{owner ? "Você é o responsável por este espaço." : "Você participa deste espaço."}</p>
        {owner && (
          <form className="mt-4 space-y-3" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await sync.withSession((client, token) => renameSharedSpace(client, token, spaceId, name));
              await sync.refreshSpaces();
              notify("Nome do espaço atualizado.");
            });
          }}>
            <Field label="Nome do espaço">
              <input className={inputClass} value={name} required maxLength={80} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Button type="submit" disabled={busy || !sync.online || !name.trim() || name.trim() === space.name}>Salvar nome</Button>
          </form>
        )}
        {!active && (
          <Button className="mt-3" disabled={sync.busy || sync.syncing} onClick={() => void run(() => sync.switchSpace(spaceId))}>
            Abrir este espaço
          </Button>
        )}
      </Card>

      <Card>
        <CardHeader title="Código para convidar" />
        <p className="mb-3 text-sm text-muted">
          Envie este código por um meio privado. Quem tiver o código pode entrar e ver todos os lançamentos deste espaço.
        </p>
        <div className="flex items-center gap-2">
          <output
            aria-label="Código do espaço"
            className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-line bg-cream font-mono text-xl font-bold tracking-[0.25em] select-all"
          >
            {code ?? (sync.online ? "••••••••••" : "Sem internet")}
          </output>
          <Button variant="secondary" className="h-12 shrink-0" disabled={!code} onClick={() => void copy()} aria-label="Copiar código">
            {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        {owner && (
          <Button
            variant="ghost"
            className="mt-2 px-2 text-sm"
            disabled={busy || !sync.online}
            onClick={() => {
              if (!window.confirm("Gerar um novo código? O código atual deixará de funcionar. Quem já participa continua no espaço.")) return;
              void run(async () => setCode(await sync.withSession((client, token) => regenerateJoinCode(client, token, spaceId))));
            }}
          >
            <RefreshCw size={16} /> Gerar novo código
          </Button>
        )}
      </Card>

      <Card>
        <CardHeader title={`Participantes (${members.length})`} />
        {members.length === 0 ? (
          <p className="text-sm text-muted">{sync.online ? "Carregando participantes..." : "Conecte-se à internet para ver os participantes."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-soft font-bold text-brand-ink">
                  {member.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{member.name}{member.userId === currentUserId ? " (você)" : ""}</span>
                  <span className="block text-xs text-muted">{member.role === "owner" ? "Responsável" : "Participante"}</span>
                </span>
                {owner && member.role === "member" && (
                  <Button
                    variant="ghost"
                    className="h-9 px-2 text-negative"
                    disabled={busy || !sync.online}
                    aria-label={`Remover ${member.name}`}
                    onClick={() => {
                      if (!window.confirm(`Remover ${member.name}? A pessoa deixa de acessar a nuvem, mas cópias já baixadas não são apagadas.`)) return;
                      void run(async () => {
                        await sync.withSession((client, token) => workspaceRpc(client, token, "remove_finance_member", { p_workspace: spaceId, p_user: member.userId }));
                        await sync.refreshMembers(spaceId);
                      });
                    }}
                  >
                    <UserMinus size={18} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Cada pessoa aparece com o nome definido no próprio Perfil.</p>
      </Card>

      {!owner && (
        <Button variant="danger" disabled={busy || !sync.online} onClick={() => void leave()}>
          <LogOut size={18} /> Sair deste espaço
        </Button>
      )}
      {error && <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm font-semibold text-negative">{error}</p>}
    </>
  );
}
