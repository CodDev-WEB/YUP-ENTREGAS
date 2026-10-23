-- Suporte à importação idempotente do histórico legado.
alter table public.odometer_entries drop constraint if exists odometer_entries_vehicle_code_check;
alter table public.odometer_entries add column if not exists source_type text not null default 'live' check (source_type in ('live','historical'));
alter table public.odometer_entries add column if not exists historical_import_key text;
alter table public.odometer_entries add column if not exists historical_driver text;
alter table public.odometer_entries add column if not exists historical_week integer;
alter table public.odometer_entries add column if not exists historical_month integer;
alter table public.odometer_entries add column if not exists historical_profit numeric(12,2);
create unique index if not exists odometer_entries_historical_key_unique on public.odometer_entries(historical_import_key) where historical_import_key is not null;
grant select,insert,update on public.odometer_entries to authenticated;
notify pgrst, 'reload schema';
