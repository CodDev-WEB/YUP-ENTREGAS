-- Classifica jornadas de entrega e deslocamentos internos da loja.
-- Aplicar no Supabase antes de usar a nova opção no aplicativo.
begin;
alter table public.journeys
  add column if not exists journey_type text not null default 'delivery',
  add column if not exists purpose_note text;
alter table public.journeys
  drop constraint if exists journeys_journey_type_check;
alter table public.journeys
  add constraint journeys_journey_type_check
  check (journey_type in ('delivery','store_use'));
alter table public.journeys
  drop constraint if exists journeys_store_use_note_check;
alter table public.journeys
  add constraint journeys_store_use_note_check
  check (journey_type <> 'store_use' or length(trim(coalesce(purpose_note,''))) > 0);
create index if not exists journeys_type_finished_idx
  on public.journeys (journey_type, finished_at_server);
commit;
