import { Download, Plus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CategoryForm } from "../components/forms";
import { categoryIcon, ColorIcon } from "../components/icons";
import { Logo } from "../components/Logo";
import { SyncPanel } from "../components/SyncPanel";
import { Button, Card, CardHeader, Field, inputClass, PageHeader, Segmented, Switch } from "../components/ui";
import type { Category, CategoryKind } from "../lib/db";
import { downloadBackup } from "../lib/download-backup";
import { useSetting } from "../lib/hooks";
import { importBackup, parseBackup, setSetting, wipeAll } from "../lib/repo";
import { useApp } from "../state";

export function Settings() {
  const { data, notify } = useApp();
  const savedName = useSetting("userName", "");
  const hideOnStart = useSetting("hideValues", false);
  const [name, setName] = useState(savedName);
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmImport, setConfirmImport] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setName(savedName), [savedName]);

  const saveName = async () => {
    if (name.trim() === savedName) return;
    await setSetting("userName", name.trim());
    notify("Nome salvo.");
  };

  const download = async () => {
    try {
      await downloadBackup();
      notify("Backup exportado.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível exportar o backup.");
    }
  };

  const restore = async (file: File) => {
    setConfirmImport(null);
    try {
      const backup = parseBackup(await file.text());
      await importBackup(backup);
      notify(`Backup restaurado: ${backup.transactions.filter((t) => t.deletedAt === null).length} lançamentos.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível importar o backup.");
    }
  };

  const categories = data.categories.filter((c) => c.kind === kind);

  return (
    <div className="space-y-4">
      <PageHeader title="Ajustes" />
      <SyncPanel />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Preferências deste espaço" />
          <div className="space-y-4">
            <Field label="Nome exibido neste espaço">
              <input
                className={inputClass}
                value={name}
                maxLength={30}
                placeholder="Seu nome"
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </Field>
            <Switch label="Ocultar valores ao abrir o app" checked={hideOnStart} onChange={(v) => void setSetting("hideValues", v)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Backup" />
          <p className="mb-4 text-sm text-muted">
            Mantenha uma cópia de segurança mesmo com sincronização. Sem conta vinculada, os dados ficam apenas neste
            navegador. A importação substitui os dados atuais e, com sincronização ativa, essa substituição também será
            enviada aos outros aparelhos. Guarde o arquivo em local seguro: ele contém seus dados financeiros.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={download}>
              <Download size={18} /> Exportar backup
            </Button>
            <Button variant="ghost" onClick={() => fileInput.current?.click()}>
              <Upload size={18} /> Importar
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setConfirmImport(file);
                e.target.value = "";
              }}
            />
          </div>
          {confirmImport && (
            <div role="alert" className="mt-4 rounded-xl bg-orange-soft p-3 text-sm">
              <p className="font-semibold">Importar “{confirmImport.name}”?</p>
              <p className="mt-1 text-muted">Todos os dados atuais serão substituídos. Com sincronização ativa, a substituição também será enviada à nuvem e aos outros aparelhos.</p>
              <div className="mt-3 flex gap-2">
                <Button className="h-9" onClick={() => restore(confirmImport)}>
                  Substituir dados
                </Button>
                <Button variant="ghost" className="h-9" onClick={() => setConfirmImport(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Categorias"
          action={
            <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => setEditing("new")}>
              <Plus size={16} /> Nova
            </Button>
          }
        />
        <div className="mb-3 max-w-xs">
          <Segmented
            label="Tipo de categoria"
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Despesas" },
              { value: "income", label: "Receitas" },
            ]}
          />
        </div>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setEditing(c)}
              className="flex items-center gap-3 rounded-xl px-2 py-2 text-left font-semibold transition-colors hover:bg-cream"
            >
              <ColorIcon icon={categoryIcon(c.icon)} color={c.color} size="sm" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Apagar dados" />
          <p className="mb-4 text-sm text-muted">Remove contas, lançamentos, orçamentos e categorias personalizadas. Com sincronização ativa, a exclusão também será enviada à nuvem e aos outros aparelhos. Exporte um backup antes.</p>
          {confirmWipe ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-negative">Tem certeza? Esta ação não pode ser desfeita.</span>
              <Button
                variant="danger"
                onClick={async () => {
                  await wipeAll();
                  setConfirmWipe(false);
                  notify("Todos os dados foram apagados.");
                }}
              >
                Apagar tudo
              </Button>
              <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmWipe(true)}>
              Apagar todos os dados
            </Button>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <Logo className="size-12" />
            <div>
              <p className="font-display text-lg font-bold">Orange Finance</p>
              <p className="text-sm text-muted">Versão {__APP_VERSION__} · Suas finanças, de forma simples.</p>
            </div>
          </div>
        </Card>
      </div>

      {editing && <CategoryForm category={editing === "new" ? undefined : editing} kind={kind} onClose={() => setEditing(null)} />}
    </div>
  );
}
