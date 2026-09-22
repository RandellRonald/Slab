do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_rate_unit') then
    create type public.equipment_rate_unit as enum ('hour', 'day', 'month');
  end if;

  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum (
      'pending',
      'payment_pending',
      'confirmed',
      'matching',
      'assigned',
      'provider_en_route',
      'provider_arrived',
      'in_progress',
      'completed',
      'cancelled',
      'disputed'
    );
  end if;
end $$;

create table if not exists public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 80),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  image_url text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.equipment_categories(id) on delete restrict,
  slug text not null unique check (char_length(slug) between 2 and 80),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  base_rate numeric(12,2) not null check (base_rate >= 0),
  rate_unit public.equipment_rate_unit not null default 'hour',
  operator_rate numeric(12,2) not null default 0 check (operator_rate >= 0),
  travel_rate_per_km numeric(12,2) not null default 0 check (travel_rate_per_km >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  label text not null check (char_length(label) between 1 and 120),
  address jsonb not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  company_id uuid references public.companies(id) on delete restrict,
  project_name text not null check (char_length(project_name) between 1 and 180),
  address jsonb not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  site_contact_name text check (site_contact_name is null or char_length(site_contact_name) <= 120),
  site_contact_phone text check (site_contact_phone is null or char_length(site_contact_phone) <= 32),
  description text check (description is null or char_length(description) <= 2000),
  requirements text check (requirements is null or char_length(requirements) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  storage_path text not null check (char_length(storage_path) <= 700),
  caption text check (caption is null or char_length(caption) <= 180),
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  company_id uuid references public.companies(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  status public.booking_status not null default 'pending',
  site_location jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  requirements text check (requirements is null or char_length(requirements) <= 3000),
  notes text check (notes is null or char_length(notes) <= 2000),
  photo_urls text[] not null default '{}',
  pricing_snapshot jsonb not null,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_time_range check (ends_at > starts_at)
);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  equipment_type text not null check (char_length(equipment_type) between 1 and 120),
  quantity integer not null check (quantity between 1 and 20),
  duration_hours numeric(10,2) not null check (duration_hours > 0),
  operator_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_configs (
  id uuid primary key default gen_random_uuid(),
  equipment_type_slug text not null unique,
  base_rate numeric(12,2) not null check (base_rate >= 0),
  operator_rate numeric(12,2) not null default 0 check (operator_rate >= 0),
  travel_rate_per_km numeric(12,2) not null default 0 check (travel_rate_per_km >= 0),
  platform_fee_percent numeric(5,2) not null default 8 check (platform_fee_percent >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_categories_slug on public.equipment_categories(slug);
create index if not exists idx_equipment_types_category_id on public.equipment_types(category_id);
create index if not exists idx_saved_locations_user_id on public.saved_locations(user_id);
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_company_id on public.projects(company_id);
create index if not exists idx_project_photos_project_id on public.project_photos(project_id);
create index if not exists idx_bookings_user_id on public.bookings(user_id);
create index if not exists idx_bookings_project_id on public.bookings(project_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_time_range on public.bookings(starts_at, ends_at);
create index if not exists idx_booking_items_booking_id on public.booking_items(booking_id);

drop trigger if exists set_equipment_categories_updated_at on public.equipment_categories;
create trigger set_equipment_categories_updated_at before update on public.equipment_categories for each row execute function public.set_updated_at();
drop trigger if exists set_equipment_types_updated_at on public.equipment_types;
create trigger set_equipment_types_updated_at before update on public.equipment_types for each row execute function public.set_updated_at();
drop trigger if exists set_saved_locations_updated_at on public.saved_locations;
create trigger set_saved_locations_updated_at before update on public.saved_locations for each row execute function public.set_updated_at();
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
drop trigger if exists set_pricing_configs_updated_at on public.pricing_configs;
create trigger set_pricing_configs_updated_at before update on public.pricing_configs for each row execute function public.set_updated_at();

alter table public.equipment_categories enable row level security;
alter table public.equipment_types enable row level security;
alter table public.saved_locations enable row level security;
alter table public.projects enable row level security;
alter table public.project_photos enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.pricing_configs enable row level security;

grant select on public.equipment_categories to anon, authenticated;
grant select on public.equipment_types to anon, authenticated;
grant select on public.pricing_configs to authenticated;
grant select, insert, update, delete on public.saved_locations to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.project_photos to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant select, insert on public.booking_items to authenticated;

create policy equipment_categories_public_read on public.equipment_categories for select to anon, authenticated using (is_active = true);
create policy equipment_types_public_read on public.equipment_types for select to anon, authenticated using (is_active = true);
create policy pricing_configs_authenticated_read on public.pricing_configs for select to authenticated using (is_active = true);

create policy saved_locations_owner_all on public.saved_locations for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy projects_owner_all on public.projects for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy project_photos_owner_all on public.project_photos for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy bookings_owner_select on public.bookings for select to authenticated using ((select auth.uid()) = user_id);
create policy bookings_owner_insert on public.bookings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy bookings_owner_update on public.bookings for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy booking_items_owner_select on public.booking_items for select to authenticated using ((select auth.uid()) = user_id);
create policy booking_items_owner_insert on public.booking_items for insert to authenticated with check ((select auth.uid()) = user_id);

insert into public.equipment_categories (slug, name, description, display_order)
values
  ('earthmoving', 'Earthmoving', 'Excavators, loaders, graders and trenching equipment.', 1),
  ('lifting', 'Lifting', 'Cranes, telehandlers and high-capacity lifting support.', 2),
  ('hauling', 'Hauling', 'Tippers and material movement equipment.', 3),
  ('compaction', 'Compaction', 'Rollers and soil compaction equipment.', 4)
on conflict (slug) do update set name = excluded.name, description = excluded.description, display_order = excluded.display_order;

insert into public.equipment_types (slug, name, description, base_rate, rate_unit, operator_rate, travel_rate_per_km)
values
  ('excavator', 'Excavator', 'Tracked excavator for excavation, trenching and heavy earthmoving.', 120, 'hour', 35, 3.25),
  ('jcb', 'JCB / Backhoe Loader', 'Backhoe loader for mixed digging, loading and site utility work.', 95, 'hour', 35, 3.25),
  ('crane', 'Mobile Crane', 'Mobile crane for lifting and placement operations.', 180, 'hour', 55, 4.50),
  ('mini_tipper', 'Mini Tipper', 'Compact tipper for sand, soil, aggregate and construction debris hauling on narrow sites.', 80, 'hour', 30, 3.75),
  ('standard_tipper', 'Standard Tipper', 'Road-ready tipper for sand, soil, aggregate and construction debris hauling.', 110, 'hour', 30, 3.75),
  ('heavy_tipper', 'Heavy / Large Tipper', 'High-capacity tipper for bulk site material movement and heavy hauling.', 150, 'hour', 30, 3.75),
  ('loader', 'Wheel Loader', 'Loader for stockpile, loading and material handling.', 100, 'hour', 35, 3.25)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  base_rate = excluded.base_rate,
  operator_rate = excluded.operator_rate,
  travel_rate_per_km = excluded.travel_rate_per_km;

insert into public.pricing_configs (equipment_type_slug, base_rate, operator_rate, travel_rate_per_km, platform_fee_percent)
values
  ('excavator', 120, 35, 3.25, 8),
  ('jcb', 95, 35, 3.25, 8),
  ('crane', 180, 55, 4.50, 8),
  ('mini_tipper', 80, 30, 3.75, 8),
  ('standard_tipper', 110, 30, 3.75, 8),
  ('heavy_tipper', 150, 30, 3.75, 8),
  ('loader', 100, 35, 3.25, 8)
on conflict (equipment_type_slug) do update set
  base_rate = excluded.base_rate,
  operator_rate = excluded.operator_rate,
  travel_rate_per_km = excluded.travel_rate_per_km,
  platform_fee_percent = excluded.platform_fee_percent;
