# YUP-ENTREGAS

Sistema centralizado de gestão de entregas e monitoramento da frota da YUP Store, com foco inicial em Santarém–PA.

## Produto
- **PWA do entregador:** jornada, odômetro, paradas, eventos de entrega, ocorrências, abastecimento e manutenção.
- **Painel administrativo:** cadastros, visão operacional, relatórios, métricas por entregador/veículo/bairro, combustível e manutenção.
- **Backend central:** API autenticada, PostgreSQL, trilha de auditoria e sincronização entre dispositivos.
- **Atualizações:** eventos enviados ao servidor aparecem no painel automaticamente; offline, o PWA mantém fila pendente e sincroniza ao recuperar conexão.

## Escopo funcional
- Jornada vinculada a entregador e veículo.
- Entregas com número de ordem, bairro, endereço, prioridade e localização/link de mapa.
- Linha do tempo com saída, chegada, conclusão e ocorrência.
- Relatórios de volume por bairro e período, tempo de deslocamento, tempo no endereço, km por jornada, custo/km e custo/entrega.
- Abastecimentos e manutenção por veículo.
- Navegação externa e futura integração com geocodificação/otimização de rotas.

## Estado atual
O repositório contém um **protótipo frontend inicial**. Atualmente, ele salva dados no `localStorage` do navegador. **Ainda não possui backend, autenticação real, sincronização multiusuário, painel conectado ao vivo nem otimização automática de rotas.** Não usar como sistema oficial da frota até implementar e testar esses componentes.

## Documentação
Consulte [docs/ARQUITETURA-MVP.md](docs/ARQUITETURA-MVP.md) para arquitetura, papéis, indicadores, modelo de dados, segurança e sequência de implementação.

## Executar protótipo
Abra `index.html` em um navegador ou publique os arquivos em hospedagem estática. Para testar PWA/service worker, use HTTPS ou localhost.

## Próximas etapas
1. Backend/API e PostgreSQL.
2. Autenticação segura e permissões para entregadores e administração.
3. Sincronização idempotente e trilha de auditoria.
4. Painel administrativo e indicadores.
5. Geocodificação, matriz de distâncias e otimização de rotas.
6. Testes, segurança, backups, implantação e monitoramento.

## Privacidade
Não use dados reais de clientes neste protótipo. O armazenamento local não é adequado como banco oficial de produção.
