-- Shared Google Sheets mirror permissions. Run after all migrations; every change is rolled back.
begin;

select set_config('orange.sheet_owner', gen_random_uuid()::text, true);
select set_config('orange.sheet_member', gen_random_uuid()::text, true);
select set_config('orange.sheet_outsider', gen_random_uuid()::text, true);
insert into auth.users(id, email, email_confirmed_at) values
  (current_setting('orange.sheet_owner')::uuid, 'sheet-owner@example.invalid', now()),
  (current_setting('orange.sheet_member')::uuid, 'sheet-member@example.invalid', now()),
  (current_setting('orange.sheet_outsider')::uuid, 'sheet-outsider@example.invalid', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('orange.sheet_owner'), true);
select set_config('orange.sheet_space', public.create_family_workspace('Planilha compartilhada')::text, true);
select set_config('orange.sheet_code', public.get_finance_join_code(current_setting('orange.sheet_space')::uuid), true);

select set_config('request.jwt.claim.sub', current_setting('orange.sheet_member'), true);
select public.join_finance_workspace(current_setting('orange.sheet_code'));

do $$
begin
  if exists(select 1 from public.get_finance_sheet_mirror(current_setting('orange.sheet_space')::uuid)) then
    raise exception 'Mirror exists before owner registration';
  end if;
  begin
    perform public.save_finance_sheet_mirror(current_setting('orange.sheet_space')::uuid, 'valid-sheet-id-123');
    raise exception 'Ordinary member registered mirror';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_finance_sheet_member_emails(current_setting('orange.sheet_space')::uuid);
    raise exception 'Ordinary member read member emails';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.sheet_owner'), true);
select public.save_finance_sheet_mirror(current_setting('orange.sheet_space')::uuid, 'valid-sheet-id-123');
do $$
begin
  if (select count(*) from public.list_finance_sheet_member_emails(current_setting('orange.sheet_space')::uuid)) <> 1 then
    raise exception 'Owner did not receive exactly the verified member emails';
  end if;
  if (select email from public.list_finance_sheet_member_emails(current_setting('orange.sheet_space')::uuid))
      <> 'sheet-member@example.invalid' then
    raise exception 'Wrong member email returned';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.sheet_member'), true);
do $$
begin
  if (select spreadsheet_id from public.get_finance_sheet_mirror(current_setting('orange.sheet_space')::uuid))
      <> 'valid-sheet-id-123' then
    raise exception 'Member cannot discover registered mirror';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('orange.sheet_outsider'), true);
do $$
begin
  begin
    perform public.get_finance_sheet_mirror(current_setting('orange.sheet_space')::uuid);
    raise exception 'Outsider discovered mirror';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.finance_sheet_mirrors;
    raise exception 'Direct mirror table read was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
select 'PASS: shared sheet discovery and member e-mail privacy' as result;
