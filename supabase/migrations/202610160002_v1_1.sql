begin;

create or replace function public.rename_finance_workspace(p_workspace uuid, p_name text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_name is null or length(trim(p_name)) not between 1 and 80 then
    raise exception 'O nome do espaço deve ter de 1 a 80 caracteres.' using errcode = '22023';
  end if;
  update public.finance_workspaces
    set name = trim(p_name)
    where id = p_workspace and owner_id = auth.uid() and kind = 'shared';
  if not found then
    raise exception 'Somente o responsável pode renomear um espaço compartilhado.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.rename_finance_workspace(uuid, text) from public, anon, authenticated;
grant execute on function public.rename_finance_workspace(uuid, text) to authenticated;

commit;
