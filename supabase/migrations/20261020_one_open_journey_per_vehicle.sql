-- YUP-ENTREGAS: impedir que um veículo tenha duas jornadas abertas ao mesmo tempo.
-- Execute uma única vez no SQL Editor do Supabase após a migração de hardening.
-- A restrição é aplicada no PostgreSQL, inclusive em acessos concorrentes.

do $$
begin
  if exists (
    select 1
    from public.journeys
    where status = 'open'
    group by vehicle_id
    having count(*) > 1
  ) then
    raise exception 'Existem veículos com mais de uma jornada aberta. Corrija os registros antes de aplicar esta migração.';
  end if;
end
$$;

create unique index if not exists journeys_one_open_per_vehicle
  on public.journeys(vehicle_id)
  where status = 'open';
