begin;

create table if not exists public.finance_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
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

alter table public.finance_sync enable row level security;
alter table public.finance_sync force row level security;
revoke all on public.finance_sync from public, anon, authenticated;
grant select on public.finance_sync to authenticated;

drop policy if exists finance_sync_select_own on public.finance_sync;
create policy finance_sync_select_own on public.finance_sync
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.write_finance(p_expected_revision bigint, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  affected integer;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_data is null then
    raise exception 'Invalid synchronization request' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.finance_sync (user_id, revision, data)
      values (caller, 1, p_data)
      on conflict (user_id) do nothing;
  else
    update public.finance_sync
      set data = p_data, revision = revision + 1, updated_at = now()
      where user_id = caller and revision = p_expected_revision;
  end if;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.write_finance(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.write_finance(bigint, jsonb) to authenticated;

commit;
