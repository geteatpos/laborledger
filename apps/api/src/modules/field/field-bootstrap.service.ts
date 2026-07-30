import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";

import type { FieldBootstrapResponse } from "./field-bootstrap.types";

const FIELD_LOCATION_NOT_READY_MESSAGE =
  "This location is not ready yet. Ask a manager to finish Field setup in Admin.";

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  const withoutPort = trimmed.split(":")[0] ?? trimmed;
  return withoutPort;
}

function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/u.test(
    hostname
  );
}

@Injectable()
export class FieldBootstrapService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService) private readonly groupAccessService: GroupAccessService
  ) {}

  async resolveByHostname(hostnameInput: string): Promise<FieldBootstrapResponse> {
    const hostname = normalizeHostname(hostnameInput);
    if (!hostname) {
      return this.notReadyResponse(FIELD_LOCATION_NOT_READY_MESSAGE);
    }

    const site = await this.prisma.fieldSite.findFirst({
      where: {
        hostname,
        archivedAt: null
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            groupId: true
          }
        },
        location: {
          select: {
            id: true,
            name: true,
            timezone: true,
            archivedAt: true,
            kiosk: {
              select: {
                archivedAt: true,
                credential: {
                  select: {
                    revokedAt: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!site) {
      return this.notReadyResponse(FIELD_LOCATION_NOT_READY_MESSAGE);
    }

    try {
      await this.groupAccessService.assertCompanyTenantOperational(site.companyId);
    } catch {
      return this.notReadyResponse(FIELD_LOCATION_NOT_READY_MESSAGE);
    }

    const locationActive = !site.location.archivedAt;
    const kiosk = site.location.kiosk;
    const clockAvailable = Boolean(
      kiosk &&
        !kiosk.archivedAt &&
        kiosk.credential &&
        !kiosk.credential.revokedAt
    );

    const operationalReady = site.ready && locationActive;
    const pinLoginReady = operationalReady;

    return {
      ready: operationalReady,
      company: {
        id: site.company.id,
        name: site.company.name,
        legalName: site.company.legalName
      },
      location: {
        id: site.location.id,
        name: site.displayName?.trim() || site.location.name,
        timezone: site.location.timezone
      },
      branding: {
        appTitle: "LaborLedger Field",
        subtitle: site.displayName?.trim() || site.location.name
      },
      features: {
        clockEnabled: clockAvailable,
        vehicleIntakeEnabled: operationalReady,
        laborWorkEnabled: operationalReady
      },
      clock: {
        available: clockAvailable
      },
      employeeLogin: {
        mode: "pin",
        pinLength: 6
      },
      message: operationalReady ? null : FIELD_LOCATION_NOT_READY_MESSAGE
    };
  }

  validateHostname(hostnameInput: string): string {
    const hostname = normalizeHostname(hostnameInput);
    if (!isValidHostname(hostname)) {
      throw new BadRequestException("Hostname must be a valid domain (for example, app.example.com).");
    }
    return hostname;
  }

  async resolveKioskForLocation(companyId: string, locationId: string) {
    const kiosk = await this.prisma.kiosk.findFirst({
      where: {
        companyId,
        locationId,
        archivedAt: null
      },
      include: {
        credential: true
      }
    });

    if (!kiosk || !kiosk.credential || kiosk.credential.revokedAt) {
      throw new NotFoundException("Time clock is not configured for this location.");
    }

    return {
      id: kiosk.id,
      groupId: kiosk.groupId,
      companyId: kiosk.companyId,
      locationId: kiosk.locationId,
      name: kiosk.name
    };
  }

  async getEmployeeShifts(
    employeeId: string,
    locationId: string,
    from: string | undefined,
    to: string | undefined
  ) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const shifts = await this.prisma.shift.findMany({
      where: {
        employeeId,
        locationId,
        scheduledStartUtc: { gte: fromDate },
        scheduledEndUtc: { lte: toDate }
      },
      include: {
        punchEvents: {
          orderBy: { eventUtc: "asc" }
        },
        location: {
          select: { name: true, timezone: true }
        }
      },
      orderBy: { scheduledStartUtc: "desc" }
    });

    return {
      shifts: shifts.map((shift) => {
        const clockIn = shift.punchEvents.find((e) => e.action === "CLOCK_IN");
        const clockOut = shift.punchEvents.find((e) => e.action === "CLOCK_OUT");
        const breakStarts = shift.punchEvents.filter((e) => e.action === "BREAK_START");
        const breakEnds = shift.punchEvents.filter((e) => e.action === "BREAK_END");

        let workedMinutes: number | null = null;
        if (clockIn && clockOut) {
          const totalMs = clockOut.eventUtc.getTime() - clockIn.eventUtc.getTime();
          let breakMs = 0;
          for (let i = 0; i < breakStarts.length; i++) {
            const end = breakEnds[i];
            if (end) {
              breakMs += end.eventUtc.getTime() - breakStarts[i].eventUtc.getTime();
            }
          }
          workedMinutes = Math.round((totalMs - breakMs) / 60000);
        }

        return {
          id: shift.id,
          status: shift.status,
          scheduledStartUtc: shift.scheduledStartUtc.toISOString(),
          scheduledEndUtc: shift.scheduledEndUtc.toISOString(),
          timezone: shift.timezone,
          locationName: shift.location.name,
          clockInUtc: clockIn?.eventUtc.toISOString() ?? null,
          clockOutUtc: clockOut?.eventUtc.toISOString() ?? null,
          breakCount: breakStarts.length,
          workedMinutes,
          punchEvents: shift.punchEvents.map((e) => ({
            action: e.action,
            eventUtc: e.eventUtc.toISOString()
          }))
        };
      })
    };
  }

  private notReadyResponse(message: string): FieldBootstrapResponse {
    return {
      ready: false,
      company: null,
      location: null,
      branding: {
        appTitle: "LaborLedger Field",
        subtitle: null
      },
      features: {
        clockEnabled: false,
        vehicleIntakeEnabled: false,
        laborWorkEnabled: false
      },
      clock: {
        available: false
      },
      employeeLogin: {
        mode: "pin",
        pinLength: 6
      },
      message
    };
  }
}
