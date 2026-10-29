-- Compatibilidade RPC para o portal do entregador.
-- O cliente envia p_delivery_ids e p_journey_id. Algumas versões antigas da função
-- no banco podem expor os mesmos tipos em nomes/ordem diferentes.
-- Esta assinatura encaminha para a função transacional já existente.

begin;

create or replace function public.assign_pending_deliveries_to_journey(
  p_delivery_ids uuid[],
  p_journey_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select public.assign_pending_deliveries_to_journey(p_journey_id, p_delivery_ids);
$function$;

revoke all on function public.assign_pending_deliveries_to_journey(uuid[], uuid) from public, anon;
grant execute on function public.assign_pending_deliveries_to_journey(uuid[], uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
