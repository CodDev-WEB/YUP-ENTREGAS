# YUP-ENTREGAS

Sistema centralizado de gestão de entregas e monitoramento da frota da YUP Store, com foco inicial em Santarém–PA.

## Produto
- **PWA do entregador:** jornada, odômetro, paradas, eventos de entrega, ocorrências, abastecimento e manutenção.
- **Painel administrativo:** cadastros, visão operacional, relatórios, métricas por entregador/veículo/bairro, combustível e manutenção.
- **Backend do MVP:** Supabase Auth + PostgreSQL/RLS e Realtime; o esquema e a base de autenticação já estão no repositório.
- **Atualizações:** jornadas e entregas são gravadas no Supabase quando há conexão; fila offline durável ainda não foi implementada.

## Escopo funcional
- Jornada vinculada a entregador e veículo.
- Entregas com número de ordem, bairro, endereço, prioridade e localização/link de mapa.
- Linha do tempo com saída, chegada, conclusão e ocorrência.
- Relatórios de volume por bairro e período, tempo de deslocamento, tempo no endereço, km por jornada, custo/km e custo/entrega.
- Abastecimentos e manutenção por veículo.
- Navegação externa e futura integração com geocodificação/otimização de rotas.

## Estado atual
O repositório contém uma aplicação PWA baseada em HTML/CSS/JavaScript, Worker do Cloudflare e integração parcial com Supabase. A publicação do frontend não garante que o banco esteja migrado nem que todos os módulos estejam prontos para produção.

**Estado desta etapa:** jornadas e entregas foram migradas para leitura e gravação no Supabase, usando a sessão autenticada e as políticas RLS. Combustível e manutenção continuam em armazenamento local e não sincronizam. Antes de operar em um banco existente, aplique no SQL Editor do Supabase as migrações `20261020_operations_hardening.sql`, `20261020_one_open_journey_per_vehicle.sql`, `20261020_journey_gps_timeline.sql`, `20261020_journey_order_numbers.sql` e `20261020_delivery_order_numbers.sql`, caso ainda não tenham sido executadas. Para habilitar rotas preparadas pelo administrador/gerente em um banco que ainda não possui esse recurso, aplique também `supabase/route-plans-migration.sql`. O arquivo `supabase/schema.sql` já inclui as tabelas e políticas de rotas para projetos novos. Cadastre os perfis de entregadores vinculados a `drivers.profile_id`, os veículos e teste permissões com contas separadas. Commits no GitHub não executam migrações SQL. O acesso de administração, vendas e entregadores utiliza a tela principal de login com sessão Supabase. A rota antiga `/entregador` redireciona para `/`; o PWA do entregador é carregado após a autenticação do perfil `driver`. Para pedidos comerciais, aplique também as migrações `20261022_delivery_catalog.sql`, `20261022_sales_role.sql`, `20261022_sales_delivery_policies.sql`, `20261022_sales_catalog_isolation.sql` e `20261022_align_delivery_catalog.sql` para alinhar bancos existentes, nesta ordem. Por fim, aplique `20261022_atomic_operations.sql` para tornar transacionais as alterações de status com eventos e a abertura de jornadas com paradas. O código atual chama essas funções RPC; aplique essa migração antes de usar esses fluxos. Essas migrações não são executadas automaticamente pelo deploy do frontend.

## Documentação
Consulte [docs/ARQUITETURA-MVP.md](docs/ARQUITETURA-MVP.md) para arquitetura, papéis, indicadores, modelo de dados, segurança e sequência de implementação.

## Acesso ao sistema publicado

**Link do YUP-ENTREGAS:** https://yup-entregas.jordano-19-silva.workers.dev

> O endereço foi informado como URL de publicação do Cloudflare Workers. A publicação do site não significa que a integração dos formulários com PostgreSQL/Supabase esteja concluída. Até finalizar essa integração e os testes de segurança, utilize apenas dados fictícios.

## Publicar e acessar pela internet
Endereço informado da publicação: https://yup-entregas.jordano-19-silva.workers.dev. Para configurar o banco e a autenticação, siga [docs/CONFIGURAR-SUPABASE.md](docs/CONFIGURAR-SUPABASE.md). A publicação do frontend, por si só, não habilita a sincronização de dados.

## Verificação e publicação contínua
O GitHub Actions valida a sintaxe JavaScript, os manifestos PWA/Wrangler, os arquivos locais referenciados pelo HTML e a configuração de assets antes de publicar. A implantação exige os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` em **Settings → Secrets and variables → Actions**. Sem esses secrets, a etapa de deploy falha explicitamente em vez de marcar a publicação como bem-sucedida.

Para testar localmente, sirva os arquivos por HTTP/HTTPS (por exemplo, localhost); abrir `index.html` via `file://` não testa corretamente autenticação, rotas do Worker ou service worker.

## Limitações conhecidas antes de produção
- O endereço legado `/entregador` redireciona ao login principal; não há autenticação separada por código.
- Combustível e manutenção ainda usam armazenamento local, sem sincronização entre dispositivos.
- A fila offline durável não está implementada; não conte com gravação offline.
- O rastreamento GPS depende das permissões e das regras do navegador; não há garantia de captura em segundo plano.
- Os fluxos e relatórios precisam ser testados após a aplicação das migrações no Supabase.

## Próximas etapas
1. Aplicar e validar as migrações do Supabase.
2. Testar contas administrativas e de entregadores, jornadas, veículos e numeração automática.
3. Validar o fluxo integrado de login e as permissões de cada perfil.
4. Migrar combustível/manutenção para o banco e implementar fila offline idempotente.
5. Executar testes funcionais, de segurança, backup e recuperação antes de usar dados reais.

## Privacidade
Não use dados reais de clientes neste protótipo. O armazenamento local não é adequado como banco oficial de produção.
