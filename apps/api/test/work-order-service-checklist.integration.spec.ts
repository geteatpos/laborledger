import "reflect-metadata";

import { randomBytes } from "node:crypto";

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

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const KNOWN_VIN = "1HGBH41JXMN109186";

describe("work order service checklist (phase 1)", () => {
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

  it("scopes catalog by company, snapshots price on mark, blocks empty finalize, hides price in job options", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const adminBSession = await login(setupB.adminEmail, setupB.adminPassword);

    const seedA = await seedOpenWorkOrder(httpServer, adminASession, setupA.companyId, {
      washName: "Exterior Wash",
      washPrice: 8000,
      interiorName: "Interior Detail",
      interiorPrice: 12500,
      employeeName: "Maria Gomez",
      pin: "123456"
    });

    await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/service-catalog`)
      .set("Cookie", adminBSession)
      .send({ name: "Beta Only Detail", fixedPriceMinor: 5000, sortOrder: 1 })
      .expect(201);

    const listA = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(listA.body.map((row: { name: string }) => row.name)).not.toContain("Beta Only Detail");

    await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminBSession)
      .expect(403);

    const jobOptions = await request(httpServer)
      .post("/worker/jobs/options")
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(201);

    expect(jobOptions.body.serviceCatalogItems?.length).toBeGreaterThan(0);
    for (const item of jobOptions.body.serviceCatalogItems as Array<Record<string, unknown>>) {
      expect(item).not.toHaveProperty("fixedPriceMinor");
      expect(item).not.toHaveProperty("price");
      expect(item).not.toHaveProperty("unitPriceMinor");
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
    }
    expect(JSON.stringify(jobOptions.body).toLowerCase()).not.toContain("fixedpriceminor");

    await request(httpServer)
      .post(`/worker/work-orders/${seedA.workOrderId}/finalize`)
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(400);

    const mark = await request(httpServer)
      .post(`/worker/work-orders/${seedA.workOrderId}/services/mark`)
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        serviceCatalogItemId: seedA.interiorCatalogItemId
      })
      .expect(201);

    expect(mark.body.serviceName).toBe("Interior Detail");
    expect(mark.body).not.toHaveProperty("unitPriceMinor");
    expect(mark.body).not.toHaveProperty("fixedPriceMinor");
    expect(JSON.stringify(mark.body).toLowerCase()).not.toContain("12500");

    const markedLine = await prisma.workOrderServiceLine.findFirst({
      where: {
        workOrderId: seedA.workOrderId,
        serviceCatalogItemId: seedA.interiorCatalogItemId
      }
    });
    expect(markedLine?.unitPriceMinor).toBe(12500);

    await request(httpServer)
      .post(`/company-operations/service-catalog/${seedA.interiorCatalogItemId}`)
      .set("Cookie", adminASession)
      .send({
        name: "Interior Detail",
        fixedPriceMinor: 19900,
        sortOrder: 2
      })
      .expect(201);

    const lineAfterPriceChange = await prisma.workOrderServiceLine.findFirst({
      where: {
        workOrderId: seedA.workOrderId,
        serviceCatalogItemId: seedA.interiorCatalogItemId
      }
    });
    expect(lineAfterPriceChange?.unitPriceMinor).toBe(12500);

    await request(httpServer)
      .post(`/worker/work-orders/${seedA.workOrderId}/services/mark`)
      .send({
        companyId: setupB.companyId,
        pin: "123456",
        serviceCatalogItemId: seedA.interiorCatalogItemId
      })
      .expect(401);

    const finalized = await request(httpServer)
      .post(`/worker/work-orders/${seedA.workOrderId}/finalize`)
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(201);

    expect(finalized.body.status).toBe("COMPLETED");
    expect(finalized.body.finishedAt).toBeTruthy();
    expect(finalized.body.startedAt).toBeTruthy();

    await request(httpServer)
      .post(`/worker/work-orders/${seedA.workOrderId}/services/unmark`)
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        serviceCatalogItemId: seedA.interiorCatalogItemId
      })
      .expect(400);

    const adminDetail = await request(httpServer)
      .get(`/company-operations/work-orders/${seedA.workOrderId}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(adminDetail.body.status).toBe("COMPLETED");
    expect(adminDetail.body.startedAt).toBeTruthy();
    expect(adminDetail.body.finishedAt).toBeTruthy();
    expect(adminDetail.body.totalDurationMs).toBeTypeOf("number");
    const interiorLine = (
      adminDetail.body.serviceLines as Array<{
        serviceCatalogItemId: string;
        unitPriceMinor: number;
        activeCompletion: { employee: { fullName: string } } | null;
      }>
    ).find((line) => line.serviceCatalogItemId === seedA.interiorCatalogItemId);
    expect(interiorLine?.unitPriceMinor).toBe(12500);
    expect(interiorLine?.activeCompletion?.employee.fullName).toBe("Maria Gomez");
  });

  it("marks and unmarks checklist services on an open work order", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setupA = await createCompanyWithAdmin(superadminSession, "Gamma", "gamma-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const seed = await seedOpenWorkOrder(httpServer, adminASession, setupA.companyId, {
      washName: "Basic Wash",
      washPrice: 5000,
      interiorName: "Engine Bay",
      interiorPrice: 7500,
      employeeName: "Ana Lopez",
      pin: "111222"
    });

    await request(httpServer)
      .post(`/worker/work-orders/${seed.workOrderId}/services/mark`)
      .send({
        companyId: setupA.companyId,
        pin: "111222",
        serviceCatalogItemId: seed.interiorCatalogItemId
      })
      .expect(201);

    await request(httpServer)
      .post(`/worker/work-orders/${seed.workOrderId}/services/unmark`)
      .send({
        companyId: setupA.companyId,
        pin: "111222",
        serviceCatalogItemId: seed.interiorCatalogItemId
      })
      .expect(201);

    const remaining = await prisma.workOrderServiceLine.findFirst({
      where: {
        workOrderId: seed.workOrderId,
        serviceCatalogItemId: seed.interiorCatalogItemId
      }
    });
    expect(remaining).toBeNull();

    await request(httpServer)
      .post(`/worker/work-orders/${seed.workOrderId}/finalize`)
      .send({ companyId: setupA.companyId, pin: "111222" })
      .expect(400);
  });

  async function seedOpenWorkOrder(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string,
    opts: {
      washName: string;
      washPrice: number;
      interiorName: string;
      interiorPrice: number;
      employeeName: string;
      pin: string;
    }
  ) {
    const clientResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", session)
      .send({ name: "Client A" })
      .expect(201);

    const locationResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", session)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);

    const vehicleResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", session)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id
      })
      .expect(201);

    const wash = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: opts.washName, fixedPriceMinor: opts.washPrice, sortOrder: 1 })
      .expect(201);

    const interior = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: opts.interiorName, fixedPriceMinor: opts.interiorPrice, sortOrder: 2 })
      .expect(201);

    await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: opts.employeeName, pin: opts.pin })
      .expect(201);

    const workOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleResponse.body.id,
        serviceCatalogItemIds: [wash.body.id],
        status: "READY"
      })
      .expect(201);

    expect(workOrder.body.startedAt).toBeTruthy();

    return {
      workOrderId: workOrder.body.id as string,
      washCatalogItemId: wash.body.id as string,
      interiorCatalogItemId: interior.body.id as string
    };
  }

  async function createCompanyWithAdmin(
    superadminSession: string,
    groupLabel: string,
    adminPrefix: string
  ) {
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
