-- Run in the Supabase SQL Editor after the migration. All test records are rolled back.
begin;

select set_config('orange.test_user_a', gen_random_uuid()::text, true);
select set_config('orange.test_user_b', gen_random_uuid()::text, true);
insert into auth.users (id) values
  (current_setting('orange.test_user_a')::uuid),
  (current_setting('orange.test_user_b')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('orange.test_user_a'), true);

do $$
declare
  snapshot jsonb := '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}';
begin
  if not public.write_finance(0, snapshot) then raise exception 'Initial write failed'; end if;
  if public.write_finance(0, snapshot) then raise exception 'Duplicate initial write accepted'; end if;
  if public.write_finance(9, snapshot) then raise exception 'Stale revision accepted'; end if;
  if not public.write_finance(1, snapshot) then raise exception 'Revision update failed'; end if;
  if (select revision from public.finance_sync) <> 2 then raise exception 'Wrong revision'; end if;
  begin
    update public.finance_sync set data = snapshot;
    raise exception 'Direct updates must be denied';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.test_user_b'), true);
do $$
begin
  if exists (select 1 from public.finance_sync) then raise exception 'User B can read user A data'; end if;
  if not public.write_finance(0, '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}') then
    raise exception 'User B cannot create own snapshot';
  end if;
  if (select count(*) from public.finance_sync) <> 1 then raise exception 'User isolation failed'; end if;
  if exists (select 1 from public.finance_sync where user_id <> auth.uid()) then raise exception 'Foreign user data visible'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.test_user_a'), true);
do $$
begin
  if (select count(*) from public.finance_sync) <> 1 then raise exception 'User A can read user B data'; end if;
  if (select revision from public.finance_sync) <> 2 then raise exception 'User B overwrote user A data'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin
    perform 1 from public.finance_sync;
    raise exception 'Anonymous reads must be denied';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.write_finance(0, '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}');
    raise exception 'Anonymous writes must be denied';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
rollback;
select 'PASS: isolation, revisions, and anonymous access checks' as result;
