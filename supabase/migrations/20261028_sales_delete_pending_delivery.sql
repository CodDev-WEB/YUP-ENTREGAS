-- YUP-ENTREGAS: permitir exclusão segura de entregas pendentes não vinculadas a jornadas.
-- Execute no SQL Editor do projeto Supabase de produção.
begin;
grant select, insert, update, delete on table public.deliveries to authenticated;
drop policy if exists deliveries_delete_unassigned_owner_or_management on public.deliveries;
create policy deliveries_delete_unassigned_owner_or_management on public.deliveries
for delete to authenticated
using (
  public.current_app_role()::text in ('admin','manager')
  or (
    public.current_app_role()::text = 'sales'
    and created_by = (select auth.uid())
    and journey_id is null
    and status = 'pending'
  )
);
notify pgrst, 'reload schema';
commit;
