# Render Environment Mapping

The raw provider credentials were supplied outside the repository. Paste them into Render's secret fields; do not commit them.

## Important Overrides For Render

- `BACKEND_URL` must be `https://api.fiilthy.ai`
- `FRONTEND_URL` should be `https://fiilthy.ai`
- `CORS_ORIGINS` should include `https://fiilthy.ai`, `https://www.fiilthy.ai`, and `https://fiilthy-ai-production-frontend.vercel.app`

Do not use the old Railway backend URL for the new Render service.

## Required Secrets To Paste In Render

- `MONGO_URL`
- `OWNER_EMAIL`
- `SETTINGS_ENC_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SENDGRID_API_KEY`
- `POSTHOG_API_KEY`

## Optional / Integration Secrets

- `EMERGENT_LLM_KEY` if available. If not available, the backend falls back to provider-native keys.
- `GUMROAD_ACCESS_TOKEN`
- `META_PIXEL_ID`
- `META_PAGE_ID`
- `SENTRY_DSN`

## Key Rotation Warning

Because production secrets were pasted into chat, rotate them after the Render launch is green.
