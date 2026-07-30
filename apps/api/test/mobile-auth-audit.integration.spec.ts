import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { GlobalRole, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

describe("mobile auth audit hygiene", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;
  beforeAll(async () => { app = await NestFactory.create(AppModule, { logger: false }); await app.init(); httpServer = app.getHttpServer(); });
  beforeEach(async () => resetIntegrationDatabase(prisma));
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("records safe audit IDs for badge provisioning and login without raw credentials", async () => {
    const fixture = await seedFixture();
    const cookie = await login(fixture.adminEmail, fixture.password);
    await request(httpServer).post(`/mobile/admin/companies/${fixture.companyId}/employees/${fixture.employeeId}/badges/register`).set("Cookie", cookie).send({ locationId: fixture.locationId, badgeUid: "raw-badge-audit" }).expect(201);
    const device = await prisma.mobileDevice.create({ data: { groupId: fixture.groupId, companyId: fixture.companyId, locationId: fixture.locationId, androidIdHash: hashMobileSecret("raw-android-audit", "mobile-secret"), enrolledByUserId: fixture.adminUserId } });
    await request(httpServer).post("/mobile/auth/login").send({ deviceId: device.id, badgeUid: "raw-badge-audit", pin: fixture.pin }).expect(200);
    const badge = await prisma.employeeBadgeCredential.findFirstOrThrow({ where: { employeeId: fixture.employeeId } });
    await request(httpServer).post(`/mobile/admin/badges/${badge.id}/revoke`).set("Cookie", cookie).send({ reason: "lost bearer=abcdefghijklmnopqrstuvwxyz1234567890" }).expect(200);
    const auditEvents = await prisma.mobileAuthAuditEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(auditEvents.map((event) => event.action)).toEqual(expect.arrayContaining(["BADGE_REGISTERED", "LOGIN_SUCCEEDED"]));
    const serialized = JSON.stringify(auditEvents);
    expect(serialized).not.toContain("raw-badge-audit");
    expect(serialized).not.toContain("raw-android-audit");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyz1234567890");
  });

  async function seedFixture() {
    const group = await prisma.group.create({ data: { name: "audit group", status: "ACTIVE" } });
    const company = await prisma.company.create({ data: { groupId: group.id, name: "audit company" } });
    const client = await prisma.serviceClient.create({ data: { groupId: group.id, companyId: company.id, name: "Client" } });
    const location = await prisma.location.create({ data: { groupId: group.id, companyId: company.id, serviceClientId: client.id, name: "Main", timezone: "UTC" } });
    const employee = await prisma.employee.create({ data: { groupId: group.id, companyId: company.id, fullName: "Audit Employee" } });
    const password = "Admin!12345";
    const admin = await prisma.user.create({ data: { email: `audit-admin-${randomBytes(3).toString("hex")}@example.test`, fullName: "Admin", passwordHash: await argon2.hash(password), globalRole: GlobalRole.NONE } });
    await prisma.companyMembership.create({ data: { companyId: company.id, userId: admin.id, email: admin.email, role: "COMPANY_ADMIN", status: "ACTIVE" } });
    const pin = "123456";
    await prisma.employeePinCredential.create({ data: { employeeId: employee.id, companyId: company.id, pinHash: await argon2.hash(pin), createdByUserId: admin.id } });
    return { groupId: group.id, companyId: company.id, locationId: location.id, employeeId: employee.id, adminUserId: admin.id, adminEmail: admin.email, password, pin };
  }
  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return (response.headers["set-cookie"] as string[])[0];
  }
});
