# Post-Launch Monitoring Plan

- Uptime: check `/api/health` every 60 seconds.
- Readiness: check `/api/ready` after every deploy.
- Errors: monitor Sentry issues and alert on new high-frequency backend exceptions.
- Billing: review Stripe failed payments, webhook delivery failures, and invoice anomalies daily.
- Referrals: review high/medium fraud signals and payout queue daily.
- Analytics: confirm PostHog pageviews, signup, checkout, machine launch, and referral events.
- Performance: watch Railway CPU/memory, Mongo slow queries, and frontend Core Web Vitals.
- Backups: verify backup job completion daily and restore monthly.
- Security: rotate JWT/Stripe/SendGrid keys on incident or scheduled quarterly cadence.
