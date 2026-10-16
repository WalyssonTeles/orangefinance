-- Orange Finance 1.0 checks. Run after all migrations; every change is rolled back.
begin;

select set_config('orange.v1_owner', gen_random_uuid()::text, true);
select set_config('orange.v1_partner', gen_random_uuid()::text, true);
select set_config('orange.v1_outsider', gen_random_uuid()::text, true);
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
  (current_setting('orange.v1_owner')::uuid, 'v1-owner@example.invalid', now(), '{"full_name":"Nome Google"}'),
  (current_setting('orange.v1_partner')::uuid, 'v1-partner@example.invalid', now(), '{}'),
  (current_setting('orange.v1_outsider')::uuid, 'v1-outsider@example.invalid', now(), '{}');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('orange.v1_owner'), true);
select set_config('orange.v1_space', public.create_family_workspace('Casa')::text, true);
select set_config('orange.v1_code', public.get_finance_join_code(current_setting('orange.v1_space')::uuid), true);

do $$
declare
  code text := current_setting('orange.v1_code');
  snapshot jsonb := '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}';
begin
  if code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$' then raise exception 'Invalid join code format: %', code; end if;
  if public.get_finance_join_code(current_setting('orange.v1_space')::uuid) <> code then raise exception 'Join code is not stable'; end if;
  if (select display_name from public.list_finance_space_members(current_setting('orange.v1_space')::uuid)) <> 'Nome Google' then
    raise exception 'Google name fallback missing';
  end if;
  perform public.save_finance_profile('Walysson', 'male', date '1990-05-01');
  if (select display_name from public.get_finance_profile()) <> 'Walysson' then raise exception 'Profile not saved'; end if;
  begin
    perform public.save_finance_profile('Futuro', null, current_date + 1);
    raise exception 'Future birth date accepted';
  exception when invalid_parameter_value then null;
  end;
  if not public.write_workspace_finance_v2(current_setting('orange.v1_space')::uuid, 0, snapshot) then
    raise exception 'v2 write failed';
  end if;
  begin
    perform public.write_workspace_finance(current_setting('orange.v1_space')::uuid, 1, snapshot);
    raise exception 'Outdated clients can still write';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.finance_profiles;
    raise exception 'Profiles table is directly readable';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.v1_partner'), true);
do $$
begin
  if public.join_finance_workspace('AAAAAAAAAA') is not null then raise exception 'Unknown code accepted'; end if;
  if public.join_finance_workspace(lower(current_setting('orange.v1_code'))) <> current_setting('orange.v1_space')::uuid then
    raise exception 'Valid code (case-insensitive) rejected';
  end if;
  if public.join_finance_workspace(current_setting('orange.v1_code')) <> current_setting('orange.v1_space')::uuid then
    raise exception 'Joining twice must be idempotent';
  end if;
  if (select count(*) from public.list_finance_space_members(current_setting('orange.v1_space')::uuid)) <> 2 then
    raise exception 'Partner was not added';
  end if;
  if exists (select 1 from public.list_finance_space_members(current_setting('orange.v1_space')::uuid) where display_name like '%@%') then
    raise exception 'Member e-mail exposed as name';
  end if;
  if (select display_name from public.list_finance_space_members(current_setting('orange.v1_space')::uuid) where role = 'owner') <> 'Walysson' then
    raise exception 'Chosen profile name not shown to members';
  end if;
  if (select count(*) from public.get_finance_profile()) <> 0 then raise exception 'Another user profile leaked'; end if;
  begin
    perform public.regenerate_finance_join_code(current_setting('orange.v1_space')::uuid);
    raise exception 'Member regenerated the owner code';
  exception when insufficient_privilege then null;
  end;
  if not public.write_workspace_finance_v2(current_setting('orange.v1_space')::uuid, 1,
    '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}') then
    raise exception 'Joined member cannot sync';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.v1_outsider'), true);
do $$
begin
  begin
    perform public.get_finance_join_code(current_setting('orange.v1_space')::uuid);
    raise exception 'Outsider read the join code';
  exception when insufficient_privilege then null;
  end;
  for attempt in 1..10 loop
    if public.join_finance_workspace('ZZZZZZZZZ' || attempt::text) is not null then raise exception 'Guess accepted'; end if;
  end loop;
  begin
    perform public.join_finance_workspace(current_setting('orange.v1_code'));
    raise exception 'Brute-force throttle missing';
  exception when program_limit_exceeded then null;
  end;
  if exists (select 1 from public.workspace_finance) then raise exception 'Outsider can read shared data'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.v1_owner'), true);
do $$
declare old_code text := current_setting('orange.v1_code');
begin
  if public.regenerate_finance_join_code(current_setting('orange.v1_space')::uuid) = old_code then
    raise exception 'Code was not regenerated';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin
    perform public.join_finance_workspace('AAAAAAAAAA');
    raise exception 'Anonymous join allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
select 'PASS: profiles, join codes, throttling, member names and v2 writes' as result;
