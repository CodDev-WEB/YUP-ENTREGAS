-- Corrige a política RLS para permitir que o perfil sales crie pedidos sem jornada.
-- O usuário de vendas só pode inserir entregas vinculadas ao próprio perfil.
-- Execute no SQL Editor do Supabase após aplicar a migração que adiciona o enum 'sales'.

begin;

drop policy if exists deliveries_insert_owner_or_management on public.deliveries;

create policy deliveries_insert_owner_or_management
on public.deliveries
for insert
to authenticated
with check (
  public.is_active_user()
  and (
    (
      journey_id is not null
      and public.can_access_journey(journey_id)
    )
    or (
      journey_id is null
      and public.current_app_role()::text in ('admin', 'manager')
    )
    or (
      journey_id is null
      and public.current_app_role()::text = 'sales'
      and created_by = (select auth.uid())
    )
  )
);

notify pgrst, 'reload schema';

commit;
