# SLAB Technical Requirements Document

## Architecture

SLAB uses a layered architecture.

Frontend:

```text
Pages -> Layouts -> Features -> Components/Hooks -> API Client -> FastAPI
```

Backend:

```text
Router -> Auth/RBAC -> Validation -> Services -> Repositories -> Supabase
```

Database:

```text
Supabase -> PostgreSQL -> Tables -> Relationships -> Indexes -> RLS
```

## Frontend

The React app uses TypeScript, Vite, Tailwind CSS, React Router, Axios, and the Supabase browser client. `AuthProvider` owns auth state, session restoration, login, registration, logout, and refresh. `ProtectedRoute` and `RoleProtectedRoute` provide UX-level route protection.

## Backend

FastAPI exposes `/api/v1`. Route handlers are thin and delegate to services. `app/core/config.py` centralizes environment configuration. `app/core/exceptions.py` centralizes API error envelopes. `RequestContextMiddleware` adds request IDs, request logs, and baseline security headers.

## Supabase

Supabase Auth owns credentials. Application profile data lives in `profiles`, with role-specific foundations in `customers` and `providers`. `companies` stores ownership foundation only. `audit_logs` stores future audit events. Storage buckets are private and path-scoped by authenticated user ID.

## Deployment Direction

Docker Compose runs the FastAPI API and an Nginx-served frontend build. `nginx/default.conf` is ready to proxy `/api/` to the backend and serve React routes.

## Testing Direction

Pytest covers backend configuration, validation, RBAC dependencies, and API envelopes. Vitest covers frontend shell rendering. Playwright is installed for future end-to-end flows when live Supabase test credentials exist.
