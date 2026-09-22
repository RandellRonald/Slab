create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('customer', 'provider', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'customer_type') then
    create type public.customer_type as enum ('individual', 'company');
  end if;

  if not exists (select 1 from pg_type where typname = 'provider_verification_status') then
    create type public.provider_verification_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  role public.app_role not null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 32),
  email citext unique,
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  customer_type public.customer_type not null default 'individual',
  phone text check (phone is null or char_length(phone) <= 32),
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  verification_status public.provider_verification_status not null default 'pending',
  is_online boolean not null default false,
  phone text check (phone is null or char_length(phone) <= 32),
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  company_name text not null check (char_length(company_name) between 1 and 180),
  business_email citext,
  business_phone text check (business_phone is null or char_length(business_phone) <= 32),
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_created_at on public.profiles(created_at);
create index if not exists idx_customers_user_id on public.customers(user_id);
create index if not exists idx_customers_customer_type on public.customers(customer_type);
create index if not exists idx_customers_created_at on public.customers(created_at);
create index if not exists idx_providers_user_id on public.providers(user_id);
create index if not exists idx_providers_verification_status on public.providers(verification_status);
create index if not exists idx_providers_created_at on public.providers(created_at);
create index if not exists idx_companies_owner_user_id on public.companies(owner_user_id);
create index if not exists idx_companies_owner_profile_id on public.companies(owner_profile_id);
create index if not exists idx_companies_created_at on public.companies(created_at);
create index if not exists idx_audit_logs_actor_user_id on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists set_providers_updated_at on public.providers;
create trigger set_providers_updated_at before update on public.providers for each row execute function public.set_updated_at();
drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at before update on public.companies for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.providers enable row level security;
alter table public.companies enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.providers to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant insert on public.audit_logs to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists customers_select_own on public.customers;
create policy customers_select_own on public.customers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists customers_update_own on public.customers;
create policy customers_update_own on public.customers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists providers_select_own on public.providers;
create policy providers_select_own on public.providers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists providers_update_own on public.providers;
create policy providers_update_own on public.providers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists companies_select_owned on public.companies;
create policy companies_select_owned on public.companies for select to authenticated using ((select auth.uid()) = owner_user_id);
drop policy if exists companies_insert_owned on public.companies;
create policy companies_insert_owned on public.companies for insert to authenticated with check ((select auth.uid()) = owner_user_id);
drop policy if exists companies_update_owned on public.companies;
create policy companies_update_owned on public.companies for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
drop policy if exists companies_delete_owned on public.companies;
create policy companies_delete_owned on public.companies for delete to authenticated using ((select auth.uid()) = owner_user_id);
drop policy if exists audit_logs_insert_self on public.audit_logs;
create policy audit_logs_insert_self on public.audit_logs for insert to authenticated with check (actor_user_id is null or (select auth.uid()) = actor_user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('equipment-images', 'equipment-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('site-images', 'site-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('provider-documents', 'provider-documents', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_read_own_folder on storage.objects;
create policy storage_read_own_folder on storage.objects for select to authenticated using (
  bucket_id in ('profile-images', 'equipment-images', 'site-images', 'provider-documents')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists storage_insert_own_folder on storage.objects;
create policy storage_insert_own_folder on storage.objects for insert to authenticated with check (
  bucket_id in ('profile-images', 'equipment-images', 'site-images', 'provider-documents')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists storage_update_own_folder on storage.objects;
create policy storage_update_own_folder on storage.objects for update to authenticated using (
  bucket_id in ('profile-images', 'equipment-images', 'site-images', 'provider-documents')
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id in ('profile-images', 'equipment-images', 'site-images', 'provider-documents')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists storage_delete_own_folder on storage.objects;
create policy storage_delete_own_folder on storage.objects for delete to authenticated using (
  bucket_id in ('profile-images', 'equipment-images', 'site-images', 'provider-documents')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
