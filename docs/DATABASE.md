# SLAB Database

## Tables

### `profiles`

Application-level user profile linked one-to-one to `auth.users`.

- `id`: UUID primary key
- `user_id`: unique UUID foreign key to `auth.users`
- `role`: `customer`, `provider`, or `admin`
- `full_name`, `phone`, `email`, `avatar_url`
- `is_active`
- `created_at`, `updated_at`

### `customers`

Customer foundation linked one-to-one to a profile.

- `id`
- `user_id`
- `profile_id`
- `customer_type`: `individual` or `company`
- `phone`, `address`
- `created_at`, `updated_at`

### `providers`

Provider foundation linked one-to-one to a profile.

- `id`
- `user_id`
- `profile_id`
- `verification_status`: defaults to `pending`
- `is_online`: defaults to `false`
- `phone`, `address`
- `created_at`, `updated_at`

### `companies`

Company ownership foundation for future projects/sites.

- `id`
- `owner_user_id`
- `owner_profile_id`
- `company_name`
- `business_email`, `business_phone`, `address`
- `created_at`, `updated_at`

### `audit_logs`

Append-style audit foundation.

- `id`
- `actor_user_id`, `actor_profile_id`
- `action`
- `entity_type`, `entity_id`
- `metadata`
- `created_at`

## RLS

RLS is enabled for all application tables.

- Profiles: authenticated users can select/update only their own profile.
- Customers: authenticated users can select/update only their own customer row.
- Providers: authenticated users can select/update only their own provider row.
- Companies: authenticated owners can select/insert/update/delete their own companies.
- Audit logs: authenticated users can insert logs only for themselves or with no actor.

Admin access is enforced through backend RBAC and server-side Supabase operations in Phase 1.

## Storage

Private buckets:

- `profile-images`
- `equipment-images`
- `site-images`
- `provider-documents`

Authenticated users can read, insert, update, and delete files only under a first path segment matching their auth user ID.

## Migration

Initial migration:

```text
supabase/migrations/202609110001_initial_phase_1_schema.sql
```

The Supabase CLI was not installed in this workspace, so the migration file was created locally and must be applied to a real project before live verification.

## Phase 2 Tables

Migration:

```text
supabase/migrations/202609110002_phase_2_marketplace_booking_foundation.sql
```

Adds:

- `equipment_categories`
- `equipment_types`
- `saved_locations`
- `projects`
- `project_photos`
- `bookings`
- `booking_items`
- `pricing_configs`

Booking statuses:

```text
pending -> payment_pending -> confirmed -> matching -> assigned -> provider_en_route -> provider_arrived -> in_progress -> completed
```

Additional terminal/exception states:

```text
cancelled, disputed
```

RLS keeps customer locations, projects, project photos, bookings, and booking items scoped to the owning authenticated user. Equipment categories and active equipment types are public-readable catalog foundations. Pricing configs are authenticated-readable for future admin-managed pricing.
