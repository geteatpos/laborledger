-- CreateEnum
CREATE TYPE "LaborBillingDraftStatus" AS ENUM ('DRAFT', 'LOCKED', 'VOIDED');

-- CreateTable
CREATE TABLE "labor_billing_drafts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "status" "LaborBillingDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "previewSnapshot" JSONB NOT NULL,
    "payrollCsvSnapshot" TEXT,
    "clientBillingCsvSnapshot" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_billing_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "labor_billing_drafts_company_id_idx" ON "labor_billing_drafts"("companyId");

-- CreateIndex
CREATE INDEX "labor_billing_drafts_location_id_idx" ON "labor_billing_drafts"("locationId");

-- CreateIndex
CREATE INDEX "labor_billing_drafts_created_by_user_id_idx" ON "labor_billing_drafts"("createdByUserId");

-- CreateIndex
CREATE INDEX "labor_billing_drafts_period_start_idx" ON "labor_billing_drafts"("periodStart");

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
