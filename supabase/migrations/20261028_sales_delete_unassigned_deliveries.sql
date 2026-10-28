-- Permite que vendas exclua apenas entregas próprias ainda não vinculadas a uma jornada.
-- Corrige o erro "Nenhuma linha foi excluída" causado pela ausência de DELETE grant/policy.
begin;

grant delete on table public.deliveries to authenticated;

drop policy if exists deliveries_sales_delete_own_unassigned on public.deliveries;
create policy deliveries_sales_delete_own_unassigned
on public.deliveries
for delete
to authenticated
using (
  public.current_app_role()::text = 'sales'
  and created_by = (select auth.uid())
  and journey_id is null
  and status = 'pending'
  and public.is_active_user()
);

notify pgrst, 'reload schema';
commit;
