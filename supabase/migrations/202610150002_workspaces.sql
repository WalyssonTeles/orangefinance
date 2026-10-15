begin;

create table if not exists public.finance_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null check (kind in ('personal', 'shared')),
  created_at timestamptz not null default now()
);
create unique index if not exists finance_one_personal_workspace
  on public.finance_workspaces(owner_id) where kind = 'personal';

create table if not exists public.finance_members (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  primary key (workspace_id, user_id)
);
create index if not exists finance_members_user on public.finance_members(user_id);

create table if not exists public.finance_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (workspace_id, email)
);

create table if not exists public.workspace_finance (
  workspace_id uuid primary key references public.finance_workspaces(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and data ?& array['accounts', 'categories', 'transactions', 'budgets', 'settings']
    and jsonb_typeof(data->'accounts') = 'array'
    and jsonb_typeof(data->'categories') = 'array'
    and jsonb_typeof(data->'transactions') = 'array'
    and jsonb_typeof(data->'budgets') = 'array'
    and jsonb_typeof(data->'settings') = 'array'
    and octet_length(data::text) <= 5000000
  ),
  updated_at timestamptz not null default now()
);

alter table public.finance_workspaces enable row level security;
alter table public.finance_workspaces force row level security;
alter table public.finance_members enable row level security;
alter table public.finance_members force row level security;
alter table public.finance_invitations enable row level security;
alter table public.finance_invitations force row level security;
alter table public.workspace_finance enable row level security;
alter table public.workspace_finance force row level security;
revoke all on public.finance_workspaces, public.finance_members, public.finance_invitations,
  public.workspace_finance from public, anon, authenticated;
grant select on public.workspace_finance to authenticated;

create or replace function public.finance_is_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.finance_members
    where workspace_id = p_workspace and user_id = (select auth.uid())
  );
$$;

drop policy if exists workspace_finance_read_member on public.workspace_finance;
create policy workspace_finance_read_member on public.workspace_finance
  for select to authenticated using ((select public.finance_is_member(workspace_id)));

create or replace function public.ensure_personal_finance_workspace()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  space uuid;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.finance_workspaces(owner_id, name, kind)
    values (caller, 'Pessoal', 'personal')
    on conflict (owner_id) where kind = 'personal' do nothing;
  select id into space from public.finance_workspaces where owner_id = caller and kind = 'personal';
  insert into public.finance_members(workspace_id, user_id, role)
    values (space, caller, 'owner') on conflict do nothing;
  insert into public.workspace_finance(workspace_id, revision, data, updated_at)
    select space, revision, data, updated_at from public.finance_sync where user_id = caller
    on conflict do nothing;
  return space;
end;
$$;

create or replace function public.list_finance_workspaces()
returns table(id uuid, name text, kind text, role text)
language sql stable security definer set search_path = ''
as $$
  select w.id, w.name, w.kind, m.role
  from public.finance_workspaces w
  join public.finance_members m on m.workspace_id = w.id
  where m.user_id = (select auth.uid())
  order by w.kind, w.created_at;
$$;

create or replace function public.create_family_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  space uuid;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 80 then
    raise exception 'Informe um nome de 1 a 80 caracteres.' using errcode = '22023';
  end if;
  if (select count(*) from public.finance_workspaces where owner_id = caller and kind = 'shared') >= 10 then
    raise exception 'Limite de dez espaços familiares por conta atingido.' using errcode = '22023';
  end if;
  insert into public.finance_workspaces(owner_id, name, kind) values (caller, trim(p_name), 'shared')
    returning id into space;
  insert into public.finance_members(workspace_id, user_id, role) values (space, caller, 'owner');
  return space;
end;
$$;

