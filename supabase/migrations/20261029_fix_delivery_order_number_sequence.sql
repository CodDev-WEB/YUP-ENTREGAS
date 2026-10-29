-- Corrige a sequência das entregas quando o identity ficou atrás dos registros existentes.
-- Serializa novas inclusões para evitar colisões entre cadastros simultâneos.
-- Não altera nem apaga entregas já registradas.
begin;

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

do $$
declare
  v_sequence text;
  v_max bigint;
begin
  v_sequence := pg_get_serial_sequence('public.deliveries', 'order_number');
  if v_sequence is not null then
    select coalesce(max(order_number), 0)
      into v_max
      from public.deliveries;

    perform setval(v_sequence::regclass, greatest(v_max, 1), v_max > 0);
  end if;
end
$$;

comment on column public.deliveries.order_number is
  'Número sequencial único da entrega; sequência sincronizada com os registros existentes em 2026-10-29.';

commit;
