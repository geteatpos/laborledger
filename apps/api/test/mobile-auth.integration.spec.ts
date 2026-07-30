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

const dbUrl = process.env.DATABASE_URL ?? "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";
process.env.MOBILE_AUTH_HASH_PEPPER = "test-mobile-auth-hash-pepper-000000000000000000";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("mobile auth enrollment, login, me, and logout", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => resetIntegrationDatabase(prisma));
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("issues an opaque bearer token and never returns raw stored hashes", async () => {
    const fixture = await seedMobileFixture();
    const adminCookie = await login(fixture.adminEmail, fixture.adminPassword);
    const tokenResponse = await request(httpServer).post("/mobile/devices/enrollment-tokens").set("Cookie", adminCookie).send({ companyId: fixture.companyId, locationId: fixture.locationId }).expect(201);
    expect(tokenResponse.body.enrollmentToken).toBeTruthy();
    expect(JSON.stringify(tokenResponse.body).toLowerCase()).not.toContain("tokenhash");

    const enrollResponse = await request(httpServer).post("/mobile/devices/enroll").send({ enrollmentToken: tokenResponse.body.enrollmentToken, androidId: "android-alpha", label: "Shop handset" }).expect(201);
    expect(JSON.stringify(enrollResponse.body).toLowerCase()).not.toContain("android");

    await request(httpServer).post(`/mobile/admin/companies/${fixture.companyId}/employees/${fixture.employeeId}/badges/register`).set("Cookie", adminCookie).send({ locationId: fixture.locationId, badgeUid: "badge-alpha", deviceId: enrollResponse.body.device.id }).expect(201);
    const loginResponse = await request(httpServer).post("/mobile/auth/login").send({ deviceId: enrollResponse.body.device.id, badgeUid: "badge-alpha", pin: fixture.pin }).expect(200);
    expect(loginResponse.body.accessToken).toBeTruthy();
    expect(loginResponse.body.accessToken).not.toContain("badge-alpha");
    expect(JSON.stringify(loginResponse.body).toLowerCase()).not.toContain("tokenhash");

    await request(httpServer).get("/mobile/auth/me").set("Authorization", `Bearer ${loginResponse.body.accessToken}`).expect(200).expect((response) => {
      expect(response.body.employee.id).toBe(fixture.employeeId);
      expect(response.body.session.companyId).toBe(fixture.companyId);
      expect(response.body.session.locationId).toBe(fixture.locationId);
    });

    await request(httpServer).post("/mobile/auth/logout").set("Authorization", `Bearer ${loginResponse.body.accessToken}`).send({}).expect(200);
    await request(httpServer).get("/mobile/auth/me").set("Authorization", `Bearer ${loginResponse.body.accessToken}`).expect(401);
  });

  it("does not spend login failure budget on successful repeated PIN logins but locks after bad PINs", async () => {
    const fixture = await seedMobileFixture();
    const adminCookie = await login(fixture.adminEmail, fixture.adminPassword);
    const tokenResponse = await request(httpServer).post("/mobile/devices/enrollment-tokens").set("Cookie", adminCookie).send({ companyId: fixture.companyId, locationId: fixture.locationId }).expect(201);
    const enrollResponse = await request(httpServer).post("/mobile/devices/enroll").send({ enrollmentToken: tokenResponse.body.enrollmentToken, androidId: "android-rate" }).expect(201);
    await request(httpServer).post(`/mobile/admin/companies/${fixture.companyId}/employees/${fixture.employeeId}/badges/register`).set("Cookie", adminCookie).send({ locationId: fixture.locationId, badgeUid: "badge-rate", deviceId: enrollResponse.body.device.id }).expect(201);

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await request(httpServer).post("/mobile/auth/login").send({ deviceId: enrollResponse.body.device.id, badgeUid: "badge-rate", pin: fixture.pin }).expect(200);
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(httpServer).post("/mobile/auth/login").send({ deviceId: enrollResponse.body.device.id, badgeUid: "badge-rate", pin: "000000" }).expect(401);
    }
    await request(httpServer).post("/mobile/auth/login").send({ deviceId: enrollResponse.body.device.id, badgeUid: "badge-rate", pin: "000000" }).expect(429);
    await request(httpServer).post("/mobile/auth/login").send({ deviceId: enrollResponse.body.device.id, badgeUid: "badge-rate", pin: fixture.pin }).expect(429);
  });

  async function seedMobileFixture() {
    const group = await prisma.group.create({ data: { name: `Group ${randomBytes(3).toString("hex")}`, status: "ACTIVE" } });
    const company = await prisma.company.create({ data: { groupId: group.id, name: `Company ${randomBytes(3).toString("hex")}` } });
    const client = await prisma.serviceClient.create({ data: { groupId: group.id, companyId: company.id, name: "Client" } });
    const location = await prisma.location.create({ data: { groupId: group.id, companyId: company.id, serviceClientId: client.id, name: "Main", timezone: "UTC" } });
    const employee = await prisma.employee.create({ data: { groupId: group.id, companyId: company.id, fullName: "Mobile Employee" } });
    const admin = await prisma.user.create({ data: { email: `admin-${randomBytes(3).toString("hex")}@example.test`, fullName: "Admin", passwordHash: await import("argon2").then((argon2) => argon2.hash("Admin!12345")), globalRole: GlobalRole.NONE } });
    await prisma.companyMembership.create({ data: { companyId: company.id, userId: admin.id, email: admin.email, role: "COMPANY_ADMIN", status: "ACTIVE" } });
    const pin = "123456";
    await prisma.employeePinCredential.create({ data: { employeeId: employee.id, companyId: company.id, pinHash: await argon2.hash(pin), createdByUserId: admin.id } });
    return { groupId: group.id, companyId: company.id, locationId: location.id, employeeId: employee.id, adminEmail: admin.email, adminPassword: "Admin!12345", pin };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return (response.headers["set-cookie"] as string[])[0];
  }
});