create or replace function public.write_workspace_finance(p_workspace uuid, p_expected_revision bigint, p_data jsonb)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if not public.finance_is_member(p_workspace) then raise exception 'Acesso ao espaço negado.' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_data is null then
    raise exception 'Invalid synchronization request' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.workspace_finance(workspace_id, revision, data) values (p_workspace, 1, p_data)
      on conflict do nothing;
  else
    update public.workspace_finance set data = p_data, revision = revision + 1, updated_at = now()
      where workspace_id = p_workspace and revision = p_expected_revision;
  end if;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.invite_finance_member(p_workspace uuid, p_email text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  invitation uuid;
  recipient text := lower(trim(p_email));
begin
  if not exists (
    select 1 from public.finance_workspaces where id = p_workspace and owner_id = auth.uid() and kind = 'shared'
  ) then raise exception 'Somente o responsável pode convidar para um espaço familiar.' using errcode = '42501'; end if;
  if recipient is null or length(recipient) > 254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if (select count(*) from public.finance_invitations where workspace_id = p_workspace) >= 50 then
    raise exception 'Remova convites antigos antes de criar outros.' using errcode = '22023';
  end if;
  insert into public.finance_invitations(workspace_id, email) values (p_workspace, recipient)
    on conflict (workspace_id, email) do update set id = gen_random_uuid(), expires_at = now() + interval '7 days'
    returning id into invitation;
  return invitation;
end;
$$;

create or replace function public.accept_finance_invitation(p_invitation uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  invitation public.finance_invitations;
  verified_email text;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select lower(email) into verified_email from auth.users where id = caller and email_confirmed_at is not null;
  select * into invitation from public.finance_invitations
    where id = p_invitation and email = verified_email and expires_at > now() for update;
  if not found then raise exception 'Convite inválido, expirado ou destinado a outro e-mail.' using errcode = '42501'; end if;
  insert into public.finance_members(workspace_id, user_id, role) values (invitation.workspace_id, caller, 'member')
    on conflict do nothing;
  delete from public.finance_invitations where id = invitation.id;
  return invitation.workspace_id;
end;
$$;

create or replace function public.list_finance_members(p_workspace uuid)
returns table(user_id uuid, email text, role text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.finance_is_member(p_workspace) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  return query select m.user_id, u.email::text, m.role
    from public.finance_members m join auth.users u on u.id = m.user_id where m.workspace_id = p_workspace;
end;
$$;

create or replace function public.list_finance_invitations(p_workspace uuid)
returns table(id uuid, email text, expires_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.finance_workspaces where id = p_workspace and owner_id = auth.uid() and kind = 'shared')
    then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  return query select i.id, i.email, i.expires_at from public.finance_invitations i where i.workspace_id = p_workspace;
end;
$$;

create or replace function public.revoke_finance_invitation(p_workspace uuid, p_invitation uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.finance_workspaces where id = p_workspace and owner_id = auth.uid() and kind = 'shared')
    then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  delete from public.finance_invitations where id = p_invitation and workspace_id = p_workspace;
end;
$$;

create or replace function public.remove_finance_member(p_workspace uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.finance_workspaces where id = p_workspace and owner_id = auth.uid() and kind = 'shared')
    then raise exception 'Somente o responsável pode remover participantes.' using errcode = '42501'; end if;
  delete from public.finance_members where workspace_id = p_workspace and user_id = p_user and role = 'member';
end;
$$;

create or replace function public.leave_finance_workspace(p_workspace uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.finance_workspaces where id = p_workspace and owner_id = auth.uid()) then
    raise exception 'O responsável não pode sair do próprio espaço.' using errcode = '22023';
  end if;
  delete from public.finance_members where workspace_id = p_workspace and user_id = auth.uid() and role = 'member';
end;
$$;

revoke all on function public.finance_is_member(uuid),
  public.ensure_personal_finance_workspace(), public.list_finance_workspaces(),
  public.create_family_workspace(text), public.write_workspace_finance(uuid, bigint, jsonb),
  public.invite_finance_member(uuid, text), public.accept_finance_invitation(uuid),
  public.list_finance_members(uuid), public.list_finance_invitations(uuid),
  public.revoke_finance_invitation(uuid, uuid), public.remove_finance_member(uuid, uuid),
  public.leave_finance_workspace(uuid)
from public, anon, authenticated;

grant execute on function public.finance_is_member(uuid),
  public.ensure_personal_finance_workspace(), public.list_finance_workspaces(),
  public.create_family_workspace(text), public.write_workspace_finance(uuid, bigint, jsonb),
  public.invite_finance_member(uuid, text), public.accept_finance_invitation(uuid),
  public.list_finance_members(uuid), public.list_finance_invitations(uuid),
  public.revoke_finance_invitation(uuid, uuid), public.remove_finance_member(uuid, uuid),
  public.leave_finance_workspace(uuid)
to authenticated;

commit;
