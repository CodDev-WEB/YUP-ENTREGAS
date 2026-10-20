# Publicar o YUP-ENTREGAS gratuitamente

**URL informada como publicada:** https://yup-entregas.jordano-19-silva.workers.dev

O endereço acima usa o domínio `workers.dev` (Cloudflare Workers). O guia abaixo descreve uma alternativa de publicação por Cloudflare Pages; ela não é necessária se o Worker atual já estiver funcionando e for o método de implantação escolhido.

Este projeto é um site estático (HTML, CSS e JavaScript), então pode ser publicado no **Cloudflare Pages** com integração ao GitHub. A cada envio de alterações para a branch `main`, o Cloudflare poderá publicar a versão atual automaticamente.

> **Importante:** o endereço público só será criado depois que alguém com acesso à conta conectar o repositório ao Cloudflare e concluir o primeiro deploy. Não invente nem divulgue um endereço antes de ele aparecer no painel.

## 1. Criar o site

1. Acesse o [painel do Cloudflare](https://dash.cloudflare.com/) e entre ou crie uma conta gratuita.
2. Abra **Workers & Pages**.
3. Selecione **Create application** e escolha **Pages** / **Connect to Git**.
4. Conecte sua conta GitHub e autorize o acesso ao repositório `CodDev-WEB/YUP-ENTREGAS`.
5. Selecione esse repositório e clique em **Begin setup**.

## 2. Configuração do deploy

Use estas configurações iniciais:

| Campo | Valor |
| --- | --- |
| Nome do projeto | `yup-entregas` (se estiver disponível) |
| Branch de produção | `main` |
| Framework preset | `None` / sem framework |
| Build command | deixe vazio; se o painel exigir um comando, use `exit 0` |
| Build output directory | `.` (raiz do repositório, onde está o `index.html`) |
| Root directory | deixe o padrão, raiz do repositório |

Depois clique em **Save and Deploy**. Aguarde o primeiro deploy terminar e abra a URL `*.pages.dev` que o painel mostrar. Se o Cloudflare rejeitar a pasta de saída `.`, confira as opções atuais de configuração do painel e selecione a raiz do repositório como diretório de saída.

## 3. Colocar a URL no GitHub

1. Copie a URL exata exibida no painel do Cloudflare após o deploy.
2. Edite o `README.md` do repositório.
3. Na seção **Acesso ao sistema**, adicione, por exemplo: `[Abrir YUP-ENTREGAS](https://URL-REAL-FORNECIDA-PELO-CLOUDFLARE)`, substituindo pelo endereço real.

A URL final depende da disponibilidade do nome do projeto e só pode ser confirmada depois da publicação.

## 4. Antes de usar com a equipe

A publicação disponibiliza os arquivos no navegador; **não significa que o sistema esteja pronto para operação real**. Antes de usar com entregadores ou clientes:

- Configure o projeto Supabase e substitua os placeholders em `supabase-config.js` pela URL e chave pública apropriadas.
- Execute e valide `supabase/schema.sql` e as políticas RLS.
- Migre os formulários operacionais de `localStorage` para o PostgreSQL e teste a sincronização entre dispositivos.
- Teste autenticação, permissões por perfil, service worker e fluxo offline.
- Nunca coloque a chave `service_role`, senha do banco ou qualquer segredo privado em arquivos públicos do frontend.

Até concluir esses passos, use somente dados fictícios. A URL `pages.dev` é hospedagem do frontend; o banco e a autenticação continuam dependendo da configuração do Supabase.

## Referência oficial

- [Cloudflare Pages: integração com Git](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages: site HTML estático](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)
