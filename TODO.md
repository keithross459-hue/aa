- [ ] Confirm scope: unlock admin products + admin feature flags
- [ ] Implement backend admin endpoint to mass-unlock all products for all admin users (upsert into `product_unlocks` with `payment_status=paid`)
- [ ] Implement backend admin endpoint to enable all feature flags (set `value=true`) OR optionally add parameter to force enable
- [ ] Add basic audit logging via `services.audit.log_event`
- [ ] Run backend tests (pytest) to ensure no regressions
- [ ] Provide usage instructions (API routes) and how to run the scripts/endpoints

