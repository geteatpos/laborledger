import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { MobileDevice, Prisma } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { MobileAuditService, sanitizeMobileAuditReason } from "./mobile-audit.service";
import { MobileRateLimitService } from "./mobile-rate-limit.service";
import { hashMobileSecret, mobileHashPrefix } from "./mobile-secret-hash";

@Injectable()
export class MobileDeviceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScope: CompanyScopeService,
    @Inject(MobileAuditService) private readonly audit: MobileAuditService,
    @Inject(MobileRateLimitService) private readonly rateLimit: MobileRateLimitService
  ) {}

  hashSecret(raw: string) {
    return hashMobileSecret(raw, "mobile-secret");
  }

  prefix(hash: string) {
    return mobileHashPrefix(hash);
  }

  async createEnrollmentToken(
    principal: AuthenticatedPrincipal,
    input: { companyId: string; locationId: string; expiresAt?: string; deviceLabel?: string }
  ) {
    const company = await this.companyScope.requireManagementCompany(principal, input.companyId);
    const location = await this.prisma.location.findFirst({
      where: { id: input.locationId, companyId: company.id, groupId: company.groupId },
      select: { id: true }
    });
    if (!location) {
      throw new BadRequestException("Location must belong to the selected company.");
    }

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException("Enrollment token expiration must be in the future.");
    }

    const deviceLabel = input.deviceLabel?.trim() || null;
    if (deviceLabel && deviceLabel.length > 80) {
      throw new BadRequestException("deviceLabel is too long.");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashSecret(token);
    const created = await this.prisma.mobileEnrollmentToken.create({
      data: {
        groupId: company.groupId,
        companyId: company.id,
        locationId: location.id,
        tokenHash,
        tokenHashPrefix: this.prefix(tokenHash),
        deviceLabel,
        expiresAt,
        createdByUserId: principal.userId
      }
    });

    await this.audit.record({
      action: "ENROLLMENT_TOKEN_CREATED",
      outcome: "SUCCESS",
      groupId: created.groupId,
      companyId: created.companyId,
      locationId: created.locationId,
      actorUserId: principal.userId,
      enrollmentTokenId: created.id
    });

    return {
      enrollmentToken: token,
      token: {
        id: created.id,
        groupId: created.groupId,
        companyId: created.companyId,
        locationId: created.locationId,
        deviceLabel: created.deviceLabel,
        status: created.status,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt
      }
    };
  }

  async enrollDevice(input: { enrollmentToken: string; androidId: string; label?: string }) {
    const rateLimitInput = {
      scope: "DEVICE_ENROLLMENT",
      identifier: input.enrollmentToken || input.androidId || "missing-enrollment-input",
      maxAttempts: 5,
      windowSeconds: 15 * 60,
      lockSeconds: 15 * 60
    } as const;
    await this.rateLimit.assertNotLocked(rateLimitInput);

    if (!input.enrollmentToken || !input.androidId) {
      await this.rateLimit.recordFailure(rateLimitInput);
      throw new BadRequestException("Enrollment token and androidId are required.");
    }

    const tokenHash = this.hashSecret(input.enrollmentToken);
    const enrollmentToken = await this.prisma.mobileEnrollmentToken.findUnique({ where: { tokenHash } });
    const now = new Date();
    if (!enrollmentToken || enrollmentToken.status !== "ACTIVE" || enrollmentToken.expiresAt <= now) {
      if (enrollmentToken?.status === "ACTIVE" && enrollmentToken.expiresAt <= now) {
        await this.prisma.mobileEnrollmentToken.update({
          where: { id: enrollmentToken.id },
          data: { status: "EXPIRED" }
        });
      }
      await this.rateLimit.recordFailure({ ...rateLimitInput, groupId: enrollmentToken?.groupId, companyId: enrollmentToken?.companyId, locationId: enrollmentToken?.locationId });
      await this.audit.record({
        action: "ENROLLMENT_TOKEN_FAILED",
        outcome: "FAILURE",
        reason: "invalid_or_expired",
        groupId: enrollmentToken?.groupId,
        companyId: enrollmentToken?.companyId,
        locationId: enrollmentToken?.locationId,
        enrollmentTokenId: enrollmentToken?.id
      });
      throw new UnauthorizedException("Invalid enrollment token.");
    }

    const androidIdHash = this.hashSecret(input.androidId);
    const existingDevice = await this.prisma.mobileDevice.findFirst({
      where: { companyId: enrollmentToken.companyId, androidIdHash }
    });

    const resolvedLabel =
      input.label?.trim() || enrollmentToken.deviceLabel?.trim() || existingDevice?.label?.trim() || null;

    // Idempotent: an already-ACTIVE device with a valid admin token succeeds so the client
    // can finish onboarding (store device id / advance to login) instead of hard-stopping on 409.
    if (existingDevice?.status === "ACTIVE") {
      const device = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated =
          resolvedLabel && resolvedLabel !== existingDevice.label
            ? await tx.mobileDevice.update({
                where: { id: existingDevice.id },
                data: { label: resolvedLabel, lastSeenAt: now }
              })
            : await tx.mobileDevice.update({
                where: { id: existingDevice.id },
                data: { lastSeenAt: now }
              });

        const consumed = await tx.mobileEnrollmentToken.updateMany({
          where: { id: enrollmentToken.id, status: "ACTIVE", consumedAt: null },
          data: { status: "CONSUMED", consumedAt: now, consumedByDeviceId: updated.id }
        });
        if (consumed.count !== 1) {
          throw new UnauthorizedException("Invalid enrollment token.");
        }
        return updated;
      });

      await this.audit.record({
        action: "DEVICE_ENROLLED",
        outcome: "SUCCESS",
        reason: "already_active",
        groupId: device.groupId,
        companyId: device.companyId,
        locationId: device.locationId,
        deviceId: device.id,
        enrollmentTokenId: enrollmentToken.id,
        actorUserId: enrollmentToken.createdByUserId
      });
      await this.rateLimit.clearFailures(rateLimitInput);
      return { device: this.toSafeDevice(device) };
    }

    // A fresh admin-issued enrollment token is the approval to reactivate a revoked device
    // (same company + androidIdHash). Without a valid token, enrollment never reaches here.
    const device = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let enrolled: MobileDevice;

      if (existingDevice?.status === "REVOKED") {
        enrolled = await tx.mobileDevice.update({
          where: { id: existingDevice.id },
          data: {
            status: "ACTIVE",
            locationId: enrollmentToken.locationId,
            label: resolvedLabel,
            enrolledAt: now,
            enrolledByUserId: enrollmentToken.createdByUserId,
            revokedAt: null,
            revokedByUserId: null,
            revocationReason: null,
            reactivatedAt: now,
            reactivatedByUserId: enrollmentToken.createdByUserId,
            reactivationReason: "admin_reenroll"
          }
        });
      } else {
        enrolled = await tx.mobileDevice.create({
          data: {
            groupId: enrollmentToken.groupId,
            companyId: enrollmentToken.companyId,
            locationId: enrollmentToken.locationId,
            androidIdHash,
            androidIdHashPrefix: this.prefix(androidIdHash),
            label: resolvedLabel,
            enrolledByUserId: enrollmentToken.createdByUserId
          }
        });
      }

      const consumed = await tx.mobileEnrollmentToken.updateMany({
        where: { id: enrollmentToken.id, status: "ACTIVE", consumedAt: null },
        data: { status: "CONSUMED", consumedAt: now, consumedByDeviceId: enrolled.id }
      });
      if (consumed.count !== 1) {
        await this.rateLimit.recordFailure({
          ...rateLimitInput,
          groupId: enrollmentToken.groupId,
          companyId: enrollmentToken.companyId,
          locationId: enrollmentToken.locationId
        });
        throw new UnauthorizedException("Invalid enrollment token.");
      }
      return enrolled;
    });

    const wasReactivated = existingDevice?.status === "REVOKED";
    await this.audit.record({
      action: wasReactivated ? "DEVICE_REACTIVATED" : "DEVICE_ENROLLED",
      outcome: "SUCCESS",
      reason: wasReactivated ? "admin_reenroll" : undefined,
      groupId: device.groupId,
      companyId: device.companyId,
      locationId: device.locationId,
      deviceId: device.id,
      enrollmentTokenId: enrollmentToken.id,
      actorUserId: enrollmentToken.createdByUserId
    });

    await this.rateLimit.clearFailures(rateLimitInput);

    return { device: this.toSafeDevice(device) };
  }

  async listDevices(principal: AuthenticatedPrincipal, companyId: string, locationId?: string) {
    const company = await this.companyScope.requireManagementCompany(principal, companyId);
    if (locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: locationId, companyId } });
      if (!location) {
        throw new BadRequestException("Location must belong to the selected company.");
      }
    }
    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        companyId: company.id,
        status: "ACTIVE",
        ...(locationId ? { locationId } : {})
      },
      orderBy: { enrolledAt: "desc" }
    });
    return devices.map((device) => this.toSafeDevice(device));
  }

  async getMyDevice(deviceId: string) {
    const device = await this.prisma.mobileDevice.findUnique({ where: { id: deviceId } });
    if (!device || device.status !== "ACTIVE") {
      throw new UnauthorizedException("Mobile device is not active.");
    }
    return this.toSafeDevice(device);
  }

  async revokeDevice(principal: AuthenticatedPrincipal, deviceId: string, reason?: string) {
    const device = await this.prisma.mobileDevice.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException("Mobile device not found.");
    }
    await this.companyScope.requireManagementCompany(principal, device.companyId);
    const sanitizedReason = sanitizeMobileAuditReason(reason) ?? "admin_revoke";
    const updated = await this.prisma.mobileDevice.update({
      where: { id: deviceId },
      data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId: principal.userId, revocationReason: sanitizedReason }
    });
    await this.prisma.mobileSession.updateMany({
      where: { deviceId, revokedAt: null, logoutAt: null },
      data: { revokedAt: new Date(), revokedByUserId: principal.userId, revocationReason: "device_revoked" }
    });
    await this.audit.record({
      action: "DEVICE_REVOKED",
      outcome: "SUCCESS",
      reason: sanitizedReason,
      groupId: updated.groupId,
      companyId: updated.companyId,
      locationId: updated.locationId,
      actorUserId: principal.userId,
      deviceId: updated.id
    });
    return this.toSafeDevice(updated);
  }

  /**
   * Re-enrollment policy: revoked devices cannot self-enroll. A new admin-issued enrollment
   * token is the approval signal — consuming it reactivates the existing MobileDevice row
   * (same companyId + androidIdHash) and records DEVICE_REACTIVATED.
   */
  toSafeDevice(device: MobileDevice) {
    return {
      id: device.id,
      groupId: device.groupId,
      companyId: device.companyId,
      locationId: device.locationId,
      label: device.label,
      status: device.status,
      enrolledAt: device.enrolledAt,
      revokedAt: device.revokedAt,
      lastSeenAt: device.lastSeenAt
    };
  }
}
