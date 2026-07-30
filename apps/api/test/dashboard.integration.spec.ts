import "reflect-metadata";

import { randomBytes, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.VIN_DECODER = "stub";
process.env.EMAIL_PROVIDER = "console";
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

describe("ADMIN-DASHBOARD01 company dashboard metrics", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    vi.useRealTimers();
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("returns real dashboard metrics for a company admin", async () => {
    const fixture = await createDashboardFixture();
    const dashboard = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/dashboard?date=2026-04-06`)
      .set("Cookie", fixture.adminSession)
      .expect(200);

    expect(dashboard.body.companyId).toBe(fixture.companyId);
    expect(dashboard.body.canManageCompany).toBe(true);
    expect(dashboard.body.today.activeEmployeesCount).toBe(2);
    expect(dashboard.body.today.clockedInNowCount).toBe(1);
    expect(dashboard.body.today.pendingReviewCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.today.openWorkOrdersCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.today.vehiclesReceivedTodayCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.today.inProgressWorkOrdersCount).toBeGreaterThanOrEqual(0);
    expect(dashboard.body.thisWeek.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(Array.isArray(dashboard.body.alerts)).toBe(true);
  });

  it("respects supervisor location scope on dashboard metrics", async () => {
    const fixture = await createDashboardFixture({ assignSupervisor: true });
    const supervisorSession = await login(fixture.supervisorEmail, fixture.supervisorPassword);

    const adminDashboard = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/dashboard?date=2026-04-06`)
      .set("Cookie", fixture.adminSession)
      .expect(200);

    const supervisorDashboard = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/dashboard?date=2026-04-06`)
      .set("Cookie", supervisorSession)
      .expect(200);

    expect(supervisorDashboard.body.canManageCompany).toBe(false);
    expect(supervisorDashboard.body.today.activeEmployeesCount).toBeNull();
    expect(supervisorDashboard.body.today.pendingInvitesCount).toBeNull();
    expect(supervisorDashboard.body.today.pendingReviewCount).toBeLessThanOrEqual(
      adminDashboard.body.today.pendingReviewCount
    );
    expect(supervisorDashboard.body.today.openWorkOrdersCount).toBeLessThanOrEqual(
      adminDashboard.body.today.openWorkOrdersCount
    );
  });

  it("forbids cross-company dashboard access", async () => {
    const alpha = await createDashboardFixture({ label: "Alpha" });
    const beta = await createDashboardFixture({ label: "Beta" });

    await request(httpServer)
      .get(`/company-operations/companies/${alpha.companyId}/dashboard`)
      .set("Cookie", beta.adminSession)
      .expect(403);
  });

  it("forbids authenticated users without company membership", async () => {
    const fixture = await createDashboardFixture();
    const outsiderEmail = `outsider-${randomBytes(4).toString("hex")}@example.com`;
    const outsiderPassword = "Outsider!123";

    await prisma.user.create({
      data: {
        email: outsiderEmail,
        passwordHash: await argon2.hash(outsiderPassword, ARGON2_OPTIONS),
        fullName: "Outsider User"
      }
    });

    const outsiderSession = await login(outsiderEmail, outsiderPassword);

    await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/dashboard`)
      .set("Cookie", outsiderSession)
      .expect(403);
  });

  async function createDashboardFixture(options?: {
    label?: string;
    assignSupervisor?: boolean;
  }) {
    const label = options?.label ?? "DashboardCo";
    const assignSupervisor = options?.assignSupervisor ?? false;
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const ownerEmail = `${label.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;

    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({ name: `${label} Group`, ownerEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: groupResponse.body.invitationToken,
        password: ownerPassword,
        fullName: `${label} Owner`
      })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);

    const adminEmail = `${label.toLowerCase()}-admin-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;
    const supervisorEmail = `${label.toLowerCase()}-supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = `Super!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: `${label} Company`, adminEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: adminPassword,
        fullName: `${label} Admin`
      })
      .expect(200);

    const companyId = companyResponse.body.company.id as string;
    const adminSession = await login(adminEmail, adminPassword);

    const supervisorUser = await prisma.user.create({
      data: {
        email: supervisorEmail,
        passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
        fullName: `${label} Supervisor`
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId,
        userId: supervisorUser.id,
        email: supervisorEmail,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      }
    });

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: `${label} Client` })
      .expect(201);

    const locationAResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: `${label} Site A`,
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    const locationBResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: `${label} Site B`,
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    if (assignSupervisor) {
      await request(httpServer)
        .post(`/company-operations/locations/${locationAResponse.body.id}/supervisors`)
        .set("Cookie", adminSession)
        .send({ supervisorUserId: supervisorUser.id })
        .expect(201);
    }

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Carlos Rivera", pin: "654321" })
      .expect(201);

    const employeeA = await prisma.employee.findFirstOrThrow({
      where: { companyId, fullName: "Maria Gomez" }
    });
    const employeeB = await prisma.employee.findFirstOrThrow({
      where: { companyId, fullName: "Carlos Rivera" }
    });

    const reviewShiftResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: employeeA.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationAResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    const reviewKiosk = await prisma.kiosk.create({
      data: {
        groupId: employeeA.groupId,
        companyId,
        locationId: locationAResponse.body.id,
        name: `${label} Review Kiosk`
      }
    });

    await prisma.punchEvent.createMany({
      data: [
        {
          groupId: employeeA.groupId,
          companyId,
          shiftId: reviewShiftResponse.body.id,
          employeeId: employeeA.id,
          kioskId: reviewKiosk.id,
          action: "CLOCK_IN",
          eventUtc: new Date("2026-04-06T13:00:00.000Z"),
          idempotencyKey: randomUUID()
        },
        {
          groupId: employeeA.groupId,
          companyId,
          shiftId: reviewShiftResponse.body.id,
          employeeId: employeeA.id,
          kioskId: reviewKiosk.id,
          action: "CLOCK_OUT",
          eventUtc: new Date("2026-04-06T21:00:00.000Z"),
          idempotencyKey: randomUUID()
        }
      ]
    });

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: employeeB.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationBResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    const vehicleResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: "1HGBH41JXMN109186",
        serviceClientId: clientResponse.body.id,
        locationId: locationAResponse.body.id
      })
      .expect(201);

    const catalogResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", adminSession)
      .send({ name: "Detail", fixedPriceMinor: 9900 })
      .expect(201);

    const workOrderResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", adminSession)
      .send({
        vehicleId: vehicleResponse.body.id,
        serviceCatalogItemIds: [catalogResponse.body.id]
      })
      .expect(201);

    await prisma.workOrder.update({
      where: { id: workOrderResponse.body.id },
      data: { createdAt: new Date("2026-04-06T16:00:00.000Z") }
    });

    const kioskSecret = `kiosk-${randomBytes(8).toString("hex")}`;
    const kiosk = await prisma.kiosk.create({
      data: {
        groupId: employeeA.groupId,
        companyId,
        locationId: locationBResponse.body.id,
        name: `${label} Kiosk`
      }
    });
    await prisma.kioskCredential.create({
      data: {
        kioskId: kiosk.id,
        secretHash: await argon2.hash(kioskSecret, ARGON2_OPTIONS)
      }
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T21:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set({
        "x-kiosk-id": kiosk.id,
        "x-kiosk-secret": kioskSecret
      })
      .send({ pin: "654321", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);

    vi.useRealTimers();

    return {
      companyId,
      adminSession,
      supervisorEmail,
      supervisorPassword
    };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    return cookies!.map((cookie) => cookie.split(";")[0]).join("; ");
  }
});
