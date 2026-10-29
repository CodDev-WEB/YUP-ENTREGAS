-- Retorna somente o último odômetro FINAL registrado para o veículo selecionado.
-- Execute esta migração no SQL Editor do Supabase antes de testar a nova tela do entregador.
create or replace function public.get_latest_vehicle_odometer(p_vehicle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Sessão inválida ou usuário inativo' using errcode = '42501';
  end if;

  if p_vehicle_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'value', j.odometer_end,
    'journey_id', j.id,
    'finished_at', j.finished_at_server
  )
  into v_result
  from public.journeys j
  where j.vehicle_id = p_vehicle_id
    and j.odometer_end is not null
    and j.finished_at_server is not null
  order by j.finished_at_server desc, j.started_at_server desc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.get_latest_vehicle_odometer(uuid) from public, anon;
grant execute on function public.get_latest_vehicle_odometer(uuid) to authenticated;
