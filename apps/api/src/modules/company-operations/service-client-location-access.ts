import type { PrismaClient } from "@prisma/client";

type DbClient = Pick<PrismaClient, "serviceClientLocation">;

/**
 * A location is usable by a service client when that client is the primary owner
 * or has an explicit ServiceClientLocation share link (same company).
 */
export function isLocationLinkedToServiceClient(input: {
  locationServiceClientId: string;
  serviceClientId: string;
  linkedServiceClientIds?: readonly string[];
}): boolean {
  if (input.locationServiceClientId === input.serviceClientId) {
    return true;
  }

  return (input.linkedServiceClientIds ?? []).includes(input.serviceClientId);
}

/** Prisma select used by Field/Mobile location option endpoints. */
export const fieldLocationOptionsSelect = {
  id: true,
  name: true,
  serviceClientId: true,
  serviceClientLinks: { select: { serviceClientId: true } }
} as const;

export function mapFieldLocationOption(location: {
  id: string;
  name: string;
  serviceClientId: string;
  serviceClientLinks: Array<{ serviceClientId: string }>;
}) {
  return {
    id: location.id,
    name: location.name,
    serviceClientId: location.serviceClientId,
    linkedServiceClientIds: location.serviceClientLinks.map((link) => link.serviceClientId)
  };
}

export async function loadLinkedServiceClientIds(
  db: DbClient,
  locationId: string
): Promise<string[]> {
  const links = await db.serviceClientLocation.findMany({
    where: { locationId },
    select: { serviceClientId: true }
  });

  return links.map((link) => link.serviceClientId);
}

export async function assertLocationUsableByServiceClient(
  db: DbClient,
  input: {
    companyId: string;
    locationId: string;
    locationCompanyId: string;
    locationServiceClientId: string;
    serviceClientId: string;
  }
): Promise<void> {
  if (input.locationCompanyId !== input.companyId) {
    throw new Error("LOCATION_COMPANY_MISMATCH");
  }

  if (input.locationServiceClientId === input.serviceClientId) {
    return;
  }

  const link = await db.serviceClientLocation.findFirst({
    where: {
      companyId: input.companyId,
      locationId: input.locationId,
      serviceClientId: input.serviceClientId
    },
    select: { id: true }
  });

  if (!link) {
    throw new Error("LOCATION_NOT_LINKED");
  }
}
