do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_review_status') then
    create type public.document_review_status as enum ('pending', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'provider_request_status') then
    create type public.provider_request_status as enum ('pending', 'accepted', 'rejected', 'expired', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'availability_status') then
    create type public.availability_status as enum ('available', 'unavailable', 'maintenance');
  end if;
end $$;

create table if not exists public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null unique references auth.users(id) on delete restrict,
  provider_profile_id uuid not null unique references public.profiles(id) on delete restrict,
  status public.document_review_status not null default 'pending',
  personal_details jsonb not null default '{}'::jsonb,
  contact_details jsonb not null default '{}'::jsonb,
  address jsonb not null default '{}'::jsonb,
  equipment_summary jsonb not null default '{}'::jsonb,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  verification_id uuid references public.provider_verifications(id) on delete restrict,
  equipment_id uuid,
  document_type text not null check (char_length(document_type) between 2 and 80),
  storage_bucket text not null default 'provider-documents',
  storage_path text not null check (char_length(storage_path) <= 700),
  status public.document_review_status not null default 'pending',
  expiry_date date,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_equipment (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  equipment_type_id uuid references public.equipment_types(id) on delete restrict,
  equipment_type_slug text not null check (char_length(equipment_type_slug) between 2 and 80),
  display_name text not null check (char_length(display_name) between 2 and 160),
  registration_number text check (registration_number is null or char_length(registration_number) <= 80),
  identification_number text check (identification_number is null or char_length(identification_number) <= 120),
  status public.availability_status not null default 'available',
  hourly_rate numeric(12,2) check (hourly_rate is null or hourly_rate >= 0),
  daily_rate numeric(12,2) check (daily_rate is null or daily_rate >= 0),
  monthly_rate numeric(12,2) check (monthly_rate is null or monthly_rate >= 0),
  operating_address jsonb not null default '{}'::jsonb,
  operating_latitude double precision check (operating_latitude between -90 and 90),
  operating_longitude double precision check (operating_longitude between -180 and 180),
  operating_radius_km numeric(8,2) not null default 50 check (operating_radius_km > 0),
  photo_urls text[] not null default '{}',
  document_urls text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_documents
  drop constraint if exists provider_documents_equipment_id_fkey,
  add constraint provider_documents_equipment_id_fkey
  foreign key (equipment_id) references public.provider_equipment(id) on delete restrict;

create table if not exists public.provider_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  equipment_id uuid references public.provider_equipment(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_availability_valid_range check (ends_at > starts_at)
);

create table if not exists public.provider_booking_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  equipment_id uuid references public.provider_equipment(id) on delete restrict,
  status public.provider_request_status not null default 'pending',
  rank integer not null default 0,
  distance_km numeric(10,2),
  eta_minutes integer,
  estimated_amount numeric(12,2),
  request_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  responded_at timestamptz,
  response_reason text check (response_reason is null or char_length(response_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, provider_user_id, equipment_id)
);

create unique index if not exists ux_provider_booking_requests_one_accepted
on public.provider_booking_requests(booking_id)
where status = 'accepted';

create table if not exists public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  provider_request_id uuid not null unique references public.provider_booking_requests(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  en_route_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  customer_pin_hash text,
  pin_verified_at timestamptz,
  pin_attempt_count integer not null default 0,
  last_pin_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_locations (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters numeric(10,2),
  recorded_at timestamptz not null default now()
);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  from_status public.booking_status,
  to_status public.booking_status not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  notification_type text not null check (char_length(notification_type) between 2 and 80),
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 1 and 1000),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_provider_verifications_provider_user_id on public.provider_verifications(provider_user_id);
create index if not exists idx_provider_documents_provider_user_id on public.provider_documents(provider_user_id);
create index if not exists idx_provider_documents_status on public.provider_documents(status);
create index if not exists idx_provider_equipment_provider_user_id on public.provider_equipment(provider_user_id);
create index if not exists idx_provider_equipment_type_status on public.provider_equipment(equipment_type_slug, status);
create index if not exists idx_provider_availability_blocks_provider_time on public.provider_availability_blocks(provider_user_id, starts_at, ends_at);
create index if not exists idx_provider_booking_requests_provider_status on public.provider_booking_requests(provider_user_id, status);
create index if not exists idx_provider_booking_requests_booking_status on public.provider_booking_requests(booking_id, status);
create index if not exists idx_booking_assignments_provider_user_id on public.booking_assignments(provider_user_id);
create index if not exists idx_provider_locations_provider_recorded_at on public.provider_locations(provider_user_id, recorded_at desc);
create index if not exists idx_booking_status_history_booking_id on public.booking_status_history(booking_id, created_at);
create index if not exists idx_notifications_recipient_read on public.notifications(recipient_user_id, read_at, created_at desc);

drop trigger if exists set_provider_verifications_updated_at on public.provider_verifications;
create trigger set_provider_verifications_updated_at before update on public.provider_verifications for each row execute function public.set_updated_at();
drop trigger if exists set_provider_documents_updated_at on public.provider_documents;
create trigger set_provider_documents_updated_at before update on public.provider_documents for each row execute function public.set_updated_at();
drop trigger if exists set_provider_equipment_updated_at on public.provider_equipment;
create trigger set_provider_equipment_updated_at before update on public.provider_equipment for each row execute function public.set_updated_at();
drop trigger if exists set_provider_availability_blocks_updated_at on public.provider_availability_blocks;
create trigger set_provider_availability_blocks_updated_at before update on public.provider_availability_blocks for each row execute function public.set_updated_at();
drop trigger if exists set_provider_booking_requests_updated_at on public.provider_booking_requests;
create trigger set_provider_booking_requests_updated_at before update on public.provider_booking_requests for each row execute function public.set_updated_at();
drop trigger if exists set_booking_assignments_updated_at on public.booking_assignments;
create trigger set_booking_assignments_updated_at before update on public.booking_assignments for each row execute function public.set_updated_at();

alter table public.provider_verifications enable row level security;
alter table public.provider_documents enable row level security;
alter table public.provider_equipment enable row level security;
alter table public.provider_availability_blocks enable row level security;
alter table public.provider_booking_requests enable row level security;
alter table public.booking_assignments enable row level security;
alter table public.provider_locations enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.notifications enable row level security;

grant select, insert, update on public.provider_verifications to authenticated;
grant select, insert, update on public.provider_documents to authenticated;
grant select, insert, update, delete on public.provider_equipment to authenticated;
grant select, insert, update, delete on public.provider_availability_blocks to authenticated;
grant select, insert, update on public.provider_booking_requests to authenticated;
grant select, insert, update on public.booking_assignments to authenticated;
grant select, insert on public.provider_locations to authenticated;
grant select, insert on public.booking_status_history to authenticated;
grant select, insert, update on public.notifications to authenticated;

create policy provider_verifications_provider_own on public.provider_verifications for all to authenticated
using ((select auth.uid()) = provider_user_id or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'))
with check ((select auth.uid()) = provider_user_id or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy provider_documents_provider_or_admin on public.provider_documents for all to authenticated
using ((select auth.uid()) = provider_user_id or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'))
with check ((select auth.uid()) = provider_user_id or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy provider_equipment_owner_all on public.provider_equipment for all to authenticated
using ((select auth.uid()) = provider_user_id)
with check ((select auth.uid()) = provider_user_id);

create policy provider_availability_owner_all on public.provider_availability_blocks for all to authenticated
using ((select auth.uid()) = provider_user_id)
with check ((select auth.uid()) = provider_user_id);

create policy provider_requests_provider_read_update on public.provider_booking_requests for select to authenticated
using ((select auth.uid()) = provider_user_id or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())));
create policy provider_requests_provider_update on public.provider_booking_requests for update to authenticated
using ((select auth.uid()) = provider_user_id)
with check ((select auth.uid()) = provider_user_id);

create policy booking_assignments_participant_read on public.booking_assignments for select to authenticated
using (
  (select auth.uid()) = provider_user_id
  or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
);
create policy booking_assignments_provider_update on public.booking_assignments for update to authenticated
using ((select auth.uid()) = provider_user_id)
with check ((select auth.uid()) = provider_user_id);

create policy provider_locations_provider_insert on public.provider_locations for insert to authenticated
with check ((select auth.uid()) = provider_user_id);
create policy provider_locations_participant_read on public.provider_locations for select to authenticated
using (
  (select auth.uid()) = provider_user_id
  or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
);

create policy booking_status_history_participant_read on public.booking_status_history for select to authenticated
using (
  actor_user_id = (select auth.uid())
  or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
  or exists (select 1 from public.booking_assignments a where a.booking_id = booking_status_history.booking_id and a.provider_user_id = (select auth.uid()))
);

create policy notifications_recipient_all on public.notifications for all to authenticated
using ((select auth.uid()) = recipient_user_id)
with check ((select auth.uid()) = recipient_user_id);

create or replace function public.accept_provider_booking_request(p_request_id uuid, p_provider_user_id uuid)
returns public.booking_assignments
language plpgsql
security invoker
as $$
declare
  v_request public.provider_booking_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_assignment public.booking_assignments%rowtype;
begin
  select * into v_request
  from public.provider_booking_requests
  where id = p_request_id and provider_user_id = p_provider_user_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_request.status <> 'pending' or v_request.expires_at <= now() then
    raise exception 'REQUEST_NOT_ACCEPTABLE';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_request.booking_id
  for update;

  if not found or v_booking.status not in ('matching', 'confirmed') then
    raise exception 'BOOKING_NOT_ASSIGNABLE';
  end if;

  update public.provider_booking_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id;

  update public.provider_booking_requests
  set status = 'cancelled'
  where booking_id = v_request.booking_id and id <> p_request_id and status = 'pending';

  update public.bookings
  set status = 'assigned'
  where id = v_request.booking_id;

  insert into public.booking_assignments (booking_id, provider_user_id, provider_request_id)
  values (v_request.booking_id, p_provider_user_id, p_request_id)
  returning * into v_assignment;

  insert into public.booking_status_history (booking_id, actor_user_id, from_status, to_status, metadata)
  values (v_request.booking_id, p_provider_user_id, v_booking.status, 'assigned', jsonb_build_object('provider_request_id', p_request_id));

  return v_assignment;
end;
$$;

revoke execute on function public.accept_provider_booking_request(uuid, uuid) from public;
grant execute on function public.accept_provider_booking_request(uuid, uuid) to authenticated;
