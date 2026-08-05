# Migration review — company settings + membership location

**File:** `packages/database/prisma/migrations/20260716154500_company_settings_and_membership_location/migration.sql`

**Status:** NOT applied to VPS yet. Backup already at `~/backups/laborledger_pre_reset_20260716.dump`.

## SQL

```sql
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "company_memberships" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

CREATE INDEX IF NOT EXISTS "company_memberships_location_id_idx"
  ON "company_memberships"("locationId");

-- FK locationId → locations(id) ON DELETE SET NULL
```

## After you approve

```bash
cd /home/ubuntu/apps/laborledger
pnpm --filter @laborledger/database db:migrate:deploy
SEED_OWNER_PASSWORD='…' pnpm --filter @laborledger/database seed:tenants
# then rebuild/restart API (company-scope uses locationId)
```

## Seed tenants

1. Family Autobody and Sales → NH  
2. Marios General Services → Woburn, NH  
3. Marios Autodetail Corp → Woburn  
4. Brothers Corp → Woburn  

Owner: `mario@gmail.com` / `COMPANY_ADMIN` / `locationId=null` on all four.
