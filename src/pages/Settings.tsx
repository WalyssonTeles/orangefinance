import {
  ChevronLeft, ChevronRight, Cloud, Database, Download, Plus, Shapes, SlidersHorizontal, Upload, User, Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CategoryForm } from "../components/forms";
import { categoryIcon, ColorIcon } from "../components/icons";
import { Logo } from "../components/Logo";
import { SharedSpaces } from "../components/SharedSpaces";
import { SyncPanel } from "../components/SyncPanel";
import { Button, Card, CardHeader, DatePicker, Field, inputClass, Segmented, Switch } from "../components/ui";
import { db, type Category, type CategoryKind } from "../lib/db";
import { downloadBackup } from "../lib/download-backup";
import { useProfile, useSetting } from "../lib/hooks";
import { GENDER_OPTIONS, type Gender } from "../lib/profile";
import { Select } from "../components/Select";
import { importBackup, parseBackup, setSetting, wipeAll } from "../lib/repo";
import { navigate, useLocation } from "../lib/router";
import { useApp } from "../state";
import { useSync } from "../sync-context";

interface Section {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  render: () => ReactNode;
}

const SECTIONS: Section[] = [
  { id: "perfil", title: "Perfil", description: "Nome, sexo e data de nascimento", icon: User, render: () => <ProfileSection /> },
  { id: "conta", title: "Conta e sincronização", description: "Entrar com Google e sincronizar aparelhos", icon: Cloud, render: () => <SyncPanel /> },
  { id: "compartilhado", title: "Espaço compartilhado", description: "Criar, entrar com código e ver participantes", icon: Users, render: () => <SharedSpaces /> },
  { id: "preferencias", title: "Preferências", description: "Privacidade dos valores", icon: SlidersHorizontal, render: () => <PreferencesSection /> },
  { id: "categorias", title: "Categorias", description: "Criar, editar e organizar categorias", icon: Shapes, render: () => <CategoriesSection /> },
  { id: "backup", title: "Backup e dados", description: "Exportar, importar ou apagar dados", icon: Database, render: () => <BackupSection /> },
];

