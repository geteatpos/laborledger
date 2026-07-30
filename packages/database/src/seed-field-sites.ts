/**
 * Idempotent FieldSite bootstrap for production hostnames.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @laborledger/database exec tsx src/seed-field-sites.ts
 */

import { PrismaClient } from "@prisma/client";

const GROUP_ID = "cmrnoo63x0001sjvdycprl3ga";

const SITES = [
  {
    hostname: "app.mariosautodetail.com",
    companyId: "cmrnoo64a000lsjvdvkjiy7vs",
    locationId: "cmrnoo64c000psjvdt1ulnk2y",
    displayName: "Marios Autodetail — Woburn"
  },
  {
    hostname: "general.mariosautodetail.com",
    companyId: "cmrnoo645000bsjvdnwshnox5",
    locationId: "cmrnoo647000fsjvd0m6so8al",
    displayName: "Marios General Services — Woburn"
  }
] as const;

async function main() {
  const prisma = new PrismaClient();

  for (const site of SITES) {
    const company = await prisma.company.findUnique({
      where: { id: site.companyId },
      select: { name: true }
    });

    if (!company) {
      throw new Error(`Company ${site.companyId} not found for hostname ${site.hostname}.`);
    }

    const record = await prisma.fieldSite.upsert({
      where: { locationId: site.locationId },
      create: {
        groupId: GROUP_ID,
        companyId: site.companyId,
        locationId: site.locationId,
        hostname: site.hostname,
        displayName: site.displayName,
        ready: true
      },
      update: {
        hostname: site.hostname,
        displayName: site.displayName,
        ready: true,
        archivedAt: null
      }
    });

    console.log(`FieldSite ready: ${record.hostname} → ${company.name}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
