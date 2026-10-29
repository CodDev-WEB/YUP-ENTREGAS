-- Corrige a sequência identity de journeys quando o contador ficou atrás dos registros existentes.
-- Isso evita "duplicate key value violates unique constraint journeys_order_number_uidx"
-- sem alterar ou apagar jornadas já registradas.
begin;

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

-- Mantém o índice único como proteção e registra o motivo da correção.
comment on column public.journeys.order_number is
  'Número sequencial único da jornada; sequência sincronizada com os registros existentes em 2026-10-29.';

commit;
