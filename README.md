# YUP-ENTREGAS

Sistema de gestão de entregas e monitoramento da frota da YUP Store, com foco inicial em Santarém–PA.

## Escopo do MVP
- PWA responsivo para operação do entregador.
- Jornada com veículo e odômetro inicial/final.
- Cadastro de entregas por ordem, bairro e endereço.
- Registro de saída, chegada e conclusão de cada parada.
- Abertura de navegação no Google Maps.
- Lançamento de abastecimentos e manutenções.
- Painel de resumo operacional.

## Estado atual
Esta primeira entrega é um protótipo frontend com armazenamento local no dispositivo. **Ainda não é um sistema multiusuário**, não sincroniza dados entre dispositivos e não deve ser usado como fonte oficial de auditoria até que sejam implementados backend, autenticação, banco de dados e controle de acesso.

## Executar
Abra `index.html` em um navegador ou publique os arquivos em uma hospedagem estática. Para testar instalação PWA/service worker, use HTTPS ou localhost.

## Próximas etapas
1. Backend e banco de dados PostgreSQL.
2. Autenticação segura de entregadores e administradores.
3. Sincronização multiusuário e trilha de auditoria no servidor.
4. Geocodificação e otimização de rotas com provedor de mapas configurável.
5. Relatórios de combustível, custo/km e manutenção.
6. Testes, segurança, implantação e monitoramento.

## Privacidade
Não use dados reais de clientes neste protótipo. O armazenamento local não é protegido como um banco de dados de produção.
