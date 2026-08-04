import "reflect-metadata";

import { createHash, randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.VIN_DECODER = "stub";
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";
process.env.MOBILE_AUTH_HASH_PEPPER = "bulk-remove-test-mobile-hash-pepper-32chars";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("supervisor location bulk removal", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("removes selected locations in bulk and audits each unassignment", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setup = await createCompanyWithAdmin(superadminSession, "Epsilon", "epsilon-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    const supervisor = await inviteAndAccept(adminSession, setup.companyId, "SUPERVISOR", "epsilon-supervisor@example.com");
    const supervisorRecord = await prisma.user.findUniqueOrThrow({ where: { email: supervisor.email } });

    const serviceClientResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: "Epsilon Client" })
      .expect(201);
    const serviceClientId = serviceClientResponse.body.id as string;

    const locationIds: string[] = [];
    for (const name of ["Location A", "Location B", "Location C"]) {
      const locationResponse = await request(httpServer)
        .post(`/company-operations/companies/${setup.companyId}/locations`)
        .set("Cookie", adminSession)
        .send({ name, timezone: "America/New_York", serviceClientId })
        .expect(201);
      locationIds.push(locationResponse.body.id as string);
    }

    for (const locationId of locationIds) {
      await request(httpServer)
        .post(`/company-operations/companies/${setup.companyId}/supervisors/${supervisorRecord.id}/locations`)
        .set("Cookie", adminSession)
        .send({ locationId })
        .expect(201);
    }

    // Empty selection is rejected.
    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/supervisors/${supervisorRecord.id}/locations/bulk-remove`)
      .set("Cookie", adminSession)
      .send({ locationIds: [] })
      .expect(400);

    // Remove two of the three in one bulk call.
    const [locationA, locationB, locationC] = locationIds;
    const bulkResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/supervisors/${supervisorRecord.id}/locations/bulk-remove`)
      .set("Cookie", adminSession)
      .send({ locationIds: [locationA, locationB] })
      .expect(201);

    expect(bulkResponse.body.removedCount).toBe(2);

    const remainingAssignments = await prisma.supervisorLocationAssignment.findMany({
      where: { companyId: setup.companyId, supervisorUserId: supervisorRecord.id, unassignedAt: null }
    });
    expect(remainingAssignments).toHaveLength(1);
    expect(remainingAssignments[0]?.locationId).toBe(locationC);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { action: "SUPERVISOR_LOCATION_UNASSIGNED", companyId: setup.companyId }
    });
    expect(auditEvents).toHaveLength(2);
    for (const event of auditEvents) {
      expect((event.metadata as Record<string, unknown>).bulk).toBe(true);
      expect((event.metadata as Record<string, unknown>).bulkCount).toBe(2);
    }
  });

  async function inviteAndAccept(
    adminSession: string,
    companyId: string,
    role: "COMPANY_ADMIN" | "SUPERVISOR",
    email: string
  ) {
    const password = `Invitee!${randomBytes(4).toString("hex")}`;

    const invite = await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", adminSession)
      .send({ companyId, email, role })
      .expect(201);

    const rawToken = randomBytes(32).toString("base64url");
    await prisma.invitation.update({
      where: { id: invite.body.id },
      data: { tokenHash: createHash("sha256").update(rawToken).digest("hex") }
    });

    await request(httpServer)
      .post("/auth/invitations/accept")
      .send({ token: rawToken, password, name: email })
      .expect(200);

    return { email, password };
  }

  async function createCompanyWithAdmin(superadminSession: string, groupLabel: string, adminPrefix: string) {
    const ownerEmail = `${groupLabel.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;

    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({
        name: `${groupLabel} Group`,
        ownerEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: groupResponse.body.invitationToken,
        password: ownerPassword,
        fullName: `${groupLabel} Owner`
      })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);

    const adminEmail = `${adminPrefix}-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({
        name: `${groupLabel} Company`,
        adminEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: adminPassword,
        fullName: `${groupLabel} Admin`
      })
      .expect(200);

    return {
      companyId: companyResponse.body.company.id as string,
      adminEmail,
      adminPassword
    };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    return cookies?.[0] ?? "";
  }
});
