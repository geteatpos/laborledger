import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { EmployeeBadgeCredential } from "@prisma/client";
import * as argon2 from "argon2";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { MobileAuditService, sanitizeMobileAuditReason } from "./mobile-audit.service";
import type { MobileSessionContext } from "./mobile-contracts";
import { MobileDeviceService } from "./mobile-device.service";
import { MobileRateLimitService } from "./mobile-rate-limit.service";
import { MobileSessionService } from "./mobile-session.service";

@Injectable()
export class MobileAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScope: CompanyScopeService,
    @Inject(MobileDeviceService) private readonly deviceService: MobileDeviceService,
    @Inject(MobileSessionService) private readonly sessionService: MobileSessionService,
    @Inject(MobileRateLimitService) private readonly rateLimit: MobileRateLimitService,
    @Inject(MobileAuditService) private readonly audit: MobileAuditService
  ) {}

  async login(input: { deviceId: string; badgeUid: string; pin: string }) {
    const rateLimitInput = {
      scope: "LOGIN",
      identifier: input.deviceId || "missing-device",
      maxAttempts: 10,
      windowSeconds: 15 * 60,
      lockSeconds: 15 * 60
    } as const;

    await this.rateLimit.assertNotLocked(rateLimitInput);

    if (!input.deviceId || !input.badgeUid || !input.pin) {
      throw new BadRequestException("deviceId, badgeUid, and pin are required.");
    }

    const device = await this.prisma.mobileDevice.findUnique({ where: { id: input.deviceId } });
    if (!device || device.status !== "ACTIVE") {
      await this.rateLimit.recordFailure(rateLimitInput);
      await this.audit.record({
        action: "LOGIN_FAILED",
        outcome: "FAILURE",
        reason: "invalid_credentials"
      });
      throw new UnauthorizedException("Invalid mobile credentials.");
    }

    const badgeUidHash = this.deviceService.hashSecret(input.badgeUid);
    const badge = await this.prisma.employeeBadgeCredential.findFirst({
      where: {
        companyId: device.companyId,
        locationId: device.locationId,
        badgeUidHash,
        revokedAt: null,
        OR: [{ deviceId: null }, { deviceId: device.id }]
      },
      include: { employee: true }
    });

    const now = new Date();
    if (!badge || !badge.employee || badge.employee.archivedAt || (badge.expiresAt && badge.expiresAt <= now) || (badge.lockedUntil && badge.lockedUntil > now)) {
      await this.rateLimit.recordFailure({ ...rateLimitInput, groupId: device.groupId, companyId: device.companyId, locationId: device.locationId });
      await this.audit.record({
        action: "LOGIN_FAILED",
        outcome: "FAILURE",
        reason: "invalid_credentials",
        groupId: device.groupId,
        companyId: device.companyId,
        locationId: device.locationId,
        deviceId: device.id
      });
      throw new UnauthorizedException("Invalid mobile credentials.");
    }

    if (badge.employee.companyId !== device.companyId || badge.employee.groupId !== device.groupId) {
      throw new ForbiddenException("Mobile tenant mismatch.");
    }

    const pinCredential = await this.findMatchingPinCredential(device.companyId, badge.employeeId, input.pin);
    if (!pinCredential) {
      await this.rateLimit.recordFailure({ ...rateLimitInput, groupId: device.groupId, companyId: device.companyId, locationId: device.locationId });
      await this.audit.record({
        action: "LOGIN_FAILED",
        outcome: "FAILURE",
        reason: "invalid_credentials",
        groupId: device.groupId,
        companyId: device.companyId,
        locationId: device.locationId,
        deviceId: device.id,
        badgeCredentialId: badge.id
      });
      throw new UnauthorizedException("Invalid mobile credentials.");
    }

    await this.rateLimit.clearFailures(rateLimitInput);

    const session = await this.sessionService.createSession({
      groupId: device.groupId,
      companyId: device.companyId,
      locationId: device.locationId,
      deviceId: device.id,
      employeeId: badge.employeeId
    });

    await this.audit.record({
      action: "LOGIN_SUCCEEDED",
      outcome: "SUCCESS",
      groupId: device.groupId,
      companyId: device.companyId,
      locationId: device.locationId,
      employeeId: badge.employeeId,
      deviceId: device.id,
      sessionId: session.session.id,
      badgeCredentialId: badge.id
    });

    return {
      accessToken: session.token,
      tokenType: "Bearer",
      expiresAt: session.session.expiresAt,
      ttlSeconds: session.ttlSeconds,
      session: this.sessionService.toSafeSession(session.session),
      employee: { id: badge.employee.id, fullName: badge.employee.fullName },
      device: this.deviceService.toSafeDevice(device)
    };
  }

  async me(context: MobileSessionContext) {
    const [employee, device, location, company] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: context.employeeId, companyId: context.companyId } }),
      this.prisma.mobileDevice.findFirst({ where: { id: context.deviceId, companyId: context.companyId, locationId: context.locationId } }),
      this.prisma.location.findFirst({ where: { id: context.locationId, companyId: context.companyId } }),
      this.prisma.company.findFirst({ where: { id: context.companyId } })
    ]);
    if (!employee || !device) {
      throw new UnauthorizedException("Mobile authentication required.");
    }
    return {
      session: { ...context, companyName: company?.name ?? null, locationName: location?.name ?? null },
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        companyId: employee.companyId,
        photoUrl: this.buildPublicPhotoUrl(employee.id, employee.photoUrl)
      },
      device: this.deviceService.toSafeDevice(device)
    };
  }

  private buildPublicPhotoUrl(employeeId: string, storedPhotoPath: string | null): string | null {
    const baseUrl = process.env["API_PUBLIC_URL"];
    if (!storedPhotoPath || !baseUrl) {
      return null;
    }
    return `${baseUrl.replace(/\/$/, "")}/mobile/employees/${employeeId}/photo`;
  }

  async logout(context: MobileSessionContext) {
    await this.sessionService.logout(context);
  }

  async revokeSessionForAdmin(principal: AuthenticatedPrincipal, sessionId: string, reason?: string) {
    const session = await this.prisma.mobileSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException("Mobile session not found.");
    }
    await this.companyScope.requireManagementCompany(principal, session.companyId);
    return this.sessionService.revokeByAdmin(principal.userId, sessionId, reason);
  }

  async registerBadge(principal: AuthenticatedPrincipal, companyId: string, employeeId: string, input: { locationId: string; badgeUid: string; label?: string; deviceId?: string; expiresAt?: string }) {
    const company = await this.companyScope.requireManagementCompany(principal, companyId);
    if (!input.badgeUid || !input.locationId) {
      throw new BadRequestException("badgeUid and locationId are required.");
    }
    const [employee, location, device] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: employeeId, companyId: company.id, groupId: company.groupId, archivedAt: null } }),
      this.prisma.location.findFirst({ where: { id: input.locationId, companyId: company.id, groupId: company.groupId } }),
      input.deviceId ? this.prisma.mobileDevice.findFirst({ where: { id: input.deviceId, companyId: company.id, locationId: input.locationId, status: "ACTIVE" } }) : Promise.resolve(null)
    ]);
    if (!employee) throw new NotFoundException("Employee not found.");
    if (!location) throw new BadRequestException("Location must belong to the selected company.");
    if (input.deviceId && !device) throw new BadRequestException("Device must be active and belong to the selected company/location.");
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) {
      throw new BadRequestException("Badge expiration must be in the future.");
    }
    const badgeUidHash = this.deviceService.hashSecret(input.badgeUid);
    const created = await this.prisma.employeeBadgeCredential.create({
      data: {
        groupId: company.groupId,
        companyId: company.id,
        locationId: location.id,
        employeeId: employee.id,
        deviceId: input.deviceId ?? null,
        badgeUidHash,
        badgeUidHashPrefix: this.deviceService.prefix(badgeUidHash),
        label: input.label?.trim() || null,
        expiresAt,
        provisionedByUserId: principal.userId
      }
    });
    await this.audit.record({ action: "BADGE_REGISTERED", outcome: "SUCCESS", groupId: created.groupId, companyId: created.companyId, locationId: created.locationId, actorUserId: principal.userId, employeeId: created.employeeId, deviceId: created.deviceId ?? undefined, badgeCredentialId: created.id });
    return this.toSafeBadge(created);
  }

  async listBadges(principal: AuthenticatedPrincipal, companyId: string, query: { employeeId?: string; includeRevoked?: string }) {
    await this.companyScope.requireManagementCompany(principal, companyId);
    const badges = await this.prisma.employeeBadgeCredential.findMany({
      where: { companyId, ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.includeRevoked === "true" ? {} : { revokedAt: null }) },
      orderBy: { provisionedAt: "desc" }
    });
    return badges.map((badge) => this.toSafeBadge(badge));
  }

  async revokeBadge(principal: AuthenticatedPrincipal, badgeCredentialId: string, reason?: string) {
    const badge = await this.prisma.employeeBadgeCredential.findUnique({ where: { id: badgeCredentialId } });
    if (!badge) throw new NotFoundException("Badge credential not found.");
    await this.companyScope.requireManagementCompany(principal, badge.companyId);
    const sanitizedReason = sanitizeMobileAuditReason(reason) ?? "admin_revoke";
    const updated = await this.prisma.employeeBadgeCredential.update({ where: { id: badgeCredentialId }, data: { revokedAt: new Date(), revokedByUserId: principal.userId, revocationReason: sanitizedReason } });
    await this.audit.record({ action: "BADGE_REVOKED", outcome: "SUCCESS", reason: sanitizedReason, groupId: updated.groupId, companyId: updated.companyId, locationId: updated.locationId, actorUserId: principal.userId, employeeId: updated.employeeId, deviceId: updated.deviceId ?? undefined, badgeCredentialId: updated.id });
    return this.toSafeBadge(updated);
  }

  private async findMatchingPinCredential(companyId: string, employeeId: string, pin: string) {
    const credentials = await this.prisma.employeePinCredential.findMany({
      where: { companyId, employeeId, revokedAt: null }
    });
    for (const credential of credentials) {
      if (await argon2.verify(credential.pinHash, pin)) {
        return credential;
      }
    }
    return null;
  }

  toSafeBadge(badge: EmployeeBadgeCredential) {
    return { id: badge.id, groupId: badge.groupId, companyId: badge.companyId, locationId: badge.locationId, employeeId: badge.employeeId, deviceId: badge.deviceId, label: badge.label, lockedUntil: badge.lockedUntil, expiresAt: badge.expiresAt, revokedAt: badge.revokedAt, provisionedAt: badge.provisionedAt };
  }
}