export function Settings() {
  const { section, params } = useLocation();
  const sync = useSync();
  const current = SECTIONS.find((s) => s.id === section);
  const spaceDetail = section === "compartilhado" && sync.spaces.some((space) => space.kind === "shared" && space.id === params.get("id"));

  if (current) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <a href={spaceDetail ? "#/ajustes/compartilhado" : "#/ajustes"} className="-ml-2 inline-flex min-h-12 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-brand-ink hover:bg-orange-soft">
            <ChevronLeft size={20} /> {spaceDetail ? "Voltar" : "Voltar para ajustes"}
          </a>
          <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">{current.title}</h1>
        </header>
        {current.render()}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">Ajustes</h1>
      <Card className="p-1.5 sm:p-2">
        <nav aria-label="Seções de ajustes">
          <ul className="divide-y divide-line">
            {SECTIONS.map(({ id, title, description, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => navigate("ajustes", id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-cream"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-soft text-brand-ink">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{title}</span>
                    <span className="block truncate text-sm text-muted">{description}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </Card>
      <div className="flex items-center gap-3 px-2">
        <Logo className="size-10" />
        <div>
          <p className="font-display font-bold">Orange Finance</p>
          <p className="text-sm text-muted">Versão {__APP_VERSION__} · Suas finanças, de forma simples.</p>
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const sync = useSync();
  const { notify } = useApp();
  const { profile, name: currentName, loading } = useProfile(sync.session?.user.id ?? null);
  const googleName = typeof sync.session?.user.user_metadata?.full_name === "string" ? sync.session.user.user_metadata.full_name : "";
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || loading) return;
    loaded.current = true;
    setName(currentName || googleName.slice(0, 40));
    setGender(profile?.gender ?? "");
    setBirthDate(profile?.birthDate ?? "");
  }, [profile, currentName, googleName, loading]);

  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          try {
            await sync.saveProfile({ name, gender: gender || null, birthDate: birthDate || null });
            notify(sync.session && !sync.online ? "Perfil salvo. Será sincronizado quando houver internet." : "Perfil salvo.");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível salvar o perfil.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="Nome" hint="Usado na saudação e mostrado aos participantes dos seus espaços compartilhados.">
          <input className={inputClass} value={name} maxLength={40} autoComplete="name" placeholder="Seu nome" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Sexo">
          <Select label="Sexo" value={gender} options={GENDER_OPTIONS} onChange={(value) => {
            const option = GENDER_OPTIONS.find((item) => item.value === value);
            if (option) setGender(option.value);
          }} />
        </Field>
        <Field label="Data de nascimento">
          <DatePicker label="Data de nascimento" value={birthDate} min="1900-01-01" max={maxDate} onChange={setBirthDate} />
        </Field>
        <p className="text-xs text-muted">
          Sexo e data de nascimento são opcionais e ficam visíveis apenas para você.
          {!sync.session && " Entre com sua conta para usar o mesmo perfil em outros aparelhos."}
        </p>
        {error && <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm font-semibold text-negative">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</Button>
      </form>
    </Card>
  );
}

function PreferencesSection() {
  const hideOnStart = useSetting("hideValues", false);
  return (
    <Card>
      <Switch label="Ocultar valores ao abrir o app" checked={hideOnStart} onChange={(v) => void setSetting("hideValues", v)} />
      <p className="mt-2 text-sm text-muted">Vale para este aparelho. O botão de olho mostra ou oculta os valores a qualquer momento.</p>
    </Card>
  );
}

function CategoriesSection() {
  const { data } = useApp();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const categories = data.categories.filter((c) => c.kind === kind);

  return (
    <Card>
      <CardHeader
        title={`${categories.length} categorias`}
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
      <div className="grid gap-1 sm:grid-cols-2">
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
      {editing && <CategoryForm category={editing === "new" ? undefined : editing} kind={kind} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function BackupSection() {
  const { notify } = useApp();
  const previous = useLiveQuery(() => db.releaseBackups.get("pre-1.2"));
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmImport, setConfirmImport] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <Card>
        <CardHeader title="Backup" />
        <p className="mb-4 text-sm text-muted">
          Exporta os dados do espaço aberto. Mantenha uma cópia mesmo com sincronização. A importação substitui os dados atuais e,
          com sincronização ativa, essa substituição também vai para os outros aparelhos. Guarde o arquivo em local seguro.
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
        {previous && <div className="mt-4 rounded-xl bg-cream p-3 text-sm text-muted">
          <p>Há uma cópia local do espaço que estava aberto antes da atualização para 1.2. Ela pode ser de um espaço diferente do atual. Exportar não altera seus dados.</p>
          <button type="button" className="mt-2 font-semibold text-brand-ink hover:underline" onClick={() => void downloadBackup(true).catch((error: unknown) => notify(error instanceof Error ? error.message : "Não foi possível exportar a cópia."))}>Exportar cópia anterior à 1.2</button>
        </div>}
        {confirmImport && (
          <div role="alert" className="mt-4 rounded-xl bg-orange-soft p-3 text-sm">
            <p className="font-semibold">Importar “{confirmImport.name}”?</p>
            <p className="mt-1 text-muted">Todos os dados atuais serão substituídos. Com sincronização ativa, a substituição também será enviada aos outros aparelhos.</p>
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

      <Card>
        <CardHeader title="Apagar dados" />
        <p className="mb-4 text-sm text-muted">
          Remove contas, lançamentos, orçamentos e categorias personalizadas do espaço aberto. Com sincronização ativa, a exclusão também
          vai para a nuvem e os outros aparelhos. Exporte um backup antes.
        </p>
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
    </>
  );
}
