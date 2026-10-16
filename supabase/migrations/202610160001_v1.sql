-- Orange Finance 1.0: profiles, 10-character join codes and member names.
-- Additive only: no existing table, row or financial snapshot is removed.
begin;

create table if not exists public.finance_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 40),
  gender text check (gender is null or gender in ('female', 'male', 'other')),
  birth_date date check (birth_date is null or birth_date >= date '1900-01-01'),
  updated_at timestamptz not null default now()
);
alter table public.finance_profiles enable row level security;
alter table public.finance_profiles force row level security;
revoke all on public.finance_profiles from public, anon, authenticated;

create table if not exists public.finance_join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists finance_join_attempts_user on public.finance_join_attempts(user_id, attempted_at);
alter table public.finance_join_attempts enable row level security;
alter table public.finance_join_attempts force row level security;
revoke all on public.finance_join_attempts from public, anon, authenticated;

alter table public.finance_workspaces add column if not exists join_code text;
create unique index if not exists finance_workspaces_join_code
  on public.finance_workspaces(join_code) where join_code is not null;

-- 10 characters from 32 unambiguous symbols (no 0/O, 1/I). gen_random_uuid uses a strong random source;
-- bytes 6 and 8 carry the UUID version/variant bits and are skipped to avoid bias.
create or replace function public.finance_new_join_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  idx integer;
  result text := '';
begin
  foreach idx in array array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12] loop
    result := result || substr(alphabet, (get_byte(bytes, idx) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.finance_assign_join_code(p_workspace uuid)
returns text language plpgsql volatile set search_path = ''
as $$
declare code text;
begin
  for attempt in 1..20 loop
    begin
      update public.finance_workspaces set join_code = public.finance_new_join_code()
        where id = p_workspace and kind = 'shared'
        returning join_code into code;
      return code;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'Não foi possível gerar um código. Tente novamente.';
end;
$$;

do $$
declare space record;
begin
  for space in select id from public.finance_workspaces where kind = 'shared' and join_code is null loop
    perform public.finance_assign_join_code(space.id);
  end loop;
end;
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
    raise exception 'Limite de dez espaços compartilhados por conta atingido.' using errcode = '22023';
  end if;
  insert into public.finance_workspaces(owner_id, name, kind) values (caller, trim(p_name), 'shared')
    returning id into space;
  insert into public.finance_members(workspace_id, user_id, role) values (space, caller, 'owner');
  perform public.finance_assign_join_code(space);
  return space;
end;
$$;

create or replace function public.get_finance_join_code(p_workspace uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare code text;
begin
  if not public.finance_is_member(p_workspace) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  select join_code into code from public.finance_workspaces where id = p_workspace and kind = 'shared';
  if not found then raise exception 'O espaço pessoal não pode ser compartilhado.' using errcode = '22023'; end if;
  return coalesce(code, public.finance_assign_join_code(p_workspace));
end;
$$;

create or replace function public.regenerate_finance_join_code(p_workspace uuid)
returns text language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.finance_workspaces where id = p_workspace and owner_id = auth.uid() and kind = 'shared'
  ) then raise exception 'Somente o responsável pode gerar outro código.' using errcode = '42501'; end if;
  return public.finance_assign_join_code(p_workspace);
end;
$$;

-- Returns null for an unknown code. Failed attempts are recorded (not rolled back) and limited per hour.
create or replace function public.join_finance_workspace(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  space uuid;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from public.finance_join_attempts where user_id = caller and attempted_at < now() - interval '1 day';
  if (select count(*) from public.finance_join_attempts
      where user_id = caller and attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas tentativas com códigos inválidos. Aguarde uma hora e tente novamente.' using errcode = '54000';
  end if;
  if length(normalized) = 10 then
    select id into space from public.finance_workspaces where kind = 'shared' and join_code = normalized;
  end if;
  if space is null then
    insert into public.finance_join_attempts(user_id) values (caller);
    return null;
  end if;
  insert into public.finance_members(workspace_id, user_id, role) values (space, caller, 'member')
    on conflict do nothing;
  return space;
end;
$$;

create or replace function public.get_finance_profile()
returns table(display_name text, gender text, birth_date date, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.display_name, p.gender, p.birth_date, p.updated_at
  from public.finance_profiles p where p.user_id = (select auth.uid());
$$;

create or replace function public.save_finance_profile(p_display_name text, p_gender text, p_birth_date date)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  saved timestamptz;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_birth_date is not null and (p_birth_date > current_date or p_birth_date < date '1900-01-01') then
    raise exception 'Informe uma data de nascimento válida.' using errcode = '22023';
  end if;
  insert into public.finance_profiles(user_id, display_name, gender, birth_date, updated_at)
    values (caller, nullif(trim(p_display_name), ''), p_gender, p_birth_date, now())
    on conflict (user_id) do update set display_name = excluded.display_name, gender = excluded.gender,
      birth_date = excluded.birth_date, updated_at = now()
    returning updated_at into saved;
  return saved;
end;
$$;

-- Members see each other's chosen name only; gender and birth date stay private.
create or replace function public.list_finance_space_members(p_workspace uuid)
returns table(user_id uuid, display_name text, role text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.finance_is_member(p_workspace) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  return query
    select m.user_id,
      coalesce(p.display_name, nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''),
        split_part(u.email::text, '@', 1), 'Participante')::text,
      m.role
    from public.finance_members m
    join auth.users u on u.id = m.user_id
    left join public.finance_profiles p on p.user_id = m.user_id
    where m.workspace_id = p_workspace
    order by m.role desc, 2;
end;
$$;

-- New write entry point. Older app versions keep calling the previous function, which is revoked below,
-- so they cannot overwrite 1.0 data with snapshots missing new fields; they keep their data locally until updated.
create or replace function public.write_workspace_finance_v2(p_workspace uuid, p_expected_revision bigint, p_data jsonb)
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

revoke all on function public.finance_new_join_code(), public.finance_assign_join_code(uuid)
  from public, anon, authenticated;

revoke all on function public.create_family_workspace(text), public.get_finance_join_code(uuid),
  public.regenerate_finance_join_code(uuid), public.join_finance_workspace(text),
  public.get_finance_profile(), public.save_finance_profile(text, text, date),
  public.list_finance_space_members(uuid), public.write_workspace_finance_v2(uuid, bigint, jsonb)
from public, anon, authenticated;

grant execute on function public.create_family_workspace(text), public.get_finance_join_code(uuid),
  public.regenerate_finance_join_code(uuid), public.join_finance_workspace(text),
  public.get_finance_profile(), public.save_finance_profile(text, text, date),
  public.list_finance_space_members(uuid), public.write_workspace_finance_v2(uuid, bigint, jsonb)
to authenticated;

revoke execute on function public.write_workspace_finance(uuid, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.write_finance(bigint, jsonb) from public, anon, authenticated;

commit;
