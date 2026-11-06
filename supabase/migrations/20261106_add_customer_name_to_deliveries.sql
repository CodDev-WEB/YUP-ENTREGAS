-- Adiciona o nome do cliente como identificação informada da entrega.
-- Mantém order_no como identificador interno automático e preserva dados antigos.
begin;
alter table public.deliveries
  add column if not exists customer_name text;
create index if not exists deliveries_customer_name_idx
  on public.deliveries using gin (to_tsvector('simple', coalesce(customer_name,'')));
notify pgrst, 'reload schema';
commit;
