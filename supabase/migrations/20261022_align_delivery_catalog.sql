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

 
-- Controle de odômetro, ganhos e combustível conforme a planilha mensal.
create table if not exists public.odometer_entries (
 id uuid primary key default gen_random_uuid(),
 entry_date date not null,
 vehicle_code text not null check (vehicle_code in ('C','MP','MV')),
 odometer_start numeric(10,1) not null check (odometer_start >= 0),
 odometer_end numeric(10,1) not null check (odometer_end >= odometer_start),
 deliveries_count integer not null default 0 check (deliveries_count >= 0),
 revenue numeric(12,2) not null default 0 check (revenue >= 0),
 fuel_cost numeric(12,2) not null default 0 check (fuel_cost >= 0),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists odometer_entries_date_idx on public.odometer_entries(entry_date desc);
create index if not exists odometer_entries_vehicle_date_idx on public.odometer_entries(vehicle_code,entry_date desc);
alter table public.odometer_entries enable row level security;
drop policy if exists odometer_entries_admin_select on public.odometer_entries;
create policy odometer_entries_admin_select on public.odometer_entries for select to authenticated using (public.current_app_role() in ('admin','manager'));
drop policy if exists odometer_entries_admin_insert on public.odometer_entries;
create policy odometer_entries_admin_insert on public.odometer_entries for insert to authenticated with check (public.is_active_user() and public.current_app_role() in ('admin','manager') and created_by = (select auth.uid()));
drop policy if exists odometer_entries_admin_update on public.odometer_entries;
create policy odometer_entries_admin_update on public.odometer_entries for update to authenticated using (public.current_app_role() in ('admin','manager')) with check (public.current_app_role() in ('admin','manager'));
drop policy if exists odometer_entries_admin_delete on public.odometer_entries;
create policy odometer_entries_admin_delete on public.odometer_entries for delete to authenticated using (public.current_app_role() in ('admin','manager'));
grant select,insert,update,delete on public.odometer_entries to authenticated;
notify pgrst, 'reload schema';
