import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../src/modules/identity-access/prisma.service";
import { MobileAuditService } from "../src/modules/mobile/mobile-audit.service";
import { MobileRateLimitService } from "../src/modules/mobile/mobile-rate-limit.service";

type RateLimitRow = {
  id: string;
  scope: string;
  identifierHash: string;
  windowStart: Date;
  attemptCount: number;
  lockedUntil: Date | null;
  lastAttemptAt: Date;
};

type RateLimitCreate = Omit<RateLimitRow, "id">;
type RateLimitUpdate = { attemptCount: { increment: number }; lastAttemptAt: Date };

function asPrismaService(value: unknown) {
  return value as PrismaService;
}

function asAuditService(value: unknown) {
  return value as MobileAuditService;
}

describe("mobile auth persistent rate limit", () => {
  process.env.MOBILE_AUTH_HASH_PEPPER = "test-mobile-auth-hash-pepper-000000000000000000";

  it("stores only a hashed identifier and locks after the configured threshold", async () => {
    const rows: RateLimitRow[] = [];
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof prisma) => Promise<RateLimitRow>) => callback(prisma)),
      mobileAuthRateLimit: {
        findFirst: vi.fn(async ({ where }: { where: { scope: string; identifierHash: string; lockedUntil?: { gt: Date } } }) =>
          rows.find((row) => {
            if (row.scope !== where.scope || row.identifierHash !== where.identifierHash) return false;
            if (where.lockedUntil?.gt) return row.lockedUntil && row.lockedUntil > where.lockedUntil.gt;
            return true;
          })
        ),
        upsert: vi.fn(async ({ where, create, update }: { where: { scope_identifierHash_windowStart: { scope: string; identifierHash: string; windowStart: Date } }; create: RateLimitCreate; update: RateLimitUpdate }) => {
          const unique = where.scope_identifierHash_windowStart;
          const row = rows.find((entry) => entry.scope === unique.scope && entry.identifierHash === unique.identifierHash && entry.windowStart.getTime() === unique.windowStart.getTime());
          if (!row) {
            const created = { id: `rl-${rows.length + 1}`, ...create };
            rows.push(created);
            return created;
          }
          row.attemptCount += update.attemptCount.increment;
          row.lastAttemptAt = update.lastAttemptAt;
          return row;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<RateLimitRow> }) => {
          const row = rows.find((entry) => entry.id === where.id);
          if (!row) throw new Error("missing rate limit row");
          Object.assign(row, data);
          return row;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: { scope: string; identifierHash: string }; data: Partial<RateLimitRow> }) => {
          let count = 0;
          for (const row of rows) {
            if (row.scope === where.scope && row.identifierHash === where.identifierHash) {
              Object.assign(row, data);
              count += 1;
            }
          }
          return { count };
        })
      }
    };
    const audit = { record: vi.fn(async () => undefined) };
    const service = new MobileRateLimitService(asPrismaService(prisma), asAuditService(audit));

    await service.assertAllowedAndRecord({ scope: "LOGIN", identifier: "raw-badge-or-token", maxAttempts: 1, windowSeconds: 900, lockSeconds: 900 });

    expect(rows[0].identifierHash).not.toContain("raw-badge-or-token");
    try {
      await service.assertAllowedAndRecord({ scope: "LOGIN", identifier: "raw-badge-or-token", maxAttempts: 1, windowSeconds: 900, lockSeconds: 900 });
      throw new Error("Expected rate limit lockout");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "RATE_LIMIT_LOCKOUT", metadata: { scope: "LOGIN" } }));
  });

  it("keeps successful attempts out of the failure budget and clears failures", async () => {
    const rows: RateLimitRow[] = [];
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof prisma) => Promise<RateLimitRow>) => callback(prisma)),
      mobileAuthRateLimit: {
        findFirst: vi.fn(async () => undefined),
        upsert: vi.fn(async ({ create, update, where }: { where: { scope_identifierHash_windowStart: { scope: string; identifierHash: string } }; create: RateLimitCreate; update: RateLimitUpdate }) => {
          const unique = where.scope_identifierHash_windowStart;
          const row = rows.find((entry) => entry.scope === unique.scope && entry.identifierHash === unique.identifierHash);
          if (!row) {
            const created = { id: "rl-1", ...create };
            rows.push(created);
            return created;
          }
          row.attemptCount += update.attemptCount.increment;
          return row;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<RateLimitRow> }) => Object.assign(rows.find((entry) => entry.id === where.id) ?? {}, data) as RateLimitRow),
        updateMany: vi.fn(async ({ data }: { data: Partial<RateLimitRow> }) => {
          rows.forEach((row) => Object.assign(row, data));
          return { count: rows.length };
        })
      }
    };
    const service = new MobileRateLimitService(asPrismaService(prisma), asAuditService({ record: vi.fn() }));

    await service.assertNotLocked({ scope: "LOGIN", identifier: "device-a" });
    expect(rows).toHaveLength(0);
    await service.recordFailure({ scope: "LOGIN", identifier: "device-a", maxAttempts: 10, windowSeconds: 900, lockSeconds: 900 });
    expect(rows[0].attemptCount).toBe(1);
    await service.clearFailures({ scope: "LOGIN", identifier: "device-a" });
    expect(rows[0].attemptCount).toBe(0);
    expect(rows[0].lockedUntil).toBeNull();
  });
});
