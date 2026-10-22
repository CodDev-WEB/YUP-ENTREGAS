-- Corrige o ON CONFLICT (journey_id) usado no fechamento diário.
-- O índice anterior era parcial e não era elegível para inferência do ON CONFLICT
-- no upsert do PostgREST. Índice UNIQUE não parcial continua permitindo vários NULLs.
drop index if exists public.odometer_entries_journey_unique;

create unique index if not exists odometer_entries_journey_unique
  on public.odometer_entries (journey_id);

notify pgrst, 'reload schema';
