-- Preserva a finalidade textual das jornadas internas importadas da planilha antiga.
begin;
alter table public.odometer_entries
  add column if not exists historical_purpose text;
create index if not exists odometer_entries_historical_purpose_idx
  on public.odometer_entries (historical_purpose)
  where historical_purpose is not null;
notify pgrst, 'reload schema';
commit;
