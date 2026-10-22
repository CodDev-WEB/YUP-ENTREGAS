-- YUP Entregas: catálogo central de entregas e atribuição à jornada.
-- Aplicar UMA vez no SQL Editor do Supabase antes de publicar o fluxo novo.
begin;

alter table public.deliveries alter column journey_id drop not null;
alter table public.deliveries
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists created_source text not null default 'driver'
    check (created_source in ('management','driver'));

create index if not exists deliveries_unassigned_pending
  on public.deliveries(status, created_at desc) where journey_id is null;

drop policy if exists deliveries_read_owner_or_management on public.deliveries;
create policy deliveries_read_owner_or_management on public.deliveries
for select to authenticated
using (
  public.current_app_role() in ('admin','manager')
  or (journey_id is not null and public.can_access_journey(journey_id))
  or (journey_id is null and status='pending' and public.is_active_user())
);

drop policy if exists deliveries_insert_owner_or_management on public.deliveries;
create policy deliveries_insert_owner_or_management on public.deliveries
for insert to authenticated
with check (
  (journey_id is not null and public.can_access_journey(journey_id))
  or (journey_id is null and public.current_app_role() in ('admin','manager')
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
  or (journey_id is not null and exists (
    select 1 from public.journeys j
    join public.drivers d on d.id=j.driver_id
    where j.id=deliveries.journey_id and j.status='open'
      and d.profile_id=(select auth.uid())
  ))
);

commit;
