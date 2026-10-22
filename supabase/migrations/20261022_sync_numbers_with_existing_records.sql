-- Recalcula a numeração a partir dos registros que ainda existem.
-- O advisory lock serializa inclusões concorrentes para evitar números repetidos.
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

create or replace function public.assign_current_delivery_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.deliveries.order_number'));
  new.order_number := coalesce((select max(d.order_number) from public.deliveries d), 0) + 1;
  return new;
end;
$$;

drop trigger if exists deliveries_assign_current_number on public.deliveries;
create trigger deliveries_assign_current_number
before insert on public.deliveries
for each row execute function public.assign_current_delivery_number();

-- Alinha as sequences de identity ao estado atual, inclusive quando as tabelas estão vazias.
select setval(pg_get_serial_sequence('public.journeys', 'order_number'),
              coalesce((select max(order_number) from public.journeys), 1),
              exists(select 1 from public.journeys));
select setval(pg_get_serial_sequence('public.deliveries', 'order_number'),
              coalesce((select max(order_number) from public.deliveries), 1),
              exists(select 1 from public.deliveries));
