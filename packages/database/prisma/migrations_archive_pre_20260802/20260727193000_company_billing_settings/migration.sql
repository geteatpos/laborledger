-- Company billing settings, per-company invoice sequence, and immutable invoice snapshots.
-- Migration plan:
-- 1. Add only nullable/defaulted invoice fields so existing invoices remain valid.
-- 2. Create 1:1 billing settings rows from existing Company billing profile data without deleting or rewriting Company data.
-- 3. Seed per-company invoice sequences from preserved historical invoice numbers so future numbers do not collide.
-- 4. Backfill existing issued invoice snapshots best-effort from current Company and ServiceClient data; historical numbers are preserved.
-- Rollback plan (requires application rollback first): drop the added indexes, columns, and new tables. This loses only the newly-added billing settings/sequence/snapshot metadata and does not delete original Company, ServiceClient, invoice, or line rows.

ALTER TABLE "client_invoices"
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "paymentTermsDays" INTEGER,
  ADD COLUMN "issuerSnapshot" JSONB,
  ADD COLUMN "billToSnapshot" JSONB,
  ADD COLUMN "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "balanceMinor" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "company_billing_settings" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "defaultNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_billing_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_invoice_sequences" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sequenceKey" TEXT NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_invoice_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_billing_settings_companyId_key" ON "company_billing_settings"("companyId");
CREATE INDEX "company_billing_settings_group_id_idx" ON "company_billing_settings"("groupId");
CREATE UNIQUE INDEX "company_invoice_sequences_company_id_sequence_key_key" ON "company_invoice_sequences"("companyId", "sequenceKey");
CREATE INDEX "company_invoice_sequences_group_id_idx" ON "company_invoice_sequences"("groupId");
CREATE INDEX "client_invoices_company_id_due_date_idx" ON "client_invoices"("companyId", "dueDate");

ALTER TABLE "company_billing_settings"
  ADD CONSTRAINT "company_billing_settings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "company_billing_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_invoice_sequences"
  ADD CONSTRAINT "company_invoice_sequences_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "company_invoice_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "company_billing_settings" ("id", "groupId", "companyId", "invoicePrefix", "paymentTermsDays", "createdAt", "updatedAt")
SELECT 'cbs_' || md5(c."id" || ':billing-settings'), c."groupId", c."id", 'INV', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
ON CONFLICT ("companyId") DO NOTHING;

UPDATE "client_invoices" ci
SET
  "amountPaidMinor" = 0,
  "balanceMinor" = CASE WHEN ci."status" = 'VOID' THEN 0 ELSE ci."totalMinor" END,
  "issuerSnapshot" = CASE
    WHEN ci."status" IN ('ISSUED', 'VOID') THEN jsonb_build_object(
      'companyId', c."id",
      'name', c."name",
      'legalName', c."legalName",
      'phone', c."phone",
      'billingEmail', c."billingEmail",
      'primaryContactName', c."primaryContactName",
      'addressLine1', c."addressLine1",
      'addressLine2', c."addressLine2",
      'city', c."city",
      'stateRegion', c."stateRegion",
      'postalCode', c."postalCode",
      'country', c."country"
    )
    ELSE ci."issuerSnapshot"
  END,
  "billToSnapshot" = CASE
    WHEN ci."status" IN ('ISSUED', 'VOID') THEN jsonb_build_object(
      'serviceClientId', sc."id",
      'name', sc."name",
      'billingContactName', NULL,
      'billingEmail', NULL,
      'phone', NULL,
      'addressLine1', NULL,
      'addressLine2', NULL,
      'city', NULL,
      'stateRegion', NULL,
      'postalCode', NULL,
      'country', NULL,
      'taxId', NULL
    )
    ELSE ci."billToSnapshot"
  END
FROM "companies" c, "service_clients" sc
WHERE ci."companyId" = c."id"
  AND ci."serviceClientId" = sc."id";

INSERT INTO "company_invoice_sequences" ("id", "groupId", "companyId", "sequenceKey", "nextValue", "createdAt", "updatedAt")
SELECT
  'cis_' || md5(c."id" || ':INV'),
  c."groupId",
  c."id",
  'INV',
  COALESCE(MAX(CASE
    WHEN ci."invoiceNumber" ~ '^INV-[0-9]{8}-[0-9]{4}$' THEN substring(ci."invoiceNumber" from '[0-9]{4}$')::integer
    ELSE NULL
  END), COUNT(ci."id")::integer, 0) + 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
LEFT JOIN "client_invoices" ci ON ci."companyId" = c."id" AND ci."invoiceNumber" IS NOT NULL
GROUP BY c."id", c."groupId"
ON CONFLICT ("companyId", "sequenceKey") DO NOTHING;
