# Investor-Ready Architecture Summary

FiiLTHY.AI is a modular AI launch platform built on React, FastAPI, MongoDB, Stripe, SendGrid, and PostHog. The product turns a business idea into a sellable digital product, landing page structure, ad creative, social scripts, email funnel, store launch records, analytics tracking, and referral activation.

## Revenue Infrastructure

- Stripe monthly subscriptions with Free, Pro, and CEO tiers.
- In-app billing center, invoice/receipt access, payment-method portal, cancel/reactivate, and plan changes.
- Referral/affiliate ledger with fraud checks, payout thresholds, admin approval, and payout notifications.

## Growth Infrastructure

- Viral referral links, leaderboard, commissions, and payout dashboard.
- PostHog-ready event capture, executive dashboard, cohorts, funnel dropoff, LTV/CAC/MRR/ARR/churn metrics.
- Email engine for lifecycle, referral, billing, payout, abandoned checkout, and upsell flows.

## Security / Reliability

- JWT auth with secret rotation compatibility.
- Admin RBAC, banned-user enforcement, rate limiting, security headers, CORS controls, Stripe webhook signature verification.
- Health/readiness/status endpoints for uptime checks.
- DB index bootstrap, backup script, smoke tests, CI pipeline, rollback plan, and monitoring plan.

## Deployment

- Frontend: Vercel.
- Backend: Railway with Nixpacks.
- Domain model: `fiilthy.ai` frontend and `api.fiilthy.ai` backend.
