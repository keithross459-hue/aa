# FiiLTHY.AI Launch Audit Report

Date: 2026-04-30

## Executive Summary

The codebase is a working React + FastAPI SaaS with real Stripe, referral, admin, product generation, download, store-launch, and analytics surfaces. The highest launch risks were not architecture failure; they were production hardening gaps: auth dependency enforcement, rate limiting, security headers, health/readiness endpoints, DB indexes, build warnings, eager frontend bundling, missing env/deployment docs, limited payout controls, and incomplete operational runbooks.

## Severity Findings

### Critical

- Webhook security must remain signature-only. Existing Stripe webhook verification rejects unsigned events; preserved.
- JWT rotation support was missing. Added `JWT_PREVIOUS_SECRETS`, issuer, and audience support with backward compatibility.
- Banned users were blocked at login but not at every authenticated request. Fixed in `current_user`.
- Production CORS with wildcard plus credentials was unsafe. Credentials are now disabled when wildcard origins are configured.

### High

- No API rate limiting. Added in-memory rate limiting for auth and general API requests.
- No standard security headers. Added `nosniff`, frame deny, referrer policy, permissions policy, and optional HSTS.
- Missing readiness/health/status endpoints for Railway and uptime checks. Added `/api/health`, `/api/ready`, and `/api/status`.
- DB indexes were not bootstrapped. Added startup index creation for users, products, campaigns, listings, tracking, payments, referrals, payouts, and audit logs.
- Frontend built with warnings from hook dependencies. Fixed.
- Frontend bundled all routes eagerly. Added route lazy loading.

### Medium

- `server.py` is still large and mixes core product routes with orchestration. Existing architecture was preserved; future refactor should continue extracting routers.
- Referral fraud protection existed only as business logic after Phase 2-4. Added velocity/domain/disposable-domain checks and admin review workflow.
- Payout approval existed only conceptually. Added user ledger, payout request, admin approval, paid, and rejection paths.
- Missing account export/GDPR basics. Added account export UI and legal policy generator endpoints.
- No backup automation. Added `backend/scripts/backup_mongo.py` for scheduled `mongodump`.
- No CI pipeline. Added GitHub Actions for backend compile and frontend build.

### Low

- Some generated artifacts are present locally (`frontend/build`, `node_modules`, previous ZIPs). Deploy ZIP excludes runtime bloat.
- Accessibility and SEO are improved but not fully WCAG-audited. Remaining work should include automated axe checks and copy review.
- Dependency bloat exists from broad Radix UI imports, CRA, and unused UI primitives. Lazy routes reduce impact; deeper removal should be done carefully after route coverage is expanded.

## Architecture Quality

- Backend is modular enough to extend safely: routers, services, integrations, and shared auth/db modules.
- Frontend pages/components are conventional React and now route-split.
- The main risk is the large `backend/server.py`; do not rewrite, but continue extracting stable route clusters.

## Security Review

- Stripe webhook verification is preserved.
- Admin routes use `current_admin`.
- Auth now enforces banned users on every dependency.
- JWT rotation is supported.
- Rate limiting and security headers are installed.
- Bot signup honeypot added.
- CSRF risk is low because auth uses Bearer tokens rather than cookies; origin/CORS and token storage still deserve monitoring.

## Performance Review

- Frontend lazy loading reduces initial route bundle.
- DB index bootstrap reduces list/detail/analytics query risk.
- Analytics aggregation currently scans bounded record sets; at larger scale, move to rollup jobs.

## Conversion / Growth Review

- Pricing now presents Pro at `$49.99` and CEO at `$299.99`.
- Billing center, affiliate center, payout dashboard, executive analytics, cancellation save flow, cookie consent, and account export are present.
- Lifecycle and referral emails are templated; deeper segmentation can be layered through PostHog/SendGrid.

## Prioritized Fix List

1. Critical launch config: set live env vars, Stripe webhook secret, live mode keys, strict CORS, JWT secret.
2. Run smoke tests against Railway/Vercel production URLs.
3. Schedule Mongo backups and verify restore.
4. Verify Stripe subscription, portal, invoices, receipt PDFs, and webhooks in live mode.
5. Verify PostHog event ingestion and session recording settings.
6. Add automated browser accessibility checks post-launch.
7. Extract remaining product routes from `server.py` after launch freeze.

## Dependency Review

- Frontend production build is clean.
- `yarn audit --level critical --groups dependencies --json` reports `critical: 0`. It still reports high/moderate findings from the CRA/react-scripts dependency chain; replacing CRA is a larger migration and was intentionally not done during this in-place launch hardening pass.
- Python dependencies compile under the current source checks; several packages are outdated, but no Python security scanner is bundled in this repo.

## Secret Review

- Hardcoded Stripe/SendGrid-looking values in `memory/PRD.md` were redacted.
- The final secret scan found no live Stripe webhook, live Stripe secret, or SendGrid token patterns outside `.env.example`.
