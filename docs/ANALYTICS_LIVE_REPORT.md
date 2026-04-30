# Analytics Live Report

## PostHog Configuration

Required env vars:

- Backend: `POSTHOG_API_KEY`, `POSTHOG_HOST`
- Frontend: `REACT_APP_POSTHOG_KEY`, `REACT_APP_POSTHOG_HOST`

## Events / Metrics Covered

- Signup funnel: auth/signup route and frontend capture support.
- Onboarding funnel: product generation, machine launch, integration setup.
- Free to paid conversion: Stripe checkout/session/webhook data.
- Churn events: subscription deleted/updated webhook states.
- Referral events: attribution, commission, payout request/approval/paid.
- LTV/CAC/cohorts: executive dashboard aggregates available database data.
- Heatmaps/session recordings/A-B tests: enabled in PostHog project settings, feature flags exposed through admin.

## Validation Status

- Code hooks: present.
- Executive dashboard route: present.
- Live PostHog ingestion: blocked pending live PostHog key and deployed backend URL. The supplied env set did not include `POSTHOG_API_KEY`.
