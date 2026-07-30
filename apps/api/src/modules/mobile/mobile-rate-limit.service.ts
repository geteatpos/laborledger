import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { MobileAuditService } from "./mobile-audit.service";
import { hashMobileSecret } from "./mobile-secret-hash";

type RateLimitInput = {
  scope: "DEVICE_ENROLLMENT" | "LOGIN" | "LOGOUT" | "SESSION_ME" | "ADMIN_REVOKE" | "BADGE_PROVISIONING";
  identifier: string;
  maxAttempts: number;
  windowSeconds: number;
  lockSeconds: number;
  groupId?: string | undefined;
  companyId?: string | undefined;
  locationId?: string | undefined;
};

@Injectable()
export class MobileRateLimitService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MobileAuditService) private readonly audit: MobileAuditService
  ) {}

  hashIdentifier(identifier: string) {
    return hashMobileSecret(identifier, "rate-limit");
  }

  private tooManyRequests() {
    return new HttpException("Too many mobile authentication attempts.", HttpStatus.TOO_MANY_REQUESTS);
  }

  private getWindowStart(now: Date, windowSeconds: number) {
    const windowMs = windowSeconds * 1000;
    return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  }

  async assertNotLocked(input: Pick<RateLimitInput, "scope" | "identifier">) {
    const now = new Date();
    const identifierHash = this.hashIdentifier(`${input.scope}:${input.identifier}`);
    const activeLock = await this.prisma.mobileAuthRateLimit.findFirst({
      where: { scope: input.scope, identifierHash, lockedUntil: { gt: now } }
    });
    if (activeLock) {
      throw this.tooManyRequests();
    }
  }

  async recordFailure(input: RateLimitInput) {
    const now = new Date();
    const identifierHash = this.hashIdentifier(`${input.scope}:${input.identifier}`);
    const windowStart = this.getWindowStart(now, input.windowSeconds);
    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.mobileAuthRateLimit.upsert({
        where: { scope_identifierHash_windowStart: { scope: input.scope, identifierHash, windowStart } },
        create: {
          scope: input.scope,
          identifierHash,
          windowStart,
          attemptCount: 1,
          lockedUntil: null,
          lastAttemptAt: now,
          groupId: input.groupId ?? null,
          companyId: input.companyId ?? null,
          locationId: input.locationId ?? null
        },
        update: {
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
          groupId: input.groupId ?? null,
          companyId: input.companyId ?? null,
          locationId: input.locationId ?? null
        }
      });
      if (row.attemptCount <= input.maxAttempts) return row;
      const lockedUntil = row.lockedUntil && row.lockedUntil > now ? row.lockedUntil : new Date(now.getTime() + input.lockSeconds * 1000);
      return tx.mobileAuthRateLimit.update({ where: { id: row.id }, data: { lockedUntil } });
    });

    if (updated.lockedUntil && updated.lockedUntil > now) {
      await this.audit.record({
        action: "RATE_LIMIT_LOCKOUT",
        outcome: "FAILURE",
        reason: input.scope,
        groupId: input.groupId,
        companyId: input.companyId,
        locationId: input.locationId,
        metadata: { scope: input.scope }
      });
      throw this.tooManyRequests();
    }
  }

  async clearFailures(input: Pick<RateLimitInput, "scope" | "identifier">) {
    const identifierHash = this.hashIdentifier(`${input.scope}:${input.identifier}`);
    await this.prisma.mobileAuthRateLimit.updateMany({
      where: { scope: input.scope, identifierHash },
      data: { attemptCount: 0, lockedUntil: null, lastAttemptAt: new Date() }
    });
  }

  async assertAllowedAndRecord(input: RateLimitInput) {
    await this.assertNotLocked(input);
    await this.recordFailure(input);
  }
}
