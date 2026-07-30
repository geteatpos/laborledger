import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { GlobalRole, PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";
import { AppModule } from "../src/modules/app.module";
import { hashMobileSecret } from "../src/modules/mobile/mobile-secret-hash";

const dbUrl = process.env.DATABASE_URL ?? "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";
process.env.MOBILE_AUTH_HASH_PEPPER = "test-mobile-auth-hash-pepper-000000000000000000";
const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("mobile bearer guard", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;
  beforeAll(async () => { app = await NestFactory.create(AppModule, { logger: false }); await app.init(); httpServer = app.getHttpServer(); });
  beforeEach(async () => resetIntegrationDatabase(prisma));
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("rejects missing, expired, revoked-session, and revoked-device bearer access", async () => {
    await request(httpServer).get("/mobile/auth/me").expect(401);
    const fixture = await seedSessionFixture();
    await request(httpServer).get("/mobile/auth/me").set("Authorization", `Bearer ${fixture.rawToken}`).expect(200);
    await prisma.mobileSession.update({ where: { id: fixture.sessionId }, data: { revokedAt: new Date(), revocationReason: "test" } });
    await request(httpServer).get("/mobile/auth/me").set("Authorization", `Bearer ${fixture.rawToken}`).expect(401);
    await prisma.mobileSession.update({ where: { id: fixture.sessionId }, data: { revokedAt: null, expiresAt: new Date(Date.now() - 1000) } });
    await request(httpServer).get("/mobile/auth/me").set("Authorization", `Bearer ${fixture.rawToken}`).expect(401);
    await prisma.mobileSession.update({ where: { id: fixture.sessionId }, data: { expiresAt: new Date(Date.now() + 60000) } });
    await prisma.mobileDevice.update({ where: { id: fixture.deviceId }, data: { status: "REVOKED", revokedAt: new Date() } });
    await request(httpServer).get("/mobile/auth/me").set("Authorization", `Bearer ${fixture.rawToken}`).expect(401);
  });

  async function seedSessionFixture() {
    const group = await prisma.group.create({ data: { name: "guard group", status: "ACTIVE" } });
    const company = await prisma.company.create({ data: { groupId: group.id, name: "guard company" } });
    const user = await prisma.user.create({ data: { email: `guard-${randomBytes(3).toString("hex")}@example.test`, fullName: "Guard Admin", passwordHash: "x", globalRole: GlobalRole.NONE } });
    const client = await prisma.serviceClient.create({ data: { groupId: group.id, companyId: company.id, name: "Client" } });
    const location = await prisma.location.create({ data: { groupId: group.id, companyId: company.id, serviceClientId: client.id, name: "Main", timezone: "UTC" } });
    const employee = await prisma.employee.create({ data: { groupId: group.id, companyId: company.id, fullName: "Guard Employee" } });
    const device = await prisma.mobileDevice.create({ data: { groupId: group.id, companyId: company.id, locationId: location.id, androidIdHash: hashMobileSecret("android-hash", "mobile-secret"), enrolledByUserId: user.id } });
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashMobileSecret(rawToken, "mobile-session");
    const session = await prisma.mobileSession.create({ data: { groupId: group.id, companyId: company.id, locationId: location.id, deviceId: device.id, employeeId: employee.id, tokenHash, tokenHashPrefix: tokenHash.slice(0, 12), expiresAt: new Date(Date.now() + 60000) } });
    return { rawToken, sessionId: session.id, deviceId: device.id };
  }
});
