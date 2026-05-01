# Deployment Checklist

## Render Backend

- Created service: `fiilthy-ai-production-backend`.
- Service ID: `srv-d7puh7e8bjmc73bm5fo0`.
- Live URL: `https://fiilthy-ai-production-backend.onrender.com`.
- Current plan is `free`; add Render billing and upgrade to `starter` or higher for production traffic.
- `render.yaml` remains the Git-ready Blueprint source of truth.
- Confirm service name: `fiilthy-ai-production-backend`.
- Confirm health check path: `/api/health`.
- Confirm start command: `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Open `/api/health`, `/api/ready`, `/api/status`: verified on Render default URL.
- Add custom domain `api.fiilthy.ai`: attached, pending DNS verification.
- Add DNS: `CNAME api fiilthy-ai-production-backend.onrender.com`.
- Configure uptime checks against `/api/health`.
- Schedule `python backend/scripts/backup_mongo.py` or equivalent managed Mongo backup.

## Vercel Frontend

- Set `REACT_APP_BACKEND_URL` to `https://api.fiilthy.ai`.
- Set optional PostHog browser vars.
- Build command: `yarn build`.
- Output directory: `build`.
- Verify all routes under `/`, `/pricing`, `/login`, `/signup`, `/app`.

## Stripe

- Use live secret key.
- Set webhook endpoint: `https://api-domain/api/webhook/stripe`.
- Enable events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`.
- Confirm `STRIPE_WEBHOOK_SECRET`.
- Test Pro `$49.99` and CEO `$299.99`.

## PostHog / Sentry / Email

- Verify PostHog capture from frontend and backend.
- Enable session recordings/heatmaps inside PostHog project settings.
- Set Sentry DSN and confirm a test backend exception reports.
- Verify SendGrid sender authentication and transactional email delivery.
