-- YUP Entregas — migração para rotas preparadas pelo vendedor
-- Execute uma vez no Supabase SQL Editor do projeto existente.

create table if not exists public.route_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assigned_driver_id uuid not null references public.drivers(id),
  status text not null default 'assigned' check (status in ('assigned','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.route_plan_stops (
  id uuid primary key default gen_random_uuid(),
  route_plan_id uuid not null references public.route_plans(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  neighborhood_id uuid references public.neighborhoods(id),
  address text not null,
  reference text,
  map_link text,
  priority text not null default 'normal' check (priority in ('normal','high','scheduled')),
  created_at timestamptz not null default now(),
  unique(route_plan_id, sequence_no)
);

alter table public.journeys
  add column if not exists route_plan_id uuid references public.route_plans(id) on delete set null;

create index if not exists route_plans_driver_status on public.route_plans(assigned_driver_id,status,created_at desc);
create index if not exists route_plan_stops_sequence on public.route_plan_stops(route_plan_id,sequence_no);

alter table public.route_plans enable row level security;
alter table public.route_plan_stops enable row level security;

do $$ begin
  create policy route_plans_read_assigned_or_management on public.route_plans
    for select to authenticated
    using (public.owns_driver(assigned_driver_id) or public.current_app_role() in ('admin','manager'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy route_plans_management_insert on public.route_plans
    for insert to authenticated
    with check (public.current_app_role() in ('admin','manager') and created_by=(select auth.uid()) and public.is_active_user());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy route_plans_management_update on public.route_plans
    for update to authenticated
    using (public.current_app_role() in ('admin','manager'))
    with check (public.current_app_role() in ('admin','manager'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy route_plans_management_delete on public.route_plans
    for delete to authenticated
    using (public.current_app_role() in ('admin','manager'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy route_plan_stops_read_assigned_or_management on public.route_plan_stops
    for select to authenticated
    using (exists (
      select 1 from public.route_plans rp
      where rp.id=route_plan_stops.route_plan_id
        and (public.owns_driver(rp.assigned_driver_id) or public.current_app_role() in ('admin','manager'))
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy route_plan_stops_management_insert on public.route_plan_stops
    for insert to authenticated
    with check (public.current_app_role() in ('admin','manager') and exists (
      select 1 from public.route_plans rp where rp.id=route_plan_stops.route_plan_id
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy route_plan_stops_management_update on public.route_plan_stops
    for update to authenticated
    using (public.current_app_role() in ('admin','manager'))
    with check (public.current_app_role() in ('admin','manager'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy route_plan_stops_management_delete on public.route_plan_stops
    for delete to authenticated
    using (public.current_app_role() in ('admin','manager'));
exception when duplicate_object then null; end $$;

-- Permite ao motorista consultar route_plan_id junto da jornada pelo select existente.
