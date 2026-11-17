-- Completa o catálogo de bairros da tabela comercial da YUP Santarém.
-- Idempotente: não duplica registros e reativa os bairros se já existirem inativos.

begin;

insert into public.neighborhoods (name, city, state, active)
values
  ('Residencial Salvação', 'Santarém', 'PA', true),
  ('Nova Jerusalém', 'Santarém', 'PA', true),
  ('Buriti', 'Santarém', 'PA', true),
  ('Espírito Santo', 'Santarém', 'PA', true)
on conflict (name, city, state)
do update set active = true;

commit;
