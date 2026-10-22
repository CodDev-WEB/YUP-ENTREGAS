-- Políticas do catálogo para o portal exclusivo de vendas.
-- Requer: 20261022_delivery_catalog.sql e 20261022_sales_role.sql aplicadas.
begin;

drop policy if exists deliveries_read_owner_or_management on public.deliveries;
create policy deliveries_read_owner_or_management on public.deliveries
for select to authenticated
using (
 public.current_app_role() in ('admin','manager')
 or (public.current_app_role() = 'sales' and created_by = (select auth.uid()))
 or (journey_id is not null and public.can_access_journey(journey_id))
 or (journey_id is null and status='pending' and public.current_app_role() = 'driver' and public.is_active_user())
);

drop policy if exists deliveries_insert_owner_or_management on public.deliveries;
create policy deliveries_insert_owner_or_management on public.deliveries
for insert to authenticated
with check (
 (journey_id is not null and public.can_access_journey(journey_id))
 or (journey_id is null and public.current_app_role() in ('admin','manager','sales')
     and public.is_active_user())
);

drop policy if exists deliveries_update_owner_or_management on public.deliveries;
create policy deliveries_update_owner_or_management on public.deliveries
for update to authenticated
using (
 (journey_id is not null and public.can_access_journey(journey_id))
 or (journey_id is null and public.current_app_role() in ('admin','manager'))
)
with check (
 (journey_id is not null and public.can_access_journey(journey_id))
 or (journey_id is null and public.current_app_role() in ('admin','manager'))
 or (
   journey_id is not null
   and exists (
    select 1 from public.journeys j
    join public.drivers d on d.id=j.driver_id
    where j.id=deliveries.journey_id and j.status='open'
      and d.profile_id=(select auth.uid())
   )
 )
);

commit;
