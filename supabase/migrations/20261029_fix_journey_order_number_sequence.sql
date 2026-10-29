-- Corrige a sequência identity de journeys quando o contador ficou atrás dos registros existentes.
-- Também garante numeração segura em inclusões concorrentes.
-- Não altera nem apaga jornadas já registradas.
begin;

create or replace function public.assign_current_journey_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.journeys.order_number'));
  new.order_number := coalesce((select max(j.order_number) from public.journeys j), 0) + 1;
  return new;
end;
$$;

drop trigger if exists journeys_assign_current_number on public.journeys;
create trigger journeys_assign_current_number
before insert on public.journeys
for each row execute function public.assign_current_journey_number();

do $$
declare
  v_sequence text;
  v_max bigint;
begin
  v_sequence := pg_get_serial_sequence('public.journeys', 'order_number');
  if v_sequence is not null then
    select coalesce(max(order_number), 0)
      into v_max
      from public.journeys;

    perform setval(v_sequence::regclass, greatest(v_max, 1), v_max > 0);
  end if;
end
$$;

comment on column public.journeys.order_number is
  'Número sequencial único da jornada; sequência sincronizada com os registros existentes em 2026-10-29.';

commit;
