# YUP-ENTREGAS

Sistema centralizado de gestão de entregas e monitoramento da frota da YUP Store, com foco inicial em Santarém–PA.

## Produto
- **PWA do entregador:** jornada, odômetro, paradas, eventos de entrega, ocorrências, abastecimento e manutenção.
- **Painel administrativo:** cadastros, visão operacional, relatórios, métricas por entregador/veículo/bairro, combustível e manutenção.
- **Backend planejado para o MVP:** Google Planilhas + Google Apps Script, sem Supabase; API inicial já adicionada ao repositório, ainda precisa ser implantada e conectada ao frontend.
- **Atualizações:** eventos enviados ao servidor aparecem no painel automaticamente; offline, o PWA mantém fila pendente e sincroniza ao recuperar conexão.

## Escopo funcional
- Jornada vinculada a entregador e veículo.
- Entregas com número de ordem, bairro, endereço, prioridade e localização/link de mapa.
- Linha do tempo com saída, chegada, conclusão e ocorrência.
- Relatórios de volume por bairro e período, tempo de deslocamento, tempo no endereço, km por jornada, custo/km e custo/entrega.
- Abastecimentos e manutenção por veículo.
- Navegação externa e futura integração com geocodificação/otimização de rotas.

## Estado atual
O repositório contém o protótipo frontend, além de uma API inicial em `google-apps-script/Code.gs` e instruções em `docs/GOOGLE-PLANILHAS-APPS-SCRIPT.md`. O backend ainda não foi implantado e o frontend ainda usa a autenticação/protótipo anterior.

**Ainda não está pronto para operação real:** os formulários de jornada, entrega, combustível e manutenção continuam salvando no `localStorage`; ainda não gravam na planilha nem sincronizam entre dispositivos. É necessário configurar a planilha, implantar a API, conectar o frontend e testar autenticação/permissões. Não registrar dados reais até concluir essas etapas.

## Documentação
Consulte [docs/ARQUITETURA-MVP.md](docs/ARQUITETURA-MVP.md) para arquitetura, papéis, indicadores, modelo de dados, segurança e sequência de implementação.

## Acesso ao sistema publicado

**Link do YUP-ENTREGAS:** https://yup-entregas.jordano-19-silva.workers.dev

> O endereço foi informado como URL de publicação do Cloudflare Workers. A publicação do site não significa que a integração dos formulários com PostgreSQL/Supabase esteja concluída. Até finalizar essa integração e os testes de segurança, utilize apenas dados fictícios.

## Publicar e acessar pela internet
Endereço informado da publicação: https://yup-entregas.jordano-19-silva.workers.dev. Para o backend central com Google Planilhas, consulte [docs/GOOGLE-PLANILHAS-APPS-SCRIPT.md](docs/GOOGLE-PLANILHAS-APPS-SCRIPT.md). A publicação do frontend, por si só, não habilita a sincronização de dados.

## Executar protótipo
Abra `index.html` em um navegador ou publique os arquivos em hospedagem estática. Para testar PWA/service worker, use HTTPS ou localhost.

## Próximas etapas
1. Configurar Google Planilhas e implantar `google-apps-script/Code.gs` seguindo [docs/GOOGLE-PLANILHAS-APPS-SCRIPT.md](docs/GOOGLE-PLANILHAS-APPS-SCRIPT.md).
2. Criar as contas do administrador e dos dois entregadores.
3. Conectar login, formulários e painel à API da planilha, removendo dependência operacional de `localStorage`.
4. Testar isolamento de permissões, duplicidade de eventos, concorrência e recuperação de falhas.
5. Implementar fila offline e relatórios consolidados.
6. Testes de segurança, backups, implantação e monitoramento.

## Privacidade
Não use dados reais de clientes neste protótipo. O armazenamento local não é adequado como banco oficial de produção.
