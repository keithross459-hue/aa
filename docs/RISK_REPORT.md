# Risk Report

## Residual Risks

- `backend/server.py` remains large. Risk: future changes can create merge conflicts. Mitigation: continue extracting routers after launch.
- In-memory rate limiting resets on process restart and is per-instance. Risk: multi-instance abuse can bypass exact limits. Mitigation: move counters to Redis when scaling horizontally.
- Analytics aggregation is direct-query based. Risk: slower dashboards at high event volume. Mitigation: add rollup jobs.
- Legal generators are templates, not legal advice. Mitigation: counsel review before launch.
- Backup script requires `mongodump` in runtime. Mitigation: use managed Mongo backups or install Mongo tools in scheduled backup runner.
- Frontend uses localStorage tokens. Risk: XSS token theft if future unsafe HTML is introduced. Mitigation: strict CSP, sanitize admin broadcast previews, avoid raw HTML rendering.

## Rollout Risk Level

Current risk after hardening: Medium. Suitable for controlled production launch after live env, Stripe, email, PostHog, backup, and smoke-test verification.
