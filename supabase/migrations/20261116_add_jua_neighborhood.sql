-- Adiciona Juá ao catálogo de bairros de Santarém/PA.
-- Idempotente: preserva o registro existente e apenas o reativa, se necessário.

begin;

insert into public.neighborhoods (name, city, state, active)
values ('Juá', 'Santarém', 'PA', true)
on conflict (name, city, state)
do update set active = true;

commit;
