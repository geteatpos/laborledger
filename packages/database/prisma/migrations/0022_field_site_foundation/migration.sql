-- FIELD-UNIFICATION01 Phase 2: hostname → company/location mapping for Field PWA bootstrap.

CREATE TABLE "field_sites" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "displayName" TEXT,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_sites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_sites_location_id_key" ON "field_sites"("locationId");
CREATE UNIQUE INDEX "field_sites_hostname_key" ON "field_sites"("hostname");
CREATE INDEX "field_sites_group_id_idx" ON "field_sites"("groupId");
CREATE INDEX "field_sites_company_id_idx" ON "field_sites"("companyId");
CREATE INDEX "field_sites_archived_at_idx" ON "field_sites"("archivedAt");

ALTER TABLE "field_sites" ADD CONSTRAINT "field_sites_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_sites" ADD CONSTRAINT "field_sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_sites" ADD CONSTRAINT "field_sites_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
