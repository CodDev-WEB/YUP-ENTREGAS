-- Concede perfil administrador somente ao endereço explicitamente autorizado.
-- Crie primeiro admin@yup.com em Supabase > Authentication > Users.
-- Esta migração também promove a conta caso ela já exista.
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role public.app_role;
begin
  v_role := case
    when lower(coalesce(new.email, '')) = 'admin@yup.com'
      then 'admin'::public.app_role
    else 'driver'::public.app_role
  end;

  insert into public.profiles(id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    v_role
  )
  on conflict (id) do update
    set role = excluded.role;

  return new;
end;
$$;

update public.profiles p
set role = 'admin'::public.app_role,
    active = true
from auth.users u
where u.id = p.id
  and lower(coalesce(u.email, '')) = 'admin@yup.com';

commit;
