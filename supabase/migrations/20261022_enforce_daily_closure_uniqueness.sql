-- Um único fechamento por data (entry_date já é PRIMARY KEY).
-- Uma única linha de fechamento por jornada (NULLs continuam permitidos para lançamentos manuais).
drop index if exists public.odometer_entries_journey_unique;
create unique index if not exists odometer_entries_journey_unique
  on public.odometer_entries (journey_id);

notify pgrst, 'reload schema';
