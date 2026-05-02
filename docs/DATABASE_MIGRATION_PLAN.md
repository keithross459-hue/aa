# Mongo Cost Reduction / Postgres Migration

## Current Size

- Database: `ceo_ai`
- Data size: about 71 MB
- Storage size: about 34 MB
- Biggest collection: `products`

This fits inside small Postgres free tiers. The app is currently Mongo-shaped, so the safest migration is staged.

## Immediate Cost Fix

Downgrade MongoDB Atlas to the cheapest available shared/free/Flex tier. The current data is far below 5 GB.

## Postgres Migration Path

1. Create a free Neon or Supabase Postgres database.
2. Copy the pooled Postgres connection string as `DATABASE_URL`.
3. Export Mongo:

```bash
python scripts/export_mongo.py --out backups/mongo-export
```

4. Import documents into Postgres JSONB:

```bash
set DATABASE_URL=postgresql://...
python scripts/import_mongo_jsonb_to_postgres.py --in backups/mongo-export
```

5. Switch backend storage collection by collection, starting with:
   - `users`
   - `payment_transactions`
   - `products`
   - `campaigns`
   - `listings`

## Required Secret

The missing value is `DATABASE_URL`. Supabase `SUPABASE_URL` and API keys are not enough for direct database migration.
