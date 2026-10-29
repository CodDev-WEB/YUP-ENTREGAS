-- Correção robusta da numeração de entregas.
-- Usa a sequência IDENTITY nativa do PostgreSQL para geração concorrente segura.
-- Remove o trigger antigo que calculava MAX(order_number)+1 e podia colidir
-- com inserções concorrentes ou com a sequência dessincronizada.
-- Não apaga nem modifica entregas existentes.

begin;

drop trigger if exists deliveries_assign_current_number on public.deliveries;

do $$
declare
  v_sequence text;
  v_max bigint;
begin
  v_sequence := pg_get_serial_sequence('public.deliveries', 'order_number');

  if v_sequence is null then
    raise exception 'Não foi encontrada uma sequência identity/serial para public.deliveries.order_number. Verifique o esquema antes de continuar.';
  end if;

  select coalesce(max(order_number), 0)
    into v_max
    from public.deliveries;

  -- Se houver registros, o próximo nextval será maior que o maior número atual.
  -- Se estiver vazia, o primeiro nextval será 1.
  perform setval(v_sequence::regclass, greatest(v_max, 1), v_max > 0);
end
$$;

-- Garante que o índice único esperado esteja presente.
create unique index if not exists deliveries_order_number_unique
  on public.deliveries(order_number);

commit;
