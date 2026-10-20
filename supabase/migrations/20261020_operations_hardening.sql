-- YUP-ENTREGAS: hardening da integração de jornadas e entregas.
-- Execute uma única vez no SQL Editor do Supabase após publicar esta versão.
-- Não exige recriar as tabelas existentes.

drop policy if exists journeys_admin_manage on public.journeys;
create policy journeys_admin_manage on public.journeys
for all to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

-- Regras de transição no banco: não dependem somente do JavaScript do navegador.
create or replace function public.enforce_delivery_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('in_transit', 'failed'))
    or (old.status = 'in_transit' and new.status in ('at_destination', 'completed', 'failed'))
    or (old.status = 'at_destination' and new.status in ('completed', 'failed'))
  ) then
    raise exception 'Transição de status da entrega não permitida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists deliveries_enforce_status_transition on public.deliveries;
create trigger deliveries_enforce_status_transition
before update of status on public.deliveries
for each row execute function public.enforce_delivery_status_transition();

-- Confirme que a tabela de eventos continua disponível no Realtime.
do $$
begin
  alter publication supabase_realtime add table public.delivery_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
