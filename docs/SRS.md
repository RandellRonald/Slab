# SLAB Software Requirements Specification

## Purpose

SLAB is a construction equipment and construction services marketplace. Phase 1 establishes the secure foundation shared by future customer, provider, and admin applications.

## Users and Roles

- Customer: manages personal marketplace access and future booking data.
- Provider: manages provider identity and future equipment/service records.
- Admin: performs controlled operational actions in later phases.

The role stored in the database is authoritative. Frontend route guards are only a user-experience layer.

## Phase 1 Scope

- Project architecture for frontend, backend, Supabase, tests, Docker, and docs.
- Supabase tables for profiles, customers, providers, companies, and audit logs.
- Supabase Auth integration through backend auth endpoints.
- Backend RBAC dependencies for customer, provider, and admin access.
- Basic React app shell with public and authenticated layouts.
- Centralized API client and authentication context.
- Health/readiness endpoints and consistent API envelopes.
- Baseline tests and future Playwright location.

## Out of Scope

Equipment listings, services marketplace, projects, maps, booking, pricing, matching, dispatch, Stripe, GPS tracking, chat, notifications, job lifecycle, reviews, disputes, and full admin operations.

## Security Requirements

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.
- Validate backend input with Pydantic.
- Enforce RBAC server-side.
- Enable RLS on application tables.
- Use ownership policies for user-owned rows.
- Never trust frontend user IDs or roles.
- Keep secrets out of Git.
- Return safe error messages and log detailed errors server-side.
