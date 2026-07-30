import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";

import { FieldBootstrapService } from "./field-bootstrap.service";
import type { FieldSiteViewRecord } from "./field-bootstrap.types";

type UpsertFieldSiteInput = {
  hostname: string;
  displayName?: string;
  ready: boolean;
};

@Injectable()
export class FieldSiteAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService,
    @Inject(FieldBootstrapService) private readonly fieldBootstrapService: FieldBootstrapService
  ) {}

  async getFieldSiteForLocation(
    principal: AuthenticatedPrincipal,
    locationId: string
  ): Promise<FieldSiteViewRecord | null> {
    const location = await this.requireActiveLocation(locationId);
    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    const site = await this.prisma.fieldSite.findUnique({
      where: { locationId },
      include: {
        location: {
          select: {
            kiosk: {
              select: {
                archivedAt: true,
                credential: { select: { revokedAt: true } }
              }
            }
          }
        }
      }
    });

    if (!site) {
      return null;
    }

    return this.serializeFieldSite(site);
  }

  async upsertFieldSiteForLocation(
    principal: AuthenticatedPrincipal,
    locationId: string,
    input: UpsertFieldSiteInput
  ): Promise<FieldSiteViewRecord> {
    const location = await this.requireActiveLocation(locationId);
    const company = await this.companyScopeService.requireManagementCompany(
      principal,
      location.companyId
    );

    const hostname = this.fieldBootstrapService.validateHostname(input.hostname);
    const displayName = input.displayName?.trim() || null;

    const existingHostname = await this.prisma.fieldSite.findUnique({
      where: { hostname }
    });

    if (existingHostname && existingHostname.locationId !== locationId) {
      throw new BadRequestException("This hostname is already assigned to another location.");
    }

    const site = await this.prisma.fieldSite.upsert({
      where: { locationId },
      create: {
        groupId: company.groupId,
        companyId: company.id,
        locationId,
        hostname,
        displayName,
        ready: input.ready
      },
      update: {
        hostname,
        displayName,
        ready: input.ready,
        archivedAt: null
      },
      include: {
        location: {
          select: {
            kiosk: {
              select: {
                archivedAt: true,
                credential: { select: { revokedAt: true } }
              }
            }
          }
        }
      }
    });

    return this.serializeFieldSite(site);
  }

  async archiveFieldSiteForLocation(
    principal: AuthenticatedPrincipal,
    locationId: string
  ): Promise<FieldSiteViewRecord> {
    const location = await this.requireActiveLocation(locationId);
    await this.companyScopeService.requireManagementCompany(principal, location.companyId);

    const site = await this.prisma.fieldSite.findUnique({
      where: { locationId },
      include: {
        location: {
          select: {
            kiosk: {
              select: {
                archivedAt: true,
                credential: { select: { revokedAt: true } }
              }
            }
          }
        }
      }
    });

    if (!site) {
      throw new NotFoundException("Field site not found for this location.");
    }

    const archived = await this.prisma.fieldSite.update({
      where: { id: site.id },
      data: { archivedAt: new Date(), ready: false },
      include: {
        location: {
          select: {
            kiosk: {
              select: {
                archivedAt: true,
                credential: { select: { revokedAt: true } }
              }
            }
          }
        }
      }
    });

    return this.serializeFieldSite(archived);
  }

  private async requireActiveLocation(locationId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location || location.archivedAt) {
      throw new NotFoundException("Location not found.");
    }

    return location;
  }

  private serializeFieldSite(site: {
    id: string;
    companyId: string;
    locationId: string;
    hostname: string;
    displayName: string | null;
    ready: boolean;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    location: {
      kiosk: {
        archivedAt: Date | null;
        credential: { revokedAt: Date | null } | null;
      } | null;
    };
  }): FieldSiteViewRecord {
    const kiosk = site.location.kiosk;
    const clockAvailable = Boolean(
      kiosk &&
        !kiosk.archivedAt &&
        kiosk.credential &&
        !kiosk.credential.revokedAt
    );

    return {
      id: site.id,
      companyId: site.companyId,
      locationId: site.locationId,
      hostname: site.hostname,
      displayName: site.displayName,
      ready: site.ready,
      archivedAt: site.archivedAt?.toISOString() ?? null,
      createdAt: site.createdAt.toISOString(),
      updatedAt: site.updatedAt.toISOString(),
      clockAvailable
    };
  }
}
