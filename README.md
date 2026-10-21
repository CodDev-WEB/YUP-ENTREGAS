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

**Estado desta etapa:** jornadas e entregas foram migradas para leitura e gravação no Supabase, usando a sessão autenticada e as políticas RLS. Combustível e manutenção continuam em armazenamento local e não sincronizam. Antes de operar, aplique no SQL Editor do Supabase as migrações `20261020_operations_hardening.sql`, `20261020_one_open_journey_per_vehicle.sql`, `20261020_journey_gps_timeline.sql`, `20261020_journey_order_numbers.sql` e `20261020_delivery_order_numbers.sql`, caso ainda não tenham sido executadas. Cadastre os perfis de entregadores vinculados a `drivers.profile_id`, os veículos e teste permissões com contas separadas. Commits no GitHub não executam migrações SQL. O portal por código ainda não autentica entregadores; eles precisam usar a sessão Supabase no painel até essa etapa ser implementada.

## Documentação
Consulte [docs/ARQUITETURA-MVP.md](docs/ARQUITETURA-MVP.md) para arquitetura, papéis, indicadores, modelo de dados, segurança e sequência de implementação.

## Acesso ao sistema publicado

**Link do YUP-ENTREGAS:** https://yup-entregas.jordano-19-silva.workers.dev

> O endereço foi informado como URL de publicação do Cloudflare Workers. A publicação do site não significa que a integração dos formulários com PostgreSQL/Supabase esteja concluída. Até finalizar essa integração e os testes de segurança, utilize apenas dados fictícios.

## Publicar e acessar pela internet
Endereço informado da publicação: https://yup-entregas.jordano-19-silva.workers.dev. Para configurar o banco e a autenticação, siga [docs/CONFIGURAR-SUPABASE.md](docs/CONFIGURAR-SUPABASE.md). A publicação do frontend, por si só, não habilita a sincronização de dados.

## Executar protótipo
Abra `index.html` em um navegador ou publique os arquivos em hospedagem estática. Para testar PWA/service worker, use HTTPS ou localhost.

## Limitações conhecidas antes de produção
- O portal por código em `/entregador` é apenas visual e não autentica usuários.
- Combustível e manutenção ainda usam armazenamento local, sem sincronização entre dispositivos.
- A fila offline durável não está implementada; não conte com gravação offline.
- O rastreamento GPS depende das permissões e das regras do navegador; não há garantia de captura em segundo plano.
- Os fluxos e relatórios precisam ser testados após a aplicação das migrações no Supabase.

## Próximas etapas
1. Aplicar e validar as migrações do Supabase.
2. Testar contas administrativas e de entregadores, jornadas, veículos e numeração automática.
3. Implementar autenticação segura do portal do entregador.
4. Migrar combustível/manutenção para o banco e implementar fila offline idempotente.
5. Executar testes funcionais, de segurança, backup e recuperação antes de usar dados reais.

## Privacidade
Não use dados reais de clientes neste protótipo. O armazenamento local não é adequado como banco oficial de produção.
