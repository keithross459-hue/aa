# Production Env Validation

Date: 2026-04-30

## Local Ignored Env Files Created

- `backend/.env`
- `frontend/.env`
- `frontend/.env.production.local`

These files are ignored by git and are excluded from production ZIP packaging.

## Normalized For Render

The provided backend URL pointed at an old Railway app. For the Render migration, local env files were normalized to:

- `BACKEND_URL=https://api.fiilthy.ai`
- `FRONTEND_URL=https://fiilthy.ai`
- `TIKTOK_REDIRECT_URI=https://api.fiilthy.ai/api/social/tiktok/callback`

## Validation Results

- Required backend env presence: pass
- MongoDB ping: pass
- Stripe live account retrieval: pass
- Stripe charges enabled: true
- SendGrid profile API: pass
- Frontend production build with production API env: pass
- Secret scan outside ignored env files: pass

## Notes

- `POSTHOG_API_KEY` was not included in the provided values, so live PostHog ingestion remains pending.
- `EMERGENT_LLM_KEY` was not provided, so the backend was updated to fall back to provider-native keys.
- Rotate all pasted production credentials after Render launch is green.
