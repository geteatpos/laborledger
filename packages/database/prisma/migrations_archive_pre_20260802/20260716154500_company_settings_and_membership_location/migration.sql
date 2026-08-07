-- REVIEW BEFORE APPLYING TO VPS
-- Additive migration: Company.settings + CompanyMembership.locationId (branch scope).
-- Does NOT drop data. Safe to apply after backup.

-- Per-tenant settings JSON (defaults applied in app via company-settings.ts)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';

-- Branch scope on membership: NULL = all locations for this company (owner pattern).
-- Always store a string cuid or NULL — never 0 / numeric sentinel.
ALTER TABLE "company_memberships" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

CREATE INDEX IF NOT EXISTS "company_memberships_location_id_idx"
  ON "company_memberships"("locationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_memberships_locationId_fkey'
  ) THEN
    ALTER TABLE "company_memberships"
      ADD CONSTRAINT "company_memberships_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "locations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
