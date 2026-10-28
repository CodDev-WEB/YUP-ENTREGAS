-- Permite que vendas exclua apenas entregas próprias ainda não vinculadas a uma jornada.
-- A regra no banco complementa a validação da interface.
alter table public.deliveries enable row level security;

drop policy if exists "sales_delete_own_unassigned_deliveries" on public.deliveries;
create policy "sales_delete_own_unassigned_deliveries"
on public.deliveries
for delete
to authenticated
using (
  created_by = auth.uid()
  and journey_id is null
);

drop policy if exists "sales_update_own_deliveries" on public.deliveries;
create policy "sales_update_own_deliveries"
on public.deliveries
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());
