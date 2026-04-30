# Rollback Plan

1. Keep the previous Railway deployment available.
2. Keep the previous Vercel deployment available.
3. Before launch, export or snapshot the production database.
4. If API health fails, roll Railway back to the previous deployment.
5. If frontend routing/build fails, roll Vercel back to the previous deployment.
6. If Stripe webhooks misbehave, disable the new webhook endpoint in Stripe and restore the previous endpoint.
7. If referral payout states are wrong, pause payout approvals and reconcile `referral_commissions` and `referral_payouts`.
8. After rollback, run smoke tests and verify `/api/ready`, login, billing, and product generation.
