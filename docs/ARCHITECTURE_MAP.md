# Architecture Map

## Frontend

- `frontend/src/App.js`: React Router, lazy-loaded pages, cookie consent.
- `frontend/src/auth.jsx`: token auth provider.
- `frontend/src/api.js`: Axios API client with Bearer token injection.
- `frontend/src/components/AppLayout.jsx`: authenticated app shell and navigation.
- `frontend/src/pages/*`: product, billing, referral, admin, analytics, machine, account, pricing, auth, and dashboard views.
- `frontend/src/posthog-lite.js`: optional browser analytics capture when PostHog env vars exist.

## Backend

- `backend/server.py`: core API setup, auth/product/campaign/launch/tracking routes, health/status/legal endpoints.
- `backend/core_auth.py`: password hashing, JWT mint/decode, user/admin dependencies.
- `backend/db.py`: Motor Mongo client singleton.
- `backend/routers/billing.py`: Stripe checkout, status, portal, invoices, receipts, webhooks.
- `backend/routers/referrals.py`: referral summary, leaderboard, ledger, payout requests.
- `backend/routers/admin.py`: admin overview, users, broadcasts, feature flags, announcements, payouts.
- `backend/routers/analytics.py`: executive analytics and PostHog capture routes.
- `backend/routers/machine.py`: one-click business orchestration and ZIP export.
- `backend/services/*`: Stripe, email, referrals, payouts, analytics, security, retry, PostHog, audit.
- `backend/integrations/*`: store, Meta, Gumroad, TikTok, settings, downloads.

## Data Collections

- `users`, `products`, `campaigns`, `listings`, `tracking_events`
- `payment_transactions`, `stripe_events`
- `referral_codes`, `referral_attributions`, `referral_commissions`, `referral_payouts`
- `audit_logs`, `feature_flags`, `announcements`, `machine_runs`

## External Services

- Stripe: subscriptions, invoices, portal, webhooks.
- SendGrid: transactional and lifecycle emails.
- PostHog: analytics, A/B tests, recordings, heatmaps when configured.
- Sentry: optional backend error monitoring.
- Railway: backend runtime.
- Vercel: frontend hosting.
