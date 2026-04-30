# FiiLTHY.AI

Modular FastAPI + React SaaS for AI-generated digital products, ads, launches, referrals, billing, analytics, and one-click business orchestration.

## Launch Hardening Additions

- Billing UX: `/app/billing` lists invoices, downloads receipt PDFs, manages payment methods through Stripe Portal, changes plans, cancels, and reactivates subscriptions.
- Referral payouts: users see payout thresholds, ledger state, fraud risk, and can request payouts when eligible.
- Admin payout approvals: `/app/admin` includes a Payouts tab for approve, reject, and mark-paid workflows.
- Analytics brain: `/app/analytics` exposes executive MRR, ARR, churn, LTV, CAC, conversion, onboarding, launch success, cohorts, funnel dropoff, top niches, best products, and best ads.
- PostHog integration: optional server capture via `POSTHOG_API_KEY` and browser capture via `REACT_APP_POSTHOG_KEY`.
- One-click machine: `/app/machine` turns an idea into branding, product, course/membership structure, landing page outline, sales copy, ad creative, TikTok scripts, Instagram content, X threads, YouTube Shorts scripts, email funnel, store launch records, analytics metadata, retargeting setup, referral activation, PDF, and ZIP export.
- Security hardening: JWT rotation, banned-user enforcement, rate limiting, security headers, strict CORS behavior, health/readiness/status endpoints, DB index bootstrap, optional Sentry, bot honeypot, cookie consent, account export, legal generators, CI, backup script, and smoke tests.

## Deliverables

- Audit report: `docs/AUDIT_REPORT.md`
- Architecture map: `docs/ARCHITECTURE_MAP.md`
- Deployment checklist: `docs/DEPLOYMENT_CHECKLIST.md`
- Launch checklist: `docs/LAUNCH_CHECKLIST.md`
- Risk report: `docs/RISK_REPORT.md`
- Rollback plan: `docs/ROLLBACK_PLAN.md`
- Monitoring plan: `docs/POST_LAUNCH_MONITORING.md`
- Change log: `docs/CHANGELOG.md`
- Env template: `.env.example`
- Smoke tests: `scripts/smoke_tests.py` and `backend/tests/test_smoke_contract.py`

## Backend

Run from `backend` with the existing `.env`:

```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

Important new routes:

- `GET /api/billing/payment-methods`
- `GET /api/billing/receipts/{invoice_id}/pdf`
- `GET /api/referrals/ledger`
- `POST /api/referrals/payouts/request`
- `GET /api/admin/payouts`
- `POST /api/admin/payouts/{id}/approve`
- `POST /api/admin/payouts/{id}/paid`
- `POST /api/admin/payouts/{id}/reject`
- `GET /api/analytics/executive`
- `POST /api/analytics/capture`
- `POST /api/machine/run`
- `GET /api/machine/export/{product_id}/zip`
- `GET /api/health`
- `GET /api/ready`
- `GET /api/status`
- `GET /api/legal/privacy`
- `GET /api/legal/terms`

## Frontend

Run from `frontend`:

```bash
yarn install --frozen-lockfile
yarn build
yarn start
```

The production build is emitted to `frontend/build`.

## Environment

Existing Stripe, SendGrid, Mongo, and LLM settings are preserved. Optional additions:

- `POSTHOG_API_KEY`
- `POSTHOG_HOST`
- `REACT_APP_POSTHOG_KEY`
- `REACT_APP_POSTHOG_HOST`
- `REFERRAL_PAYOUT_THRESHOLD_USD`

If PostHog keys are missing, analytics capture is safely mocked and app behavior is unchanged.
