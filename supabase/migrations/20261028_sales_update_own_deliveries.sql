-- Permite ao vendedor corrigir os próprios pedidos, inclusive depois de vinculados a uma jornada.
-- A exclusão continua restrita pela política de DELETE existente e pela regra da aplicação.
begin;

grant update on table public.deliveries to authenticated;

drop policy if exists deliveries_sales_update_own on public.deliveries;
create policy deliveries_sales_update_own on public.deliveries
for update to authenticated
using (
  public.current_app_role() = 'sales'
  and created_by = (select auth.uid())
  and public.is_active_user()
)
with check (
  public.current_app_role() = 'sales'
  and created_by = (select auth.uid())
  and public.is_active_user()
);

commit;
