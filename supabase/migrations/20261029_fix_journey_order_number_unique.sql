-- Corrige o erro journeys_order_number_uidx ao iniciar uma nova jornada.
-- Preserva todos os registros e deixa a geração de números a cargo da IDENTITY,
-- depois de sincronizar a sequência com o maior número já existente.

begin;

do $$
declare
  v_sequence text;
  v_max bigint;
begin
  -- Remove a lógica antiga MAX()+1. A combinação com a sequence identity
  -- pode deixar o contador fora de sincronia após operações concorrentes.
  drop trigger if exists journeys_assign_current_number on public.journeys;

  v_sequence := pg_get_serial_sequence('public.journeys', 'order_number');
  if v_sequence is null then
    raise exception 'A coluna public.journeys.order_number não possui sequência IDENTITY/SERIAL. Verifique o esquema antes de continuar.';
  end if;

  select coalesce(max(order_number), 0)
    into v_max
    from public.journeys;

  -- Com registros, nextval() retorna um número maior que o máximo atual.
  -- Sem registros, o primeiro nextval() retorna 1.
  perform setval(v_sequence::regclass, greatest(v_max, 1), v_max > 0);
end
$$;

create unique index if not exists journeys_order_number_uidx
  on public.journeys(order_number);

commit;
