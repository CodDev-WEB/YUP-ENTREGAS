-- Correção emergencial e idempotente para bancos onde o catálogo não foi migrado.
-- Adiciona as colunas exigidas pelo frontend e atualiza o cache da API.
begin;

alter table public.deliveries
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists customer_order_ref text,
  add column if not exists created_source text not null default 'driver';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deliveries'::regclass
      and conname = 'deliveries_created_source_check'
  ) then
    alter table public.deliveries
      add constraint deliveries_created_source_check
      check (created_source in ('management','driver'));
  end if;
end $$;

grant select, insert, update on table public.deliveries to authenticated;
notify pgrst, 'reload schema';

commit;
