# YUP-ENTREGAS

Sistema centralizado de gestão de entregas e monitoramento da frota da YUP Store, com foco inicial em Santarém–PA.

## Produto
- **PWA do entregador:** jornada, odômetro, paradas, eventos de entrega, ocorrências, abastecimento e manutenção.
- **Painel administrativo:** cadastros, visão operacional, relatórios, métricas por entregador/veículo/bairro, combustível e manutenção.
- **Backend do MVP:** Supabase Auth + PostgreSQL/RLS e Realtime; o esquema e a base de autenticação já estão no repositório.
- **Atualizações:** eventos enviados ao servidor aparecem no painel automaticamente; offline, o PWA mantém fila pendente e sincroniza ao recuperar conexão.

## Escopo funcional
- Jornada vinculada a entregador e veículo.
- Entregas com número de ordem, bairro, endereço, prioridade e localização/link de mapa.
- Linha do tempo com saída, chegada, conclusão e ocorrência.
- Relatórios de volume por bairro e período, tempo de deslocamento, tempo no endereço, km por jornada, custo/km e custo/entrega.
- Abastecimentos e manutenção por veículo.
- Navegação externa e futura integração com geocodificação/otimização de rotas.

## Estado atual
O repositório contém o protótipo frontend e a fundação de integração com Supabase: esquema PostgreSQL, políticas RLS, configuração pública de cliente, autenticação e assinatura Realtime. Ainda é necessário configurar o projeto Supabase real e migrar os formulários operacionais.

**Estado desta etapa:** jornadas e entregas foram migradas para leitura e gravação no Supabase, usando a sessão autenticada e as políticas RLS. Combustível e manutenção continuam em armazenamento local e não sincronizam. Antes de operar, aplique `supabase/migrations/20261020_operations_hardening.sql`, cadastre os perfis de entregadores vinculados a `drivers.profile_id` e os veículos, teste as contas separadamente e confirme os registros no banco. O portal por código ainda não autentica entregadores; eles precisam usar a sessão Supabase no painel até essa etapa ser implementada.

## Documentação
Consulte [docs/ARQUITETURA-MVP.md](docs/ARQUITETURA-MVP.md) para arquitetura, papéis, indicadores, modelo de dados, segurança e sequência de implementação.

## Acesso ao sistema publicado

**Link do YUP-ENTREGAS:** https://yup-entregas.jordano-19-silva.workers.dev

> O endereço foi informado como URL de publicação do Cloudflare Workers. A publicação do site não significa que a integração dos formulários com PostgreSQL/Supabase esteja concluída. Até finalizar essa integração e os testes de segurança, utilize apenas dados fictícios.

## Publicar e acessar pela internet
Endereço informado da publicação: https://yup-entregas.jordano-19-silva.workers.dev. Para configurar o banco e a autenticação, siga [docs/CONFIGURAR-SUPABASE.md](docs/CONFIGURAR-SUPABASE.md). A publicação do frontend, por si só, não habilita a sincronização de dados.

## Executar protótipo
Abra `index.html` em um navegador ou publique os arquivos em hospedagem estática. Para testar PWA/service worker, use HTTPS ou localhost.

## Próximas etapas
1. Criar o projeto Supabase e executar [supabase/schema.sql](supabase/schema.sql) seguindo [docs/CONFIGURAR-SUPABASE.md](docs/CONFIGURAR-SUPABASE.md).
2. Criar as contas do administrador e dos dois entregadores e validar as políticas RLS.
3. Migrar os formulários de `localStorage` para PostgreSQL.
4. Conectar o painel ao Realtime e testar sincronização entre os dispositivos.
7. Implementar fila offline idempotente e relatórios consolidados.
8. Concluir testes de segurança, backups, implantação e monitoramento.

## Privacidade
Não use dados reais de clientes neste protótipo. O armazenamento local não é adequado como banco oficial de produção.
