-- Google Sheets mirror discovery for shared spaces.
-- Additive only: financial snapshots and existing memberships are unchanged.
begin;

create table if not exists public.finance_sheet_mirrors (
  workspace_id uuid primary key references public.finance_workspaces(id) on delete cascade,
  spreadsheet_id text not null check (spreadsheet_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  updated_at timestamptz not null default now()
);

alter table public.finance_sheet_mirrors enable row level security;
alter table public.finance_sheet_mirrors force row level security;
revoke all on public.finance_sheet_mirrors from public, anon, authenticated;

create or replace function public.get_finance_sheet_mirror(p_workspace uuid)
returns table(spreadsheet_id text, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.finance_is_member(p_workspace) then
    raise exception 'Acesso ao espaço negado.' using errcode = '42501';
  end if;
  return query
    select mirror.spreadsheet_id, mirror.updated_at
    from public.finance_sheet_mirrors mirror
    where mirror.workspace_id = p_workspace;
end;
$$;

create or replace function public.save_finance_sheet_mirror(p_workspace uuid, p_spreadsheet_id text)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare saved timestamptz;
begin
  if not exists (
    select 1 from public.finance_workspaces
    where id = p_workspace and owner_id = auth.uid() and kind = 'shared'
  ) then
    raise exception 'Somente o responsável pode registrar a planilha compartilhada.' using errcode = '42501';
  end if;
  if p_spreadsheet_id is null or p_spreadsheet_id !~ '^[A-Za-z0-9_-]{10,200}$' then
    raise exception 'Identificador de planilha inválido.' using errcode = '22023';
  end if;
  insert into public.finance_sheet_mirrors(workspace_id, spreadsheet_id, updated_at)
    values (p_workspace, p_spreadsheet_id, now())
    on conflict (workspace_id) do update
      set spreadsheet_id = excluded.spreadsheet_id, updated_at = now()
    returning updated_at into saved;
  return saved;
end;
$$;

-- E-mails are exposed only to the workspace owner and only for granting Drive reader permissions.
create or replace function public.list_finance_sheet_member_emails(p_workspace uuid)
returns table(user_id uuid, email text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.finance_workspaces
    where id = p_workspace and owner_id = auth.uid() and kind = 'shared'
  ) then
    raise exception 'Somente o responsável pode compartilhar a planilha.' using errcode = '42501';
  end if;
  return query
    select member.user_id, lower(account.email)
    from public.finance_members member
    join auth.users account on account.id = member.user_id
    where member.workspace_id = p_workspace
      and member.role = 'member'
      and account.email_confirmed_at is not null
      and account.email is not null
    order by member.user_id;
end;
$$;

revoke all on function public.get_finance_sheet_mirror(uuid),
  public.save_finance_sheet_mirror(uuid, text),
  public.list_finance_sheet_member_emails(uuid)
from public, anon, authenticated;

grant execute on function public.get_finance_sheet_mirror(uuid),
  public.save_finance_sheet_mirror(uuid, text),
  public.list_finance_sheet_member_emails(uuid)
to authenticated;

notify pgrst, 'reload schema';

commit;
