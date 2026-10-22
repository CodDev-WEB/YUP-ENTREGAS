-- Isola o catálogo comercial: vendas consulta apenas pedidos próprios;
-- entregadores ativos consultam pedidos pendentes sem atribuição e suas jornadas.
-- Execute após 20261022_sales_role.sql e 20261022_sales_delivery_policies.sql.
begin;

drop policy if exists deliveries_read_owner_or_management on public.deliveries;
create policy deliveries_read_owner_or_management on public.deliveries
for select to authenticated
using (
  public.current_app_role() in ('admin','manager')
  or (public.current_app_role() = 'sales' and created_by = (select auth.uid()))
  or (journey_id is not null and public.can_access_journey(journey_id))
  or (
    journey_id is null
    and status = 'pending'
    and public.current_app_role() = 'driver'
    and public.is_active_user()
  )
);

commit;
