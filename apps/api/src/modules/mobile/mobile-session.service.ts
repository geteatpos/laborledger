import { randomBytes } from "node:crypto";

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { MobileSession } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import type { MobileSessionContext } from "./mobile-contracts";
import { MobileAuditService, sanitizeMobileAuditReason } from "./mobile-audit.service";
import { hashMobileSecret, mobileHashPrefix } from "./mobile-secret-hash";

const MOBILE_SESSION_TTL_SECONDS = 60 * 60 * 12;

@Injectable()
export class MobileSessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MobileAuditService) private readonly audit: MobileAuditService
  ) {}

  createRawToken() {
    return randomBytes(32).toString("base64url");
  }

  hashSecret(raw: string) {
    return hashMobileSecret(raw, "mobile-session");
  }

  tokenHashPrefix(hash: string) {
    return mobileHashPrefix(hash);
  }

  getTtlSeconds() {
    return MOBILE_SESSION_TTL_SECONDS;
  }

  async createSession(input: {
    groupId: string;
    companyId: string;
    locationId: string;
    deviceId: string;
    employeeId: string;
  }) {
    const token = this.createRawToken();
    const tokenHash = this.hashSecret(token);
    const expiresAt = new Date(Date.now() + MOBILE_SESSION_TTL_SECONDS * 1000);
    const session = await this.prisma.mobileSession.create({
      data: {
        ...input,
        tokenHash,
        tokenHashPrefix: this.tokenHashPrefix(tokenHash),
        expiresAt,
        lastSeenAt: new Date()
      }
    });

    return { token, session, ttlSeconds: MOBILE_SESSION_TTL_SECONDS };
  }

  async resolveBearerToken(rawToken: string): Promise<MobileSessionContext> {
    const tokenHash = this.hashSecret(rawToken);
    const now = new Date();
    const session = await this.prisma.mobileSession.findUnique({
      where: { tokenHash },
      include: { device: true }
    });

    if (!session || session.logoutAt || session.revokedAt || session.expiresAt <= now) {
      if (session && !session.revokedAt && !session.logoutAt && session.expiresAt <= now) {
        await this.audit.record({
          action: "SESSION_EXPIRED",
          outcome: "FAILURE",
          reason: "expired",
          groupId: session.groupId,
          companyId: session.companyId,
          locationId: session.locationId,
          employeeId: session.employeeId,
          deviceId: session.deviceId,
          sessionId: session.id
        });
      }
      throw new UnauthorizedException("Mobile authentication required.");
    }

    if (!session.device || session.device.status !== "ACTIVE") {
      throw new UnauthorizedException("Mobile device is not active.");
    }

    await this.prisma.mobileSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now }
    });
    await this.prisma.mobileDevice.update({
      where: { id: session.deviceId },
      data: { lastSeenAt: now }
    });

    return {
      sessionId: session.id,
      groupId: session.groupId,
      companyId: session.companyId,
      locationId: session.locationId,
      deviceId: session.deviceId,
      employeeId: session.employeeId,
      expiresAt: session.expiresAt
    };
  }

  async logout(context: MobileSessionContext) {
    await this.prisma.mobileSession.update({
      where: { id: context.sessionId },
      data: { logoutAt: new Date() }
    });
    await this.audit.record({
      action: "LOGOUT",
      outcome: "SUCCESS",
      groupId: context.groupId,
      companyId: context.companyId,
      locationId: context.locationId,
      employeeId: context.employeeId,
      deviceId: context.deviceId,
      sessionId: context.sessionId
    });
  }

  async revokeByAdmin(actorUserId: string, sessionId: string, reason?: string) {
    const session = await this.prisma.mobileSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new UnauthorizedException("Mobile session not found.");
    }
    const sanitizedReason = sanitizeMobileAuditReason(reason) ?? "admin_revoke";
    const updated = await this.prisma.mobileSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedByUserId: actorUserId, revocationReason: sanitizedReason }
    });
    await this.audit.record({
      action: "SESSION_REVOKED",
      outcome: "SUCCESS",
      reason: sanitizedReason,
      groupId: updated.groupId,
      companyId: updated.companyId,
      locationId: updated.locationId,
      actorUserId,
      employeeId: updated.employeeId,
      deviceId: updated.deviceId,
      sessionId: updated.id
    });
    return this.toSafeSession(updated);
  }

  toSafeSession(session: MobileSession) {
    return {
      id: session.id,
      groupId: session.groupId,
      companyId: session.companyId,
      locationId: session.locationId,
      deviceId: session.deviceId,
      employeeId: session.employeeId,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt,
      logoutAt: session.logoutAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt
    };
  }
}
