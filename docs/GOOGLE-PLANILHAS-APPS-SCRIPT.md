# Google Planilhas + Apps Script — YUP-ENTREGAS

Este é o backend inicial para centralizar os dados do YUP-ENTREGAS sem Supabase. O site hospedado em Cloudflare Workers continuará sendo o frontend; o Google Apps Script servirá como API e o Google Planilhas como armazenamento central.

## Estado e limites

- O código foi preparado, mas ainda **não está implantado nem conectado ao site**.
- As operações de jornada, entrega, combustível e manutenção do frontend ainda usam `localStorage`.
- Não utilize dados reais até concluir a configuração e os testes.
- O Apps Script/Planilhas é adequado para um MVP pequeno com dois entregadores, mas tem cotas e não equivale a um banco transacional de produção.
- O backend implementa login com e-mail/senha, tokens temporários, perfis e permissões básicas. Faça uma revisão de segurança e testes antes do uso real.

## 1. Criar a planilha

1. Crie uma planilha Google vazia com uma conta controlada pela empresa.
2. Copie o ID da URL: o trecho entre `/d/` e `/edit`.
3. Mantenha a planilha privada; não compartilhe a planilha publicamente.
4. Acesse [Google Apps Script](https://script.google.com/) e crie um projeto novo.

## 2. Copiar o backend

Copie o conteúdo de [`google-apps-script/Code.gs`](../google-apps-script/Code.gs) para o arquivo `Code.gs` do projeto Apps Script.

No Apps Script, abra **Project Settings / Configurações do projeto → Script Properties / Propriedades do script** e adicione:

| Propriedade | Valor |
| --- | --- |
| `SPREADSHEET_ID` | ID da planilha criada |
| `ADMIN_EMAIL` | e-mail do administrador |
| `ADMIN_PASSWORD` | senha temporária forte (mínimo 12 caracteres) |

Execute manualmente `setupYupDatabase` no editor e autorize as permissões solicitadas. A função cria as abas necessárias e a conta inicial. Depois da execução, a propriedade `ADMIN_PASSWORD` é removida pelo script. Verifique se a aba `Users` contém a conta criada.

## 3. Criar contas dos dois entregadores

1. Nas Script Properties, configure `NEW_USER_EMAIL`, `NEW_USER_PASSWORD` (mínimo 12 caracteres), `NEW_USER_NAME`, `NEW_USER_ROLE=driver` e `NEW_USER_DRIVER_ID`.
2. Use identificadores diferentes para os entregadores (por exemplo, `YUP-001` e `YUP-002`).
3. Execute `createConfiguredUser` manualmente. O script remove a propriedade da senha após a criação.
4. Repita para a segunda conta, trocando as propriedades. Não grave senhas no código ou no repositório.

O perfil `admin` administra o sistema; `manager` visualiza operações; `driver` é para o entregador. A associação entre entregador e registros será completada na integração do frontend.

## 4. Publicar como API

1. No Apps Script, selecione **Deploy / Implantar → New deployment / Nova implantação**.
2. Escolha **Web app / Aplicativo da web**.
3. Execute como: **Me / Eu (proprietário do script)**.
4. Acesso: para este MVP, a API precisa estar acessível ao site publicado. Selecione a opção de acesso disponível na sua conta que permita chamadas externas e proteja cada operação por autenticação/token. Em contas Google Workspace, prefira restringir ao domínio quando aplicável; teste o acesso externo antes de integrar.
5. Clique em Implantar, autorize e copie a URL terminada em `/exec`. Guarde-a para a etapa seguinte.

**Atenção:** uma Web App acessível publicamente pode receber chamadas de qualquer pessoa na internet. Não compartilhe a planilha, não coloque senhas de usuário no frontend e não considere o token temporário substituto para uma auditoria de segurança. A API usa POST com corpo JSON; a integração do navegador deverá testar CORS/redirects do Apps Script. Se o navegador bloquear a chamada, será necessário ajustar a camada de comunicação antes de usar o sistema.

## 5. API disponível

As ações POST implementadas são:

- `login`: autenticar e obter token temporário.
- `list`: listar registros de `Journeys`, `Deliveries`, `Fuel`, `Maintenance` ou `DeliveryEvents`.
- `insert`: criar um registro.
- `update`: atualizar um registro existente.
- `logout`: invalidar o token da sessão.

O corpo da chamada contém `action`; operações autenticadas também precisam de `token`. Para `list`, `insert` e `update`, informe `collection`; criação/atualização também recebem `record`, e atualização exige `id`.

## Próxima etapa

Depois de implantar, informe a URL `/exec` gerada pelo Apps Script. Então o frontend poderá ser conectado à API e testado com dados fictícios, substituindo gradualmente o `localStorage`. A URL do Worker continua sendo o endereço do site.
