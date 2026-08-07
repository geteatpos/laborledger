-- Shared locations: service clients in the same company may link to one physical location.

CREATE TABLE "service_client_locations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_client_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_client_locations_client_location_key"
  ON "service_client_locations"("serviceClientId", "locationId");

CREATE INDEX "service_client_locations_group_id_idx"
  ON "service_client_locations"("groupId");

CREATE INDEX "service_client_locations_company_id_idx"
  ON "service_client_locations"("companyId");

CREATE INDEX "service_client_locations_service_client_id_idx"
  ON "service_client_locations"("serviceClientId");

CREATE INDEX "service_client_locations_location_id_idx"
  ON "service_client_locations"("locationId");

ALTER TABLE "service_client_locations"
  ADD CONSTRAINT "service_client_locations_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "groups"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_client_locations"
  ADD CONSTRAINT "service_client_locations_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_client_locations"
  ADD CONSTRAINT "service_client_locations_serviceClientId_fkey"
  FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_client_locations"
  ADD CONSTRAINT "service_client_locations_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing location is linked to its primary service client.
INSERT INTO "service_client_locations" ("id", "groupId", "companyId", "serviceClientId", "locationId", "createdAt")
SELECT
  gen_random_uuid()::text,
  l."groupId",
  l."companyId",
  l."serviceClientId",
  l.id,
  COALESCE(l."createdAt", CURRENT_TIMESTAMP)
FROM "locations" l;
