# SLAB Stripe test-mode setup

SLAB uses Stripe Checkout on the FastAPI server for the SLAB booking/platform fee only. The equipment and service amount remains a direct customer/provider transaction and is never sent to Stripe.

Set these variables in the backend environment and keep them server-side:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_BASE_URL=http://localhost:5173
BACKEND_BASE_URL=http://localhost:8000
```

For local webhook delivery, use the official Stripe CLI in test mode:

```text
stripe login
stripe listen --forward-to http://localhost:8000/api/v1/payments/stripe/webhook
```

Copy the CLI `whsec_...` value into `STRIPE_WEBHOOK_SECRET`. Use Stripe's official test payment methods, such as `4242 4242 4242 4242`, with any future expiry and CVC. Never use production credentials or real customer payments during development.

The Stripe MCP server is an optional development inspection tool and is not required by the application runtime. Configure the official Stripe MCP server in the Codex/project tool environment when available, with test-mode credentials only. The application continues to use the official Stripe Python SDK in FastAPI so secret keys and webhook verification remain server-side. The current Codex session did not expose a callable Stripe MCP tool, so no MCP resource was used or represented as configured.

Verified flow:

`booking -> payment_pending -> Stripe Checkout -> signed webhook -> slab_payments -> confirmed -> matching`

Webhook event IDs are stored in `stripe_webhook_events`; duplicate deliveries are ignored. The checkout request uses a booking-scoped idempotency key and can be retried after failure, cancellation, or expiry.
