-- Fechamento diário das taxas de entrega e distribuição por jornada concluída.
create table if not exists public.daily_journey_rates (
 entry_date date primary key,
 total_delivery_fees numeric(12,2) not null check(total_delivery_fees>=0),
 fuel_price_per_liter numeric(10,3) not null check(fuel_price_per_liter>=0),
 average_km_per_liter numeric(8,2) not null default 30 check(average_km_per_liter>0),
 journey_count integer not null default 0 check(journey_count>=0),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.odometer_entries add column if not exists journey_id uuid references public.journeys(id) on delete cascade;
alter table public.odometer_entries add column if not exists daily_fees_total numeric(12,2) not null default 0 check(daily_fees_total>=0);
alter table public.odometer_entries add column if not exists fuel_price_per_liter numeric(10,3) not null default 0 check(fuel_price_per_liter>=0);
alter table public.odometer_entries add column if not exists average_km_per_liter numeric(8,2) not null default 30 check(average_km_per_liter>0);
alter table public.odometer_entries drop constraint if exists odometer_entries_vehicle_code_check;
create unique index if not exists odometer_entries_journey_unique on public.odometer_entries(journey_id) where journey_id is not null;
alter table public.daily_journey_rates enable row level security;
drop policy if exists daily_journey_rates_admin_select on public.daily_journey_rates;
create policy daily_journey_rates_admin_select on public.daily_journey_rates for select to authenticated using (public.is_active_user() and public.current_app_role() in ('admin','manager'));
drop policy if exists daily_journey_rates_admin_insert on public.daily_journey_rates;
create policy daily_journey_rates_admin_insert on public.daily_journey_rates for insert to authenticated with check (public.is_active_user() and public.current_app_role() in ('admin','manager') and created_by=(select auth.uid()));
drop policy if exists daily_journey_rates_admin_update on public.daily_journey_rates;
create policy daily_journey_rates_admin_update on public.daily_journey_rates for update to authenticated using (public.is_active_user() and public.current_app_role() in ('admin','manager')) with check (public.is_active_user() and public.current_app_role() in ('admin','manager'));
grant select,insert,update on public.daily_journey_rates to authenticated;
grant select,insert,update,delete on public.odometer_entries to authenticated;
notify pgrst, 'reload schema';