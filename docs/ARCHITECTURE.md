# SLAB Architecture

## Frontend

The frontend is a Vite React app under `frontend/`.

- `src/api`: Axios client and Supabase public client.
- `src/features/auth`: Auth context and session restoration.
- `src/routes`: Protected and role-protected route guards.
- `src/layouts`: Public, authenticated, customer, provider, and admin layout foundations.
- `src/components`: Reusable UI and layout primitives.
- `src/pages`: Phase 1 route pages only.

The frontend stores no service-role key and does not authorize by itself. It asks the backend for current user state and role.

## Backend

The backend is a FastAPI app under `backend/`.

- `app/main.py`: app factory, middleware, CORS, routers.
- `app/core`: configuration, logging, response and exception primitives.
- `app/auth`: schemas, auth service, and RBAC dependencies.
- `app/services`: business logic layer.
- `app/database`: Supabase client factory and repositories.
- `app/api/v1`: versioned routers and thin endpoints.

## Supabase

Supabase Auth is the identity source. PostgreSQL stores application data and role-specific foundations. RLS protects rows at the database layer, while backend dependencies enforce endpoint-level RBAC.

## Future Module Integration

Future phases should add new backend services, repositories, routers, frontend features, and migrations without replacing the Phase 1 structure.

Expected additions:

- Phase 2: equipment, services, company projects, maps, booking, pricing
- Phase 3: provider equipment, availability, matching, dispatch
- Phase 4: Stripe, tracking, WebSockets, chat, notifications, job lifecycle, reviews, disputes
- Phase 5: admin operations, reporting, QA, security, performance, VRT

## Phase 2 Modules

Landing:

- Premium white/yellow/dark text commercial landing page.
- Desktop React Three Fiber hero scene with generated WebP fallback image.
- Lazy-loaded 3D and map-heavy routes to protect initial performance.

Customer:

- Customer workspace route for saved locations, company/project foundations, and booking history entry points.
- Site/project data is routed through FastAPI and scoped by authenticated user ownership.

Maps:

- Frontend location picker uses MapLibre GL JS.
- Backend proxies Nominatim and OSRM requests through authenticated FastAPI endpoints.
- Haversine fallback is available for road distance/ETA degradation.

Booking:

- Booking flow captures equipment/service, site, timing, duration, quantity, operator requirement, requirements, photos, cost estimate, review, and cancellation foundation.
- Pricing is calculated server-side and saved as `pricing_snapshot`.
- Stripe execution remains out of scope until Phase 4.

## Security Boundaries

- Browser: public Supabase anon key only.
- API: validates tokens, loads profile, enforces role dependencies.
- Database: RLS enforces ownership.
- Service role: backend-only privileged operations.
