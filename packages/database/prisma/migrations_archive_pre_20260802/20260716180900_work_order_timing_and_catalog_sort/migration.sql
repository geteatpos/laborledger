-- AlterTable: checklist sort order for field service catalog
ALTER TABLE "service_catalog_items" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: vehicle dwell time on work orders (total = finishedAt - startedAt)
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_catalog_items_company_id_sort_order_idx"
  ON "service_catalog_items"("companyId", "sortOrder");
