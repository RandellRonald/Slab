# SLAB Production Test Report

Generated: 2026-09-22

## Routes Tested

- `/` landing page: loads in Vite dev server.
- `/customer/login`: customer presentation login succeeds when backend is running.
- `/booking`: authenticated customer booking page renders.
- `/booking?emergency=1`: emergency booking flow renders with emergency service selected.
- `/booking/review`: emergency booking review renders with `SLAB Emergency Booking Fee = ₹0`.
- `/booking/payment/mock?booking_id=...`: emergency booking reaches the zero-fee confirmation/payment step.

## APIs Tested

- `GET /api/v1/health`: OK.
- `GET /api/v1/health/ready`: OK for local runtime.
- `POST /api/v1/auth/presentation-login`: OK for customer.
- `GET /api/v1/auth/me`: OK with customer JWT.
- `GET /api/v1/customer/projects`: OK.
- `POST /api/v1/maps/reverse-geocode`: OK. Nominatim currently returns 403 in this local environment, and the API now returns a coordinate fallback instead of crashing.
- `POST /api/v1/customer/bookings/estimate`: OK for emergency booking.
- `POST /api/v1/customer/bookings`: OK for emergency booking after datetime normalization fix.

## Auth Results

- Customer presentation login works when the FastAPI backend is running.
- The repeated `"Unable to reach the SLAB API"` browser error was reproduced when backend port `127.0.0.1:8000` was not running.
- Backend was restarted from `C:\Users\hp\OneDrive\Documents\slab\backend`.

## Booking / Payment Results

- Emergency booking no longer fails with `Request validation failed`.
- Root cause fixed: browser `datetime-local` start time was offset-naive while the computed end time was offset-aware, causing a backend datetime comparison crash.
- Emergency booking now reaches `/booking/payment/mock` with no browser console errors.
- `SLAB Emergency Booking Fee = ₹0` is shown and preserved in estimate data.
- Normal booking now reaches `/booking/payment/mock` after estimate, review, and booking creation.
- Root cause fixed for the latest booking estimate validation error: optional address fields from the map fallback were being sent as empty strings, especially `postal_code: ""`; those fields are now omitted from the API payload when empty.
- Normal pricing tests still pass.

## Provider / Admin Results

- Provider/admin full browser flows were not re-run in this final pass.
- Existing provider unit coverage passed for the selected provider phase tests.
- Admin route remains a production QA item before deployment.

## Mobile / Responsive Results

Booking page tested in Chromium at:

- 1440px
- 1280px
- 1024px
- 768px
- 430px
- 390px
- 375px
- 320px

Results:

- No horizontal overflow detected.
- Booking summary rendered at every width.
- `Estimate cost` and `Review and book` were present at every width.
- No console errors were captured in the responsive booking check.

## Errors Fixed

- Fixed location picker reverse-geocode race handling so older responses cannot overwrite the current center pin.
- Fixed location picker UX so map lookup failures do not cover the map or block manual fallback.
- Fixed map reverse-geocode API 500 when Nominatim rejects/times out.
- Fixed emergency booking datetime validation crash.
- Fixed booking summary grid/sidebar breakpoint behavior so Chrome does not shove action buttons outside the viewport.

## Remaining Blockers

- `/api/v1/health/ready` reports `database.driver = sqlite`. True production readiness still requires PostgreSQL/Supabase `DATABASE_URL` to be configured and verified.
- Nominatim is returning 403 for the current local `MAPS_USER_AGENT`; production should use a compliant app-specific user agent/contact configuration or a managed geocoding proxy.
- Real Stripe payment/webhook flow was not verified in this final pass; only the local/mock payment path and emergency zero-fee behavior were verified.
- Full customer/provider/admin/operator end-to-end QA remains required against the final production environment.
