# Configuração do Supabase — YUP-ENTREGAS

## Objetivo
Criar o banco PostgreSQL central, autenticação por e-mail/senha, papéis e políticas RLS para separar administração, gestão e entregadores. Realtime cobre jornadas, entregas e eventos. O frontend atual continua como protótipo local até que os formulários sejam migrados; não use os dados do navegador como registros oficiais.

## 1. Criar projeto gratuito
1. Crie um projeto em https://supabase.com e escolha a região mais próxima disponível.
2. O plano gratuito tem limites e pode pausar projetos inativos; confirme os limites atuais antes de usar em operação.
3. Em Project Settings > API, copie Project URL e chave pública anon/publishable. Não copie service_role.
4. Edite supabase-config.js no repositório com a Project URL e a chave pública anon/publishable. Esses valores são destinados ao navegador e podem estar no código público; a segurança depende de Auth e RLS. Nunca inclua service_role.

## 2. Aplicar o banco
1. Abra SQL Editor no Supabase.
2. Cole e execute supabase/schema.sql.
3. Confirme as tabelas e políticas RLS.
4. Em Authentication > Providers, habilite e-mail/senha. Se a empresa controlar os acessos, desabilite cadastro público e crie usuários pela administração.

## 3. Criar o primeiro administrador
1. Em Authentication > Users, crie o usuário administrativo.
2. Copie seu UUID e execute no SQL Editor, substituindo o valor:
   update public.profiles set role = 'admin' where id = 'UUID-DO-ADMIN';
3. Crie usuários de entregadores e vincule seus perfis em public.drivers.profile_id.
4. Novos perfis começam como driver. Nunca permita que o usuário escolha ou altere o próprio papel.

## 4. Configuração e segurança
- supabase-config.js contém apenas URL e chave pública anon/publishable, que são destinadas ao cliente. O projeto deve ter RLS em todas as tabelas expostas.
- supabase-client.js oferece conexão, login, leitura do perfil, logout e assinatura Realtime.
- O SDK é carregado por CDN e requer conexão no primeiro carregamento.
- Antes da produção, teste as políticas com contas separadas de admin, manager e driver.
- RLS é a barreira real de autorização; esconder botões na interface não substitui políticas no banco.

## 5. Publicação gratuita
O código fica no GitHub. A configuração pública do Supabase também precisa estar presente no deploy. Para servir a interface, escolha hospedagem estática gratuita compatível com o uso pretendido e configure HTTPS. Não presuma que GitHub Pages é apropriado para um serviço comercial/SaaS. Não publique dados operacionais no repositório.

## Próxima etapa
Migrar os formulários de jornada, entrega, combustível e manutenção de localStorage para PostgreSQL; associar as jornadas ao usuário autenticado; implementar fila offline idempotente; testar sincronização entre dois navegadores e completar o painel ao vivo. Até isso ser concluído, o aplicativo não está pronto para dados reais.
