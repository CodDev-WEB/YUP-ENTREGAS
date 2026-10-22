-- Habilita o perfil de vendedora para autenticação separada.
-- Execute esta migração antes de criar/atribuir usuários com role='sales'.
alter type public.app_role add value if not exists 'sales';
