# Live Deployment Report

Date: 2026-04-30

## Current Deployment Status

- Vercel CLI auth: verified as `stackdigitz-5790`.
- Railway is no longer the backend target. Backend target moved to Render.
- Render API credentials: verified for workspace `keith's workspace`.
- Render backend: created as a new service, no existing service overwritten.
- Render backend service: `fiilthy-ai-production-backend`.
- Render backend service ID: `srv-d7puh7e8bjmc73bm5fo0`.
- Render backend URL: `https://fiilthy-ai-production-backend.onrender.com`.
- Render deploy: live on commit `1a9ce9b`.
- Render plan: temporary `free` instance because the workspace rejected paid `starter` creation until billing is added.
- Render custom domain: `api.fiilthy.ai` attached, pending DNS verification.
- Render backend config: added via root `render.yaml` for production paid deploys.
- Vercel fresh frontend project: created and deployed.
- Vercel project: `fiilthy-ai-production-frontend`.
- Vercel production URL: `https://fiilthy-ai-production-frontend.vercel.app`.
- Local production env files: created as ignored files and used for provider configuration; not committed.
- `fiilthy.ai` DNS: no DNS records resolved from this environment.
- `fiilthy.ai` Vercel domain: attached to fresh Vercel project, pending registrar DNS.
- `www.fiilthy.ai` Vercel domain: attached to fresh Vercel project, pending registrar DNS.

## Remaining External Blockers

The backend and frontend are deployed. Full branded-domain launch is pending registrar/DNS and Render billing:

- Add a payment method in Render, then upgrade `fiilthy-ai-production-backend` from `free` to `starter` or higher.
- Domain registrar/DNS access for `fiilthy.ai`.
- DNS for `api.fiilthy.ai` must point to the Render backend before `https://api.fiilthy.ai` can verify.
- DNS for `fiilthy.ai` and `www.fiilthy.ai` must point to Vercel before SSL can issue.
- PostHog production key was not supplied, so analytics health reports `not_configured`.

## Prepared For Deployment

- `render.yaml` added for Render backend deploy.
- `.python-version` added to pin Render to Python 3.11.11.
- LLM generation now preserves the original Emergent integration when available and falls back to direct Anthropic/OpenAI/Gemini APIs on Render.
- `frontend/vercel.json` added for Vercel SPA deploy, rewrites, cache headers, and security headers.
- `.env.example` contains the complete production env list.
- `scripts/verify_live.py` verifies backend, frontend, public routes, and optional authenticated routes.
- `scripts/deploy_checklist.ps1` gives the exact CLI sequence.

## Verified Locally

- Backend Python compile: passed.
- Smoke contract: passed.
- Render backend live verifier: passed for public backend routes.
- Frontend production build: passed with zero warnings.
- Frontend critical audit: zero critical vulnerabilities.
- Live domain lookup: `fiilthy.ai` unresolved.

## Deployed URLs

- Backend: `https://fiilthy-ai-production-backend.onrender.com`.
- Frontend: `https://fiilthy-ai-production-frontend.vercel.app`.
- Domain: pending registrar/DNS setup.

## Production Secret Validation

Local ignored env files were created from the supplied values. MongoDB, Stripe live account access, and SendGrid profile access validated successfully. See `docs/PRODUCTION_ENV_VALIDATION.md`.
