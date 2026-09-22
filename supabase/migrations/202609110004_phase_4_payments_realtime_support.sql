do $$ begin
  create type public.slab_payment_status as enum ('requires_checkout', 'pending', 'succeeded', 'failed', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_dispute_status as enum ('pending', 'under_review', 'resolved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_moderation_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.slab_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (char_length(currency) = 3),
  status public.slab_payment_status not null default 'requires_checkout',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  idempotency_key text not null,
  failure_reason text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, idempotency_key)
);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payment_id uuid references public.slab_payments(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  processing_status text not null default 'processed',
  payload jsonb not null,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.booking_chat_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  sender_id uuid not null references auth.users(id) on delete restrict,
  receiver_id uuid not null references auth.users(id) on delete restrict,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.job_completion_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  customer_user_id uuid not null references auth.users(id) on delete restrict,
  completed_at timestamptz not null default now(),
  provider_notes text check (provider_notes is null or char_length(provider_notes) <= 1000),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  customer_user_id uuid not null references auth.users(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  moderation_status public.review_moderation_status not null default 'pending',
  moderated_by uuid references auth.users(id) on delete restrict,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.providers add column if not exists rating_average numeric(3,2) not null default 0;
alter table public.providers add column if not exists rating_count integer not null default 0;

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  provider_id uuid references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 160),
  description text not null check (char_length(description) between 10 and 3000),
  status public.support_dispute_status not null default 'pending',
  assigned_admin uuid references auth.users(id) on delete restrict,
  resolution text check (resolution is null or char_length(resolution) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.dispute_attachments (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_bucket text not null default 'slab-dispute-files',
  storage_path text not null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('slab-dispute-files', 'slab-dispute-files', false)
on conflict (id) do nothing;

create index if not exists idx_slab_payments_booking_id on public.slab_payments(booking_id);
create index if not exists idx_slab_payments_user_status on public.slab_payments(user_id, status);
create index if not exists idx_chat_booking_created on public.booking_chat_messages(booking_id, created_at);
create index if not exists idx_chat_receiver_read on public.booking_chat_messages(receiver_id, read_at);
create index if not exists idx_disputes_booking_id on public.disputes(booking_id);

drop trigger if exists set_slab_payments_updated_at on public.slab_payments;
create trigger set_slab_payments_updated_at before update on public.slab_payments for each row execute function public.set_updated_at();
drop trigger if exists set_booking_reviews_updated_at on public.booking_reviews;
create trigger set_booking_reviews_updated_at before update on public.booking_reviews for each row execute function public.set_updated_at();
drop trigger if exists set_disputes_updated_at on public.disputes;
create trigger set_disputes_updated_at before update on public.disputes for each row execute function public.set_updated_at();

alter table public.slab_payments enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.booking_chat_messages enable row level security;
alter table public.job_completion_records enable row level security;
alter table public.booking_reviews enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_attachments enable row level security;

grant select, insert, update on public.slab_payments to authenticated;
grant select on public.stripe_webhook_events to authenticated;
grant select, insert, update on public.booking_chat_messages to authenticated;
grant select, insert on public.job_completion_records to authenticated;
grant select, insert, update on public.booking_reviews to authenticated;
grant select, insert, update on public.disputes to authenticated;
grant select, insert on public.dispute_attachments to authenticated;

create policy slab_payments_customer_read on public.slab_payments for select to authenticated
using ((select auth.uid()) = user_id or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy slab_payments_customer_insert on public.slab_payments for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy chat_participant_select on public.booking_chat_messages for select to authenticated
using (
  (select auth.uid()) in (sender_id, receiver_id)
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin')
);

create policy chat_participant_insert on public.booking_chat_messages for insert to authenticated
with check ((select auth.uid()) = sender_id and exists (select 1 from public.bookings b where b.id = booking_id and b.user_id in (sender_id, receiver_id)));

create policy chat_receiver_update_read on public.booking_chat_messages for update to authenticated
using ((select auth.uid()) = receiver_id)
with check ((select auth.uid()) = receiver_id);

create policy completion_participant_select on public.job_completion_records for select to authenticated
using ((select auth.uid()) in (provider_user_id, customer_user_id) or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy reviews_participant_select on public.booking_reviews for select to authenticated
using ((select auth.uid()) in (provider_user_id, customer_user_id) or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy reviews_customer_insert on public.booking_reviews for insert to authenticated
with check ((select auth.uid()) = customer_user_id);

create policy reviews_admin_update on public.booking_reviews for update to authenticated
using (exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy disputes_participant_select on public.disputes for select to authenticated
using ((select auth.uid()) in (customer_id, provider_id) or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy disputes_participant_insert on public.disputes for insert to authenticated
with check ((select auth.uid()) in (customer_id, provider_id));

create policy disputes_admin_update on public.disputes for update to authenticated
using (exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

create policy dispute_attachments_participant_select on public.dispute_attachments for select to authenticated
using (
  uploaded_by = (select auth.uid())
  or exists (select 1 from public.disputes d where d.id = dispute_id and (select auth.uid()) in (d.customer_id, d.provider_id))
  or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin')
);

create policy dispute_attachments_participant_insert on public.dispute_attachments for insert to authenticated
with check ((select auth.uid()) = uploaded_by and exists (select 1 from public.disputes d where d.id = dispute_id and (select auth.uid()) in (d.customer_id, d.provider_id)));

create policy stripe_events_admin_read on public.stripe_webhook_events for select to authenticated
using (exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));
