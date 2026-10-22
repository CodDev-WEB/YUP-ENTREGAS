-- Corrige permissões explícitas de leitura e administração da frota.
-- Não cria veículos fictícios nem altera os registros existentes.
begin;

grant select on table public.vehicles to authenticated;

drop policy if exists vehicles_read_active_users on public.vehicles;
create policy vehicles_read_active_users
on public.vehicles
for select
to authenticated
using (
  public.is_active_user()
  and public.current_app_role() in ('admin','manager','driver','sales')
);

drop policy if exists vehicles_admin_manage on public.vehicles;
create policy vehicles_admin_manage
on public.vehicles
for all
to authenticated
using (public.current_app_role() = 'admin' and public.is_active_user())
with check (public.current_app_role() = 'admin' and public.is_active_user());

commit;
