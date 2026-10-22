-- Operações atômicas para evitar jornada sem paradas ou status sem evento.
-- Aplicar após as migrações de operações, catálogo e rotas.
begin;

create or replace function public.update_delivery_status_with_event(
  p_delivery_id uuid,
  p_status public.delivery_status,
  p_note text default null,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_user_id uuid := auth.uid();
  v_event public.delivery_event_type;
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception 'Sessão inválida ou usuário inativo' using errcode = '42501';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Entrega não encontrada' using errcode = 'P0002'; end if;

  if not (
    (v_delivery.status = 'pending' and p_status in ('in_transit','failed'))
    or (v_delivery.status = 'in_transit' and p_status in ('at_destination','completed','failed'))
    or (v_delivery.status = 'at_destination' and p_status in ('completed','failed'))
  ) then
    raise exception 'Transição de status não permitida: % -> %', v_delivery.status, p_status
      using errcode = 'check_violation';
  end if;

  v_event := case p_status
    when 'in_transit' then 'departure'::public.delivery_event_type
    when 'at_destination' then 'arrival'::public.delivery_event_type
    when 'completed' then 'completed'::public.delivery_event_type
    when 'failed' then 'failed'::public.delivery_event_type
  end;

  update public.deliveries
  set status = p_status, result_note = nullif(btrim(coalesce(p_note,'')), '')
  where id = p_delivery_id;

  insert into public.delivery_events(delivery_id,event_type,actor_profile_id,idempotency_key,note)
  values (p_delivery_id,v_event,v_user_id,p_idempotency_key,nullif(btrim(coalesce(p_note,'')), ''));

  return jsonb_build_object('id',p_delivery_id,'status',p_status);
end;
$$;

create or replace function public.start_journey_with_route(
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_odometer_start numeric,
  p_route_plan_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_journey public.journeys%rowtype;
  v_count integer := 0;
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception 'Sessão inválida ou usuário inativo' using errcode = '42501';
  end if;
  if p_odometer_start is null or p_odometer_start < 0 then
    raise exception 'Odômetro inicial inválido' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.drivers d
    where d.id = p_driver_id and d.profile_id = v_user_id and d.active
  ) and public.current_app_role() not in ('admin','manager') then
    raise exception 'O usuário não pode iniciar jornada para este entregador' using errcode = '42501';
  end if;

  if p_route_plan_id is not null then
    perform 1 from public.route_plans
    where id = p_route_plan_id and assigned_driver_id = p_driver_id and status = 'assigned'
    for share;
    if not found then raise exception 'Rota não encontrada ou não atribuída a este entregador' using errcode = '42501'; end if;
    select count(*) into v_count from public.route_plan_stops where route_plan_id = p_route_plan_id;
    if v_count = 0 then raise exception 'A rota não possui paradas' using errcode = '22023'; end if;
  end if;

  insert into public.journeys(driver_id,vehicle_id,odometer_start,status,route_plan_id)
  values (p_driver_id,p_vehicle_id,p_odometer_start,'open',p_route_plan_id)
  returning * into v_journey;

  if p_route_plan_id is not null then
    insert into public.deliveries(journey_id,neighborhood_id,address,reference,map_link,priority,status,sequence_no)
    select v_journey.id,s.neighborhood_id,s.address,s.reference,s.map_link,
      coalesce(s.priority,'normal'),'pending',row_number() over (order by s.sequence_no)::integer
    from public.route_plan_stops s
    where s.route_plan_id = p_route_plan_id
    order by s.sequence_no;
  end if;

  return jsonb_build_object(
    'id',v_journey.id,'driver_id',v_journey.driver_id,'vehicle_id',v_journey.vehicle_id,
    'route_plan_id',v_journey.route_plan_id,'status',v_journey.status,
    'odometer_start',v_journey.odometer_start,'started_at_server',v_journey.started_at_server
  );
end;
$$;

revoke all on function public.update_delivery_status_with_event(uuid, public.delivery_status, text, uuid) from public, anon;
grant execute on function public.update_delivery_status_with_event(uuid, public.delivery_status, text, uuid) to authenticated;
revoke all on function public.start_journey_with_route(uuid, uuid, numeric, uuid) from public, anon;
grant execute on function public.start_journey_with_route(uuid, uuid, numeric, uuid) to authenticated;

commit;
