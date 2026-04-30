# Stripe Live Config Report

## Required Live Products

- Free: app-side free plan, no Stripe product required.
- Pro: monthly subscription, `$49.99`.
- CEO: monthly subscription, `$299.99`.

The backend auto-creates/locates Stripe products and prices on startup using:

- `STRIPE_PRICE_PRO_USD=49.99`
- `STRIPE_PRICE_ENTERPRISE_USD=299.99`
- `STRIPE_SECRET_KEY`

## Required Webhook

Endpoint:

- `https://api.fiilthy.ai/api/webhook/stripe`

Events:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

Security:

- `STRIPE_WEBHOOK_SECRET` is mandatory. Unsigned events are rejected.

## Billing Settings To Verify In Stripe Dashboard

- Customer portal enabled.
- Invoice receipts enabled.
- Failed payment retries/dunning configured.
- Tax settings configured for launch jurisdictions.
- Promotion codes/coupons enabled if campaigns need coupons.
- Payout/affiliate manual reconciliation policy documented.

## Verification Status

- Local code verification: passed.
- Live mode: blocked. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are not present, and the Render backend has not been created because Render credentials are not available in this workspace.
