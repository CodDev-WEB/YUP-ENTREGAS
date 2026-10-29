-- Completa o catálogo de bairros urbanos oficiais de Santarém/PA.
-- Fonte de referência: legislação municipal que relaciona os 48 bairros urbanos.
-- Preserva IDs e vínculos existentes, reativa bairros cadastrados e evita duplicatas
-- comuns causadas apenas por diferenças de acentuação/caixa.

begin;

create temporary table _santarem_official_neighborhoods (
  name text primary key
) on commit drop;

insert into _santarem_official_neighborhoods (name) values
  ('Aeroporto Velho'),
  ('Aldeia'),
  ('Alvorada'),
  ('Amparo'),
  ('Aparecida'),
  ('Área Verde'),
  ('Cambuquira'),
  ('Caranazal'),
  ('Centro'),
  ('Conquista'),
  ('Diamantino'),
  ('Elcione Barbalho'),
  ('Esperança'),
  ('Fátima'),
  ('Floresta'),
  ('Interventoria'),
  ('Ipanema'),
  ('Jaderlândia'),
  ('Jardim Santarém'),
  ('Jutaí'),
  ('Laguinho'),
  ('Liberdade'),
  ('Livramento'),
  ('Maicá'),
  ('Mapiri'),
  ('Maracanã'),
  ('Maracanã I'),
  ('Mararú'),
  ('Matinha'),
  ('Nova República'),
  ('Nova Vitória'),
  ('Novo Horizonte'),
  ('Pérola do Maicá'),
  ('Prainha'),
  ('Salé'),
  ('Santa Clara'),
  ('Santana'),
  ('Santarenzinho'),
  ('Santíssimo'),
  ('Santo André'),
  ('São Cristóvão'),
  ('São Francisco'),
  ('São José Operário'),
  ('Uruará'),
  ('Urumanduba'),
  ('Urumari'),
  ('Vigia'),
  ('Vitória Régia');

-- Reativa os registros já existentes, comparando nomes sem diferença de acentos.
update public.neighborhoods n
set active = true
where lower(translate(n.name,
  'áàâãäéèêëíìîïóòôõöúùûüç',
  'aaaaaeeeeiiiiooooouuuuc')) in (
    select lower(translate(o.name,
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'))
    from _santarem_official_neighborhoods o
  )
  and lower(n.city) = lower('Santarém')
  and upper(n.state) = 'PA';

-- Insere somente os bairros que ainda não existem, sem apagar nem recriar registros.
insert into public.neighborhoods (name, city, state, active)
select o.name, 'Santarém', 'PA', true
from _santarem_official_neighborhoods o
where not exists (
  select 1
  from public.neighborhoods n
  where lower(n.city) = lower('Santarém')
    and upper(n.state) = 'PA'
    and lower(translate(n.name,
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc')) =
      lower(translate(o.name,
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'))
);

commit;
