begin;

select set_config('orange.test_user_a', gen_random_uuid()::text, true);
select set_config('orange.test_user_b', gen_random_uuid()::text, true);
select set_config('orange.test_user_c', gen_random_uuid()::text, true);
insert into auth.users(id, email, email_confirmed_at) values
  (current_setting('orange.test_user_a')::uuid, 'orange-test-a@example.invalid', now()),
  (current_setting('orange.test_user_b')::uuid, 'orange-test-b@example.invalid', now()),
  (current_setting('orange.test_user_c')::uuid, 'orange-test-c@example.invalid', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('orange.test_user_a'), true);
select set_config('orange.personal_a', public.ensure_personal_finance_workspace()::text, true);
select set_config('orange.family', public.create_family_workspace('Família teste')::text, true);
select set_config('orange.invite', public.invite_finance_member(
  current_setting('orange.family')::uuid, 'orange-test-b@example.invalid')::text, true);

do $$
declare snapshot jsonb := '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}';
begin
  if not public.write_workspace_finance(current_setting('orange.personal_a')::uuid, 0, snapshot) then
    raise exception 'Private space initialization failed';
  end if;
  if not public.write_workspace_finance(current_setting('orange.family')::uuid, 0, snapshot) then
    raise exception 'Family space initialization failed';
  end if;
  if public.write_workspace_finance(current_setting('orange.family')::uuid, 0, snapshot) then
    raise exception 'Duplicate initialization accepted';
  end if;
  if public.write_workspace_finance(current_setting('orange.family')::uuid, 9, snapshot) then
    raise exception 'Stale write accepted';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.test_user_c'), true);
do $$
begin
  begin
    perform public.accept_finance_invitation(current_setting('orange.invite')::uuid);
    raise exception 'Wrong email accepted invitation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.write_workspace_finance(current_setting('orange.family')::uuid, 1, '{}');
    raise exception 'Non-member wrote family data';
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.workspace_finance) then raise exception 'Non-member read family data'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.test_user_b'), true);
select public.ensure_personal_finance_workspace();
select public.accept_finance_invitation(current_setting('orange.invite')::uuid);
do $$
begin
  if (select count(*) from public.workspace_finance) <> 1 then raise exception 'Private space leaked to family member'; end if;
  if not public.write_workspace_finance(current_setting('orange.family')::uuid, 1,
    '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}')
    then raise exception 'Family member cannot update shared data'; end if;
  begin
    perform public.invite_finance_member(current_setting('orange.family')::uuid, 'orange-test-c@example.invalid');
    raise exception 'Ordinary member created invitation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.remove_finance_member(current_setting('orange.family')::uuid, current_setting('orange.test_user_a')::uuid);
    raise exception 'Ordinary member removed owner';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.workspace_finance set revision = 999;
    raise exception 'Direct write was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.test_user_a'), true);
select public.remove_finance_member(current_setting('orange.family')::uuid, current_setting('orange.test_user_b')::uuid);
select set_config('request.jwt.claim.sub', current_setting('orange.test_user_b'), true);
do $$
begin
  if exists(select 1 from public.workspace_finance) then raise exception 'Removed member can still read data'; end if;
  begin
    perform public.write_workspace_finance(current_setting('orange.family')::uuid, 2,
      '{"accounts":[],"categories":[],"transactions":[],"budgets":[],"settings":[]}');
    raise exception 'Removed member can still write data';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin
    perform 1 from public.workspace_finance;
    raise exception 'Anonymous read was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_finance_workspaces();
    raise exception 'Anonymous workspace listing was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
select 'PASS: private/family isolation, invitations, revocation and revisions' as result;
