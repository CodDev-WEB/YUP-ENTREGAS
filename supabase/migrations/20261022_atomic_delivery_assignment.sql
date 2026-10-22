-- YUP Entregas: atribuição atômica de pedidos pendentes à jornada.
-- Aplicar no SQL Editor do Supabase após 20261022_delivery_catalog.sql.
-- Valida toda a seleção antes de gravar: não deixa atribuições parciais nem duplicadas.

begin;

create or replace function public.assign_pending_deliveries_to_journey(
  p_journey_id uuid,
  p_delivery_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_journey public.journeys%rowtype;
  v_ids uuid[];
  v_updated integer;
  v_next_sequence integer;
begin
  if v_user_id is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.active = true;

  if v_role is null then
    raise exception 'Usuário inativo ou sem perfil autorizado.' using errcode = '42501';
  end if;

  if p_journey_id is null or p_delivery_ids is null
     or cardinality(p_delivery_ids) = 0 then
    raise exception 'Selecione uma jornada e pelo menos uma entrega.' using errcode = '22023';
  end if;

  select array_agg(distinct x) into v_ids
  from unnest(p_delivery_ids) as x
  where x is not null;

  if coalesce(cardinality(v_ids), 0) = 0 then
    raise exception 'Nenhuma entrega válida foi selecionada.' using errcode = '22023';
  end if;

  select j.* into v_journey
  from public.journeys j
  where j.id = p_journey_id and j.status = 'open'
  for update;

  if not found then
    raise exception 'A jornada não existe ou não está aberta.' using errcode = 'P0002';
  end if;

  if v_role not in ('admin','manager') and not exists (
    select 1 from public.drivers d
    where d.id = v_journey.driver_id and d.profile_id = v_user_id and d.active = true
  ) then
    raise exception 'Você não tem permissão para atribuir entregas a esta jornada.' using errcode = '42501';
  end if;

  -- Bloqueia e valida toda a seleção antes de alterar qualquer entrega.
  perform 1
  from public.deliveries d
  where d.id = any(v_ids)
  order by d.id
  for update;

  if (select count(*) from public.deliveries d where d.id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'Uma ou mais entregas não existem ou não estão acessíveis.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.deliveries d
    where d.id = any(v_ids)
      and (d.journey_id is not null or d.status <> 'pending')
  ) then
    raise exception 'Uma ou mais entregas já foram atribuídas ou não estão pendentes. Atualize a lista.' using errcode = '55000';
  end if;

  select coalesce(max(d.sequence_no), 0) + 1 into v_next_sequence
  from public.deliveries d
  where d.journey_id = p_journey_id;

  with numbered as (
    select d.id, (v_next_sequence + row_number() over (order by d.created_at, d.order_number) - 1)::integer as seq
    from public.deliveries d
    where d.id = any(v_ids)
  )
  update public.deliveries d
  set journey_id = p_journey_id, sequence_no = n.seq
  from numbered n
  where d.id = n.id and d.journey_id is null and d.status = 'pending';

  get diagnostics v_updated = row_count;

  if v_updated <> cardinality(v_ids) then
    raise exception 'Não foi possível atribuir todas as entregas. Atualize a lista e tente novamente.' using errcode = '40001';
  end if;

  return jsonb_build_object('journey_id', p_journey_id, 'assigned_count', v_updated, 'delivery_ids', to_jsonb(v_ids));
end;
$$;

revoke all on function public.assign_pending_deliveries_to_journey(uuid, uuid[]) from public, anon;
grant execute on function public.assign_pending_deliveries_to_journey(uuid, uuid[]) to authenticated;

commit;
