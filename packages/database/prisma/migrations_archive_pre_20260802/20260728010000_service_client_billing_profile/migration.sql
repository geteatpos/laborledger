-- Service client billing profile for invoice Bill To (receiver side).
-- All columns nullable so existing clients remain valid; name stays the only required field.

ALTER TABLE "service_clients"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "taxId" TEXT,
  ADD COLUMN "billingContactName" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "stateRegion" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "country" TEXT;
