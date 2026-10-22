# Configuração do Supabase — YUP-ENTREGAS

## Objetivo
Criar o banco PostgreSQL central, autenticação por e-mail/senha, papéis e políticas RLS para separar administração, gestão e entregadores. Realtime cobre jornadas, entregas e eventos. O frontend atual autentica pelo Supabase; jornadas e entregas são lidas e gravadas no banco por meio do cliente web e de políticas RLS. Combustível e manutenção ainda usam armazenamento local e não são registros centralizados. Não use dados reais até aplicar as migrações e testar cada perfil.

## 1. Criar projeto gratuito
1. Crie um projeto em https://supabase.com e escolha a região mais próxima disponível.
2. O plano gratuito tem limites e pode pausar projetos inativos; confirme os limites atuais antes de usar em operação.
3. Em Project Settings > API, copie Project URL e chave pública anon/publishable. Não copie service_role.
4. Edite supabase-config.js no repositório com a Project URL e a chave pública anon/publishable. Esses valores são destinados ao navegador e podem estar no código público; a segurança depende de Auth e RLS. Nunca inclua service_role.

## 2. Aplicar o banco
1. Abra SQL Editor no Supabase.
2. Para um projeto novo, execute `supabase/schema.sql`.
3. Para o projeto existente, execute individualmente as migrações ainda não aplicadas: `20261020_operations_hardening.sql`, `20261020_one_open_journey_per_vehicle.sql`, `20261020_journey_gps_timeline.sql`, `20261020_journey_order_numbers.sql` e `20261020_delivery_order_numbers.sql`.
4. Se o banco existente ainda não tiver o recurso de rotas preparadas, execute também `supabase/route-plans-migration.sql` para criar `route_plans`, `route_plan_stops`, as políticas RLS e o vínculo com jornadas. Projetos novos que executaram `supabase/schema.sql` já incluem esse recurso.
5. Confirme tabelas, colunas, gatilhos e políticas RLS. O GitHub não executa os SQLs automaticamente; não execute novamente o esquema inicial em um banco já existente.
5. Em Authentication > Providers, habilite e-mail/senha. Se a empresa controlar os acessos, desabilite cadastro público e crie usuários pela administração.

## 3. Criar o primeiro administrador
1. Em Authentication > Users, crie o usuário administrativo.
2. Copie seu UUID e execute no SQL Editor, substituindo o valor:
   update public.profiles set role = 'admin' where id = 'UUID-DO-ADMIN';
3. Crie usuários de entregadores e vincule seus perfis em public.drivers.profile_id.
4. Novos perfis começam como driver. Nunca permita que o usuário escolha ou altere o próprio papel.

## 4. Configuração e segurança
- supabase-config.js contém apenas URL e chave pública anon/publishable, que são destinadas ao cliente. O projeto deve ter RLS em todas as tabelas expostas.
- supabase-client.js oferece conexão, login, leitura do perfil, logout e assinatura Realtime.
- O SDK é carregado por CDN e requer conexão no primeiro carregamento.
- Antes da produção, teste as políticas com contas separadas de admin, manager e driver.
- RLS é a barreira real de autorização; esconder botões na interface não substitui políticas no banco.

## 5. Publicação gratuita
O repositório está configurado para publicar o Worker e os assets estáticos no Cloudflare por GitHub Actions. Em **Settings → Secrets and variables → Actions**, configure `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O workflow valida os arquivos e a configuração Wrangler antes do deploy. A configuração pública do Supabase é incluída no frontend e pode ser pública; nunca publique uma chave `service_role`. Não publique dados operacionais no repositório.

## Limitações atuais
- O portal por código em `/entregador` ainda não autentica; utilize o login individual no painel principal.
- Combustível e manutenção permanecem locais no navegador.
- Não existe fila offline durável para jornadas e entregas.
- A captura GPS pode ser suspensa pelo navegador em segundo plano.

Até aplicar as migrações e testar cada perfil e fluxo, não use dados reais de clientes.
