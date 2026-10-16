begin;

create or replace function public.write_workspace_finance_v3(p_workspace uuid, p_expected_revision bigint, p_data jsonb)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if not public.finance_is_member(p_workspace) then raise exception 'Acesso ao espaço negado.' using errcode = '42501'; end if;
  perform 1 from public.finance_workspaces where id = p_workspace for update;
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

-- 1.0/1.1 keep working on legacy spaces, but cannot change snapshots using 1.2 semantics.
create or replace function public.write_workspace_finance_v2(p_workspace uuid, p_expected_revision bigint, p_data jsonb)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare existing jsonb;
begin
  if not public.finance_is_member(p_workspace) then raise exception 'Acesso ao espaço negado.' using errcode = '42501'; end if;
  perform 1 from public.finance_workspaces where id = p_workspace for update;
  select data into existing from public.workspace_finance where workspace_id = p_workspace for update;
  if exists (
    select 1 from jsonb_array_elements(coalesce(existing->'accounts', '[]')) account
      where account ?| array['position', 'closingDay', 'dueDay']
  ) or exists (
    select 1 from jsonb_array_elements(coalesce(existing->'transactions', '[]')) entry
      where entry ?| array['repeatMode', 'frequency', 'invoiceKey', 'invoicePaymentKey']
  ) then
    raise exception 'Este espaço usa o Orange Finance 1.2. Atualize o aplicativo para sincronizar. Seus dados locais foram preservados.' using errcode = '22023';
  end if;
  return public.write_workspace_finance_v3(p_workspace, p_expected_revision, p_data);
end;
$$;

revoke all on function public.write_workspace_finance_v3(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.write_workspace_finance_v3(uuid, bigint, jsonb) to authenticated;

commit;
