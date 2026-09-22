# SLAB API

Base path: `/api/v1`

## Response Envelope

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication is required."
  }
}
```

## Health

- `GET /health`
- `GET /health/ready`

Readiness checks application state and Supabase availability without exposing secrets.

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/refresh`

Registration creates a Supabase Auth user, a `profiles` row, and the role foundation row for customers or providers.

## Profile

- `GET /profile`
- `PUT /profile`

Requires authentication. Users can access and update only their own profile.

## Customer

- `GET /customers/me`
- `GET /customer/locations`
- `POST /customer/locations`
- `GET /customer/companies`
- `POST /customer/companies`
- `GET /customer/projects`
- `POST /customer/projects`
- `GET /customer/bookings`
- `POST /customer/bookings/estimate`
- `POST /customer/bookings`
- `POST /customer/bookings/{booking_id}/cancel`

Requires `customer` role.

Booking estimates and final pricing snapshots are calculated by FastAPI. Frontend totals are informational only.

## Maps

All map endpoints require authentication and support the Phase 2 MapLibre/OpenStreetMap workflow.

- `GET/POST /maps/search`
- `GET/POST /maps/reverse-geocode`
- `GET/POST /maps/route`
- `GET/POST /maps/distance`
- `GET/POST /maps/eta`
- `GET/POST /maps/nearest`

Nominatim is used for geocoding. OSRM is used for road routes, distance, and ETA. Haversine is used only as a fallback when OSRM is unavailable.

## Provider

- `GET /providers/me`

Requires `provider` role.

## Admin

- `GET /admin/me`

Requires `admin` role.

## Error Codes

- `AUTH_REQUIRED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `VALIDATION_ERROR`
- `CONFIGURATION_ERROR`
- `INTERNAL_SERVER_ERROR`
