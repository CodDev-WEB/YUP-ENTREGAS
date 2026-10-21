-- Rastreamento GPS e linha do tempo por jornada.
create table if not exists public.journey_location_points (
 id bigint generated always as identity primary key,
 journey_id uuid not null references public.journeys(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_m double precision,
 speed_mps double precision,
 heading_deg double precision,
 captured_at_device timestamptz not null,
 received_at_server timestamptz not null default now()
);
create index if not exists journey_location_points_journey_time
 on public.journey_location_points(journey_id, captured_at_device);
alter table public.journey_location_points enable row level security;
drop policy if exists journey_location_points_read_accessible on public.journey_location_points;
create policy journey_location_points_read_accessible on public.journey_location_points
 for select to authenticated
 using(public.can_access_journey(journey_id));
drop policy if exists journey_location_points_insert_driver on public.journey_location_points;
create policy journey_location_points_insert_driver on public.journey_location_points
 for insert to authenticated
 with check(
  public.is_active_user()
  and exists(
   select 1 from public.journeys j
   join public.drivers d on d.id=j.driver_id
   where j.id=journey_location_points.journey_id
     and j.status='open'
     and d.profile_id=(select auth.uid())
  )
 );
do $$ begin
 alter publication supabase_realtime add table public.journey_location_points;
exception when duplicate_object then null; when undefined_object then null; end $$;
