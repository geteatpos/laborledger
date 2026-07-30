import { Inject, Injectable } from "@nestjs/common";
import type { MobileAuthAuditAction, MobileAuthAuditOutcome, Prisma } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";

const MAX_REASON_LENGTH = 120;
const TOKEN_LIKE_PATTERN = /([A-Za-z0-9_-]{20,}|\b(?:bearer|token|secret|password|pin|badge|android)\b\s*[:=]?\s*\S+|\b(?:badge|android)-[A-Za-z0-9_-]+|\bpin\s+\d{3,})/giu;
const ALLOWED_REASON_CHARS = /[^a-z0-9 _.:/@#-]/giu;

export function sanitizeMobileAuditReason(reason?: string) {
  const normalized = reason?.trim();
  if (!normalized) return null;
  const redacted = normalized.replace(TOKEN_LIKE_PATTERN, "[redacted]").replace(ALLOWED_REASON_CHARS, " ");
  return redacted.replace(/\s+/gu, " ").slice(0, MAX_REASON_LENGTH).trim() || "[redacted]";
}

type AuditInput = {
  action: MobileAuthAuditAction;
  outcome: MobileAuthAuditOutcome;
  reason?: string | undefined;
  groupId?: string | undefined;
  companyId?: string | undefined;
  locationId?: string | undefined;
  actorUserId?: string | undefined;
  employeeId?: string | undefined;
  deviceId?: string | undefined;
  sessionId?: string | undefined;
  enrollmentTokenId?: string | undefined;
  badgeCredentialId?: string | undefined;
  metadata?: Record<string, string | number | boolean | null> | undefined;
};

@Injectable()
export class MobileAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    const data: Prisma.MobileAuthAuditEventUncheckedCreateInput = {
      action: input.action,
      outcome: input.outcome,
      reason: sanitizeMobileAuditReason(input.reason),
      groupId: input.groupId ?? null,
      companyId: input.companyId ?? null,
      locationId: input.locationId ?? null,
      actorUserId: input.actorUserId ?? null,
      employeeId: input.employeeId ?? null,
      deviceId: input.deviceId ?? null,
      sessionId: input.sessionId ?? null,
      enrollmentTokenId: input.enrollmentTokenId ?? null,
      badgeCredentialId: input.badgeCredentialId ?? null
    };

    if (input.metadata) {
      data.metadata = input.metadata as Prisma.InputJsonObject;
    }

    await this.prisma.mobileAuthAuditEvent.create({ data });
  }
}
