import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { GlobalRole } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  configureIntegrationTestEnv,
  createIntegrationPrisma,
  resetIntegrationDatabase
} from "./integration-test-db";
import { AppModule } from "../src/modules/app.module";
import { hashMobileSecret } from "../src/modules/mobile/mobile-secret-hash";

configureIntegrationTestEnv({
  MOBILE_AUTH_HASH_PEPPER: "test-mobile-auth-hash-pepper-000000000000000000"
});
const prisma = createIntegrationPrisma();

describe("mobile device administration", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;
  beforeAll(async () => { app = await NestFactory.create(AppModule, { logger: false }); await app.init(); httpServer = app.getHttpServer(); });
  beforeEach(async () => resetIntegrationDatabase(prisma));
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("denies supervisors, lists only company devices, and reactivates revoked devices with a new admin token", async () => {
    const alpha = await seedCompany("alpha");
    const beta = await seedCompany("beta");
    const adminCookie = await login(alpha.adminEmail, alpha.password);
    const supervisorCookie = await login(alpha.supervisorEmail, alpha.password);

    await request(httpServer).post("/mobile/devices/enrollment-tokens").set("Cookie", supervisorCookie).send({ companyId: alpha.companyId, locationId: alpha.locationId }).expect(403);
    const token = await request(httpServer).post("/mobile/devices/enrollment-tokens").set("Cookie", adminCookie).send({ companyId: alpha.companyId, locationId: alpha.locationId }).expect(201);
    const enrolled = await request(httpServer).post("/mobile/devices/enroll").send({ enrollmentToken: token.body.enrollmentToken, androidId: "android-revoke" }).expect(201);
    await prisma.mobileDevice.create({ data: { groupId: beta.groupId, companyId: beta.companyId, locationId: beta.locationId, androidIdHash: hashMobileSecret(`other-${randomBytes(4).toString("hex")}`, "mobile-secret"), enrolledByUserId: beta.adminUserId } });

    const list = await request(httpServer).get(`/mobile/devices?companyId=${alpha.companyId}`).set("Cookie", adminCookie).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].companyId).toBe(alpha.companyId);

    await request(httpServer).post(`/mobile/devices/${enrolled.body.device.id}/revoke`).set("Cookie", adminCookie).send({ reason: "lost" }).expect(200);
    const replacementToken = await request(httpServer).post("/mobile/devices/enrollment-tokens").set("Cookie", adminCookie).send({ companyId: alpha.companyId, locationId: alpha.locationId, deviceLabel: "Bay tablet" }).expect(201);
    const reactivated = await request(httpServer)
      .post("/mobile/devices/enroll")
      .send({ enrollmentToken: replacementToken.body.enrollmentToken, androidId: "android-revoke", label: "Bay tablet" })
      .expect(201);
    expect(reactivated.body.device.id).toBe(enrolled.body.device.id);
    expect(reactivated.body.device.status).toBe("ACTIVE");
    expect(reactivated.body.device.label).toBe("Bay tablet");
    expect(reactivated.body.device.revokedAt).toBeNull();

    const duplicate = await request(httpServer)
      .post("/mobile/devices/enrollment-tokens")
      .set("Cookie", adminCookie)
      .send({ companyId: alpha.companyId, locationId: alpha.locationId, deviceLabel: "Bay tablet again" })
      .expect(201);
    const idempotent = await request(httpServer)
      .post("/mobile/devices/enroll")
      .send({ enrollmentToken: duplicate.body.enrollmentToken, androidId: "android-revoke", label: "Bay tablet again" })
      .expect(201);
    expect(idempotent.body.device.id).toBe(enrolled.body.device.id);
    expect(idempotent.body.device.status).toBe("ACTIVE");
    expect(idempotent.body.device.label).toBe("Bay tablet again");

    const audit = await prisma.mobileAuthAuditEvent.findFirst({
      where: { deviceId: enrolled.body.device.id, action: "DEVICE_REACTIVATED" },
      orderBy: { createdAt: "desc" }
    });
    expect(audit?.outcome).toBe("SUCCESS");
    expect(audit?.reason).toBe("admin_reenroll");
  });

  async function seedCompany(label: string) {
    const group = await prisma.group.create({ data: { name: `${label} group`, status: "ACTIVE" } });
    const company = await prisma.company.create({ data: { groupId: group.id, name: `${label} company` } });
    const client = await prisma.serviceClient.create({ data: { groupId: group.id, companyId: company.id, name: `${label} client` } });
    const location = await prisma.location.create({ data: { groupId: group.id, companyId: company.id, serviceClientId: client.id, name: `${label} location`, timezone: "UTC" } });
    const password = "Admin!12345";
    const admin = await prisma.user.create({ data: { email: `${label}-admin-${randomBytes(3).toString("hex")}@example.test`, fullName: "Admin", passwordHash: await argon2.hash(password), globalRole: GlobalRole.NONE } });
    const supervisor = await prisma.user.create({ data: { email: `${label}-sup-${randomBytes(3).toString("hex")}@example.test`, fullName: "Sup", passwordHash: await argon2.hash(password), globalRole: GlobalRole.NONE } });
    await prisma.companyMembership.createMany({ data: [{ companyId: company.id, userId: admin.id, email: admin.email, role: "COMPANY_ADMIN", status: "ACTIVE" }, { companyId: company.id, userId: supervisor.id, email: supervisor.email, role: "SUPERVISOR", status: "ACTIVE" }] });
    return { groupId: group.id, companyId: company.id, locationId: location.id, adminEmail: admin.email, supervisorEmail: supervisor.email, adminUserId: admin.id, password };
  }
  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return (response.headers["set-cookie"] as string[])[0];
  }
});
