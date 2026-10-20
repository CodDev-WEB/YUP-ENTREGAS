# Arquitetura funcional — YUP-ENTREGAS

## Objetivo
Sistema centralizado de gestão de entregas e frota da YUP Store, inicialmente para Santarém–PA. O produto terá duas áreas autenticadas: PWA do entregador e painel administrativo web.

## Armazenamento definido para o MVP
O backend escolhido é Supabase: PostgreSQL como banco central, Supabase Auth para autenticação, RLS para autorização por perfil e Realtime para atualizações operacionais. O esquema inicial está em `supabase/schema.sql`. O projeto Supabase real ainda precisa ser configurado e os formulários do frontend migrados de `localStorage`; não considerar sincronização ativa até validar leitura e gravação entre dispositivos.

## Regra central
O servidor é a fonte oficial dos dados. O navegador pode manter uma fila temporária de eventos offline, mas não é o banco oficial. Todo evento sincronizado deve ter identificador único, usuário/veículo/jornada relacionados, horário do dispositivo, horário de recebimento do servidor e estado de sincronização.

## Perfis e permissões
- Administrador: cadastro e bloqueio de entregadores, veículos, bairros, manutenção, abastecimento, relatórios e configurações.
- Entregador: visualizar sua própria jornada e entregas atribuídas, registrar eventos, ocorrências e odômetros.
- Gestor/consulta (opcional): visualizar painéis e relatórios sem alterar cadastros sensíveis.

## Área do entregador
1. Login por credencial individual segura (não usar somente número de cadastro como autenticação).
2. Selecionar veículo autorizado e iniciar jornada com odômetro inicial.
3. Adicionar entrega por número de ordem, bairro, endereço, referência e link/localização compartilhada.
4. Registrar saída, chegada, conclusão ou insucesso por parada.
5. Adicionar paradas adicionais e reordenar a sequência.
6. Encerrar jornada com odômetro final e observação.
7. Ver estado da sincronização e tentar reenviar eventos pendentes.
8. Abrir navegação externa no provedor de mapas.

## Painel administrativo
- Visão ao vivo: jornadas abertas, entregadores ativos, entregas pendentes/em deslocamento/concluídas, atrasos e ocorrências.
- Cadastros: entregadores, veículos, bairros, tipos de manutenção e permissões.
- Mapa operacional: posições somente quando compartilhadas pelo entregador com permissão e dentro das regras de privacidade; não prometer rastreamento contínuo em segundo plano sem validar suporte do aparelho/PWA.
- Relatórios: por período, entregador, veículo, bairro e resultado.
- Indicadores: tempo entre saída e chegada, tempo no endereço, duração total, entregas/hora, km por jornada, km/entrega, custo/km e custo/entrega.
- Calor de demanda: contagem de entregas por bairro e período; mapa geográfico exige geocodificação confiável dos endereços.
- Frota: abastecimentos, consumo estimado km/L quando há leituras comparáveis, preço médio/litro, custo de combustível, manutenção e custo por veículo.

## Sincronização e tempo real
- PWA usa o cliente Supabase autenticado via HTTPS; PostgreSQL com RLS é a barreira de autorização para as tabelas expostas.
- Triggers do banco registram horários oficiais de recebimento/encerramento. Validação completa de transições, consistência de eventos e odômetros via RPC/funções transacionais ainda precisa ser concluída antes da produção.
- PostgreSQL mantém os registros oficiais e a trilha de auditoria planejada.
- O adaptador assina mudanças de jornadas, entregas e eventos via Supabase Realtime; falta conectar os formulários e a renderização do painel a essas consultas para sincronização operacional ponta a ponta.
- Offline: fila local idempotente; cada evento tem UUID e é deduplicado no servidor. Mostrar claramente pendente/sincronizado/falhou.
- Horário: guardar occurred_at do dispositivo e received_at do servidor em UTC; exibir em America/Santarem. O servidor é referência para recebimento; horário do aparelho não deve ser tratado como infalível.
- Conflitos e correções não apagam histórico; registrar quem corrigiu, quando e motivo.

## Modelo de dados inicial
- users: identidade, credencial, perfil, status.
- drivers: vínculo de usuário, número de cadastro, nome e status.
- vehicles: identificador interno, placa/código, tipo, status.
- neighborhoods: nome normalizado, município/UF, ativo.
- journeys: entregador, veículo, odômetro inicial/final, início/fim, status.
- deliveries: ordem, endereço, bairro, coordenadas quando disponíveis, prioridade, status e resultado.
- delivery_events: saída, chegada, conclusão, insucesso, ocorrência, timestamps e autor.
- fuel_entries: veículo, jornada opcional, odômetro, litros, custo, posto, data e comprovante opcional.
- maintenance_entries: veículo, categoria, odômetro, custo, fornecedor, data e próxima manutenção opcional.
- audit_log: ator, ação, entidade, data, motivo e metadados seguros.

## Regras de cálculo
- Distância da jornada = odômetro final − odômetro inicial; rejeitar odômetro final menor que o inicial.
- Tempo de deslocamento por entrega = chegada − saída, quando ambos existirem.
- Tempo no endereço = conclusão − chegada, quando ambos existirem.
- Consumo km/L exige odômetros de abastecimentos sequenciais comparáveis para o mesmo veículo; abastecimentos parciais podem distorcer a estimativa e devem ser identificados.
- Custo por entrega deve declarar quais custos entram no cálculo e o período utilizado.
- Calor por bairro é volume de entregas agregadas, não prova de trânsito ou demanda futura.

## Rotas e mapas
O MVP pode abrir o Google Maps com paradas informadas. Otimização real exige coordenadas/geocodificação, serviço de rotas/matriz de distâncias e política para trânsito, prioridades e horários. Não calcular a “melhor rota” somente pela ordem alfabética dos bairros. Provedor e custos devem ser escolhidos antes da integração.

## Segurança e privacidade
- HTTPS obrigatório em produção; segredos apenas no servidor.
- Senhas armazenadas com hash forte; sessões seguras e controle de acesso por função.
- Validar todos os dados no servidor, limitar tentativas e registrar ações administrativas.
- Minimizar dados pessoais de clientes; restringir endereços e relatórios a quem precisa deles.
- Definir retenção, backups, restauração e política de incidentes.
- Não utilizar dados reais no protótipo local.

## Entregas técnicas sugeridas
1. Aprovar arquitetura e regras de negócio.
2. Backend/API + PostgreSQL + migrações.
3. Autenticação, usuários, veículos, bairros e permissões.
4. Sincronização dos eventos de jornada/entrega e painel ao vivo.
5. Abastecimento, manutenção e relatórios.
6. Integração de geocodificação e rotas.
7. Testes, segurança, implantação e monitoramento.

## Estado da implementação e limites
O repositório agora inclui esquema Supabase/PostgreSQL com RLS, autenticação por e-mail/senha no adaptador do navegador, perfis admin/manager/driver e assinaturas Realtime para jornadas, entregas e eventos. A tela de acesso aplica restrições de navegação por perfil.

Os formulários operacionais ainda usam localStorage e não enviam dados para o banco; a sincronização em tempo real está preparada no adaptador, mas ainda não foi ligada às telas. A fila offline idempotente, validação de transições no servidor e testes de ponta a ponta permanecem pendentes. Não usar dados reais até completar e validar essas etapas.
