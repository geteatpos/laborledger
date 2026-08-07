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
process.env.MOBILE_AUTH_HASH_PEPPER = "membership-test-mobile-hash-pepper-32chars";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("company membership management", () => {
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

  it("lists active members, blocks self-revoke and last-admin changes, allows valid revoke/role-change, and audits both", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setup = await createCompanyWithAdmin(superadminSession, "Gamma", "gamma-admin");
    const admin1Session = await login(setup.adminEmail, setup.adminPassword);

    const admin2 = await inviteAndAccept(admin1Session, setup.companyId, "COMPANY_ADMIN", "second-admin@example.com");
    const supervisor = await inviteAndAccept(admin1Session, setup.companyId, "SUPERVISOR", "supervisor@example.com");

    const membersResponse = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/members`)
      .set("Cookie", admin1Session)
      .expect(200);

    expect(membersResponse.body).toHaveLength(3);
    const admin1Membership = membersResponse.body.find((m: { email: string }) => m.email === setup.adminEmail);
    const admin2Membership = membersResponse.body.find((m: { email: string }) => m.email === admin2.email);
    const supervisorMembership = membersResponse.body.find((m: { email: string }) => m.email === supervisor.email);

    expect(admin1Membership.role).toBe("COMPANY_ADMIN");
    expect(admin2Membership.role).toBe("COMPANY_ADMIN");
    expect(supervisorMembership.role).toBe("SUPERVISOR");
    expect(supervisorMembership.assignedLocationCount).toBe(0);

    // Cannot revoke your own access.
    const selfRevoke = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/members/${admin1Membership.membershipId}/revoke`)
      .set("Cookie", admin1Session)
      .expect(400);
    expect(selfRevoke.body.message).toMatch(/propio acceso/u);

    // Revoking the supervisor succeeds and is audited.
    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/members/${supervisorMembership.membershipId}/revoke`)
      .set("Cookie", admin1Session)
      .expect(201);

    const revokedMembership = await prisma.companyMembership.findUnique({
      where: { id: supervisorMembership.membershipId }
    });
    expect(revokedMembership?.status).toBe("REVOKED");

    const revokeAuditEvent = await prisma.auditEvent.findFirst({
      where: { action: "COMPANY_MEMBERSHIP_REVOKED", targetId: supervisorMembership.membershipId }
    });
    expect(revokeAuditEvent).not.toBeNull();
    expect(revokeAuditEvent?.actorUserId).toBeTruthy();

    // Revoking the other admin succeeds (admin1 remains as the sole admin).
    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/members/${admin2Membership.membershipId}/revoke`)
      .set("Cookie", admin1Session)
      .expect(201);

    // Now admin1 is the last active admin — changing their own role must be blocked.
    const lastAdminRoleChange = await request(httpServer)
      .patch(`/company-operations/companies/${setup.companyId}/members/${admin1Membership.membershipId}`)
      .set("Cookie", admin1Session)
      .send({ role: "SUPERVISOR" })
      .expect(400);
    expect(lastAdminRoleChange.body.message).toMatch(/único administrador/u);

    const finalMembers = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/members`)
      .set("Cookie", admin1Session)
      .expect(200);
    expect(finalMembers.body).toHaveLength(1);
    expect(finalMembers.body[0].role).toBe("COMPANY_ADMIN");
  });

  it("allows a valid role change and audits it", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setup = await createCompanyWithAdmin(superadminSession, "Delta", "delta-admin");
    const admin1Session = await login(setup.adminEmail, setup.adminPassword);
    const admin2 = await inviteAndAccept(admin1Session, setup.companyId, "COMPANY_ADMIN", "delta-second@example.com");

    const membersResponse = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/members`)
      .set("Cookie", admin1Session)
      .expect(200);
    const admin2Membership = membersResponse.body.find((m: { email: string }) => m.email === admin2.email);

    await request(httpServer)
      .patch(`/company-operations/companies/${setup.companyId}/members/${admin2Membership.membershipId}`)
      .set("Cookie", admin1Session)
      .send({ role: "SUPERVISOR" })
      .expect(200);

    const updated = await prisma.companyMembership.findUnique({ where: { id: admin2Membership.membershipId } });
    expect(updated?.role).toBe("SUPERVISOR");

    const roleChangeAuditEvent = await prisma.auditEvent.findFirst({
      where: { action: "COMPANY_MEMBERSHIP_ROLE_CHANGED", targetId: admin2Membership.membershipId }
    });
    expect(roleChangeAuditEvent).not.toBeNull();
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
