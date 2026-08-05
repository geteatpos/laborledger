# Migration review — catalog sortOrder + work order timing

**File:** `packages/database/prisma/migrations/20260716180900_work_order_timing_and_catalog_sort/migration.sql`

**Status:** NOT applied. Awaiting review before `migrate deploy`.

## SQL

```sql
ALTER TABLE "service_catalog_items" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "service_catalog_items_company_id_sort_order_idx"
  ON "service_catalog_items"("companyId", "sortOrder");
```

## After you approve

```bash
cd /home/ubuntu/apps/laborledger
pnpm --filter @laborledger/database db:migrate:deploy
pnpm --filter @laborledger/database exec prisma generate
# rebuild/restart API + admin
```

## Notes

- Existing catalog rows get `sortOrder = 0` (editable in `/service-catalog`).
- Existing work orders keep `startedAt`/`finishedAt` NULL until new creates/finalizes set them.
- Tiempo total admin = `finishedAt - startedAt` when both are set.
