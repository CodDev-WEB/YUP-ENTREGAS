-- Permite ao entregador atribuir um pedido pendente sem jornada à sua jornada aberta.
-- A política existente de UPDATE só permite linhas que já tenham jornada acessível,
-- então o entregador não consegue mover um pedido do catálogo para a jornada.
begin;

drop policy if exists deliveries_driver_assign_pending on public.deliveries;

create policy deliveries_driver_assign_pending
on public.deliveries
for update
to authenticated
using (
  public.is_active_user()
  and public.current_app_role()::text = 'driver'
  and journey_id is null
  and status = 'pending'
)
with check (
  public.is_active_user()
  and public.current_app_role()::text = 'driver'
  and journey_id is not null
  and public.can_access_journey(journey_id)
  and status = 'pending'
);

notify pgrst, 'reload schema';
commit;
