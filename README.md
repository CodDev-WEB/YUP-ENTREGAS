# YUP-ENTREGAS

Sistema centralizado de gestão de entregas e monitoramento da frota da YUP Store, com foco inicial em Santarém–PA.

## Produto
- **PWA do entregador:** jornada, odômetro, paradas, eventos de entrega, ocorrências, abastecimento e manutenção.
- **Painel administrativo:** cadastros, visão operacional, relatórios, métricas por entregador/veículo/bairro, combustível e manutenção.
- **Backend central:** Supabase Auth + PostgreSQL/RLS e Realtime; integração operacional dos formulários ainda pendente.
- **Atualizações:** eventos enviados ao servidor aparecem no painel automaticamente; offline, o PWA mantém fila pendente e sincroniza ao recuperar conexão.

## Escopo funcional
- Jornada vinculada a entregador e veículo.
- Entregas com número de ordem, bairro, endereço, prioridade e localização/link de mapa.
- Linha do tempo com saída, chegada, conclusão e ocorrência.
- Relatórios de volume por bairro e período, tempo de deslocamento, tempo no endereço, km por jornada, custo/km e custo/entrega.
- Abastecimentos e manutenção por veículo.
- Navegação externa e futura integração com geocodificação/otimização de rotas.

## Estado atual
O repositório contém o protótipo frontend inicial e a fundação técnica de integração com Supabase: esquema PostgreSQL, políticas RLS, modelo de configuração, adaptador de autenticação e assinatura Realtime. A tela de login exige conta Supabase e aplica visibilidade básica por perfil.

**Ainda não está pronto para operação real:** os formulários de jornada, entrega, combustível e manutenção continuam salvando no localStorage; ainda não gravam no PostgreSQL nem sincronizam entre dispositivos. O login e as policies do banco são a fundação, não uma implantação validada. Não registrar dados reais até migrar os formulários e concluir os testes de segurança.

## Documentação
Consulte [docs/ARQUITETURA-MVP.md](docs/ARQUITETURA-MVP.md) para arquitetura, papéis, indicadores, modelo de dados, segurança e sequência de implementação.

## Publicar e acessar pela internet
Consulte [docs/PUBLICAR-CLOUDFLARE-PAGES.md](docs/PUBLICAR-CLOUDFLARE-PAGES.md) para publicar gratuitamente via Cloudflare Pages conectado ao GitHub. O endereço público ainda precisa ser criado no painel do Cloudflare; após o primeiro deploy, copie a URL gerada para esta seção. A publicação do frontend, por si só, não habilita a integração operacional com o Supabase.

## Executar protótipo
Abra `index.html` em um navegador ou publique os arquivos em hospedagem estática. Para testar PWA/service worker, use HTTPS ou localhost.

## Próximas etapas
1. Criar o projeto Supabase e executar [supabase/schema.sql](supabase/schema.sql) seguindo [docs/CONFIGURAR-SUPABASE.md](docs/CONFIGURAR-SUPABASE.md).
2. Configurar contas de administração/entregadores e testar RLS com perfis distintos.
3. Migrar os formulários de localStorage para PostgreSQL com eventos idempotentes e fila offline.
4. Conectar o painel administrativo ao Realtime e implementar relatórios.
5. Geocodificação, matriz de distâncias e otimização de rotas.
6. Testes de segurança, backups, implantação e monitoramento.

## Privacidade
Não use dados reais de clientes neste protótipo. O armazenamento local não é adequado como banco oficial de produção.
