-- Hotfix idempotente para alinhar o catálogo de entregas em bancos existentes.
-- Corrige created_by ausente, permite pedidos sem jornada e ajusta políticas RLS.
begin;

alter table public.deliveries
  alter column journey_id drop not null;

alter table public.deliveries
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists customer_order_ref text,
  add column if not exists created_source text not null default 'driver';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deliveries'::regclass
      and conname = 'deliveries_created_source_check'
  ) then
    alter table public.deliveries
      add constraint deliveries_created_source_check
      check (created_source in ('management','driver'));
  end if;
end $$;

create index if not exists deliveries_unassigned_pending
  on public.deliveries(status, created_at desc) where journey_id is null;

alter table public.deliveries enable row level security;
grant select, insert, update on table public.deliveries to authenticated;

drop policy if exists deliveries_read_owner_or_management on public.deliveries;
create policy deliveries_read_owner_or_management on public.deliveries
for select to authenticated
using (
  public.current_app_role()::text in ('admin','manager')
  or (public.current_app_role()::text = 'sales' and created_by = (select auth.uid()))
  or (journey_id is not null and public.can_access_journey(journey_id))
  or (
    journey_id is null and status = 'pending'
    and public.current_app_role()::text = 'driver'
    and public.is_active_user()
  )
);

drop policy if exists deliveries_insert_owner_or_management on public.deliveries;
create policy deliveries_insert_owner_or_management on public.deliveries
for insert to authenticated
with check (
  public.is_active_user()
  and (
    (journey_id is not null and public.can_access_journey(journey_id))
    or (journey_id is null and public.current_app_role()::text in ('admin','manager','sales'))
  )
);

drop policy if exists deliveries_update_owner_or_management on public.deliveries;
create policy deliveries_update_owner_or_management on public.deliveries
for update to authenticated
using (
  public.current_app_role()::text in ('admin','manager')
  or (journey_id is not null and public.can_access_journey(journey_id))
)
with check (
  public.current_app_role()::text in ('admin','manager')
  or (journey_id is not null and public.can_access_journey(journey_id))
);

notify pgrst, 'reload schema';
commit;
