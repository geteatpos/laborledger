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
process.env.MOBILE_AUTH_HASH_PEPPER = "invoice-test-mobile-hash-pepper-32chars";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const KNOWN_VIN = "1HGBH41JXMN109186";

describe("client invoice foundation", () => {
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

  it("creates draft invoices from completed work orders, issues immutable snapshots, and voids with audit", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const adminBSession = await login(setupB.adminEmail, setupB.adminPassword);

    const settings = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/billing-settings`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(settings.body.invoicePrefix).toBe("INV");
    expect(settings.body.paymentTermsDays).toBe(30);

    await request(httpServer)
      .patch(`/company-operations/companies/${setupA.companyId}/billing-settings`)
      .set("Cookie", adminBSession)
      .send({ paymentTermsDays: 15 })
      .expect(403);

    await request(httpServer)
      .patch(`/company-operations/companies/${setupA.companyId}/billing-settings`)
      .set("Cookie", adminASession)
      .send({ invoicePrefix: "AR", paymentTermsDays: 15, defaultNotes: "Pay promptly" })
      .expect(200);

    const seed = await seedCompletedWorkOrder(httpServer, adminASession, setupA.companyId);
    const incomplete = await seedAssignedIncompleteWorkOrder(httpServer, adminASession, setupA.companyId, seed);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [incomplete.workOrderId]
      })
      .expect(400);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId],
        notes: "Monthly service"
      })
      .expect(201);

    expect(draft.body.status).toBe("DRAFT");
    expect(draft.body.invoiceNumber).toBeNull();
    expect(draft.body.taxMinor).toBe(0);
    expect(draft.body.lines).toHaveLength(1);
    expect(draft.body.lines[0].vinSnapshot).toBe(KNOWN_VIN);
    expect(draft.body.lines[0].serviceNameSnapshot).toBe("Oil Change");

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/service-catalog/${seed.catalogItemId}`)
      .set("Cookie", adminASession)
      .send({ name: "Oil Change", fixedPriceMinor: 15000 })
      .expect(201);

    const issued = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    expect(issued.body.status).toBe("ISSUED");
    expect(issued.body.invoiceNumber).toMatch(/^AR-\d{8}-\d{4}$/u);
    expect(issued.body.issuedAt).toBeTruthy();
    expect(issued.body.paymentTermsDays).toBe(15);
    expect(issued.body.dueDate).toBeTruthy();
    expect(issued.body.amountPaidMinor).toBe(0);
    expect(issued.body.balanceMinor).toBe(9900);
    expect(issued.body.issuerSnapshot.name).toBe("Alpha Company");
    expect(issued.body.issuerSnapshot.paymentInstructions).toBe("Pay promptly");
    expect(issued.body.billToSnapshot.name).toBe("Client A");
    expect(issued.body.lines[0].unitPriceMinor).toBe(9900);
    expect(issued.body.lines[0].lineTotalMinor).toBe(9900);

    await request(httpServer)
      .patch(`/company-operations/companies/${setupA.companyId}/profile`)
      .set("Cookie", adminASession)
      .send({ legalName: "Changed Legal Name", phone: "555-0000" })
      .expect(200);

    await request(httpServer)
      .post(`/company-operations/service-clients/${seed.serviceClientId}`)
      .set("Cookie", adminASession)
      .send({ name: "Renamed Client A" })
      .expect(201);

    const historical = await request(httpServer)
      .get(`/company-operations/client-invoices/${draft.body.id}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(historical.body.issuerSnapshot.name).toBe("Alpha Company");
    expect(historical.body.issuerSnapshot.phone).toBeNull();
    expect(historical.body.issuerSnapshot.paymentInstructions).toBe("Pay promptly");
    expect(historical.body.billToSnapshot.name).toBe("Client A");

    await prisma.clientInvoice.update({
      where: { id: draft.body.id as string },
      data: { dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    const summary = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/billing-summary`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(summary.body.outstandingInvoiceCount).toBe(1);
    expect(summary.body.overdueInvoiceCount).toBe(1);
    expect(summary.body.outstandingBalanceMinor).toBe(9900);
    expect(summary.body.overdueBalanceMinor).toBe(9900);

    await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/billing-summary`)
      .set("Cookie", adminBSession)
      .expect(403);

    const outstanding = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/outstanding-invoices`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(outstanding.body).toHaveLength(1);
    expect(outstanding.body[0].id).toBe(draft.body.id);
    expect(outstanding.body[0].isOverdue).toBe(true);

    const debtors = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/debtors`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(debtors.body).toHaveLength(1);
    expect(debtors.body[0].serviceClient.id).toBe(seed.serviceClientId);
    expect(debtors.body[0].outstandingInvoiceCount).toBe(1);
    expect(debtors.body[0].overdueInvoiceCount).toBe(1);

    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
      .set("Cookie", adminASession)
      .send({})
      .expect(400);

    const workOrder = await prisma.workOrder.findUnique({ where: { id: seed.workOrderId } });
    expect(workOrder?.status).toBe("INVOICED");
    expect(workOrder?.invoicedClientInvoiceId).toBe(draft.body.id);

    const list = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/client-invoices?q=${KNOWN_VIN}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(list.body).toHaveLength(1);

    await request(httpServer)
      .get(`/company-operations/client-invoices/${draft.body.id}`)
      .set("Cookie", adminBSession)
      .expect(403);

    const voided = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/void`)
      .set("Cookie", adminASession)
      .send({ voidReason: "Entered on wrong client account" })
      .expect(201);

    expect(voided.body.status).toBe("VOID");
    expect(voided.body.voidReason).toBe("Entered on wrong client account");
    expect(voided.body.balanceMinor).toBe(0);

    const summaryAfterVoid = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/billing-summary`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(summaryAfterVoid.body.outstandingInvoiceCount).toBe(0);
    expect(summaryAfterVoid.body.overdueInvoiceCount).toBe(0);

    const reopenedWorkOrder = await prisma.workOrder.findUnique({ where: { id: seed.workOrderId } });
    expect(reopenedWorkOrder?.status).toBe("COMPLETED");
    expect(reopenedWorkOrder?.invoicedClientInvoiceId).toBeNull();

    const paymentTables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('payments', 'payroll_runs', 'tax_records')`
    );
    expect(paymentTables).toHaveLength(0);
  });

  async function seedCompletedWorkOrder(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string
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

    const catalogResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: "Oil Change", fixedPriceMinor: 9900 })
      .expect(201);

    const employee = await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const workOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleResponse.body.id,
        serviceCatalogItemIds: [catalogResponse.body.id]
      })
      .expect(201);

    const assigned = await request(server)
      .post(`/company-operations/work-orders/${workOrder.body.id}/assignments`)
      .set("Cookie", session)
      .send({ employeeId: employee.body.id })
      .expect(201);

    await request(server)
      .post("/worker/scan")
      .send({
        companyId,
        pin: "123456",
        workOrderId: workOrder.body.id,
        workOrderAssignmentId: assigned.body.activeAssignmentId,
        enteredVin: KNOWN_VIN
      })
      .expect(201);

    const serviceLineId = (workOrder.body.serviceLines as Array<{ id: string }>)[0].id;

    await request(server)
      .post(`/worker/service-lines/${serviceLineId}/complete`)
      .send({ companyId, pin: "123456" })
      .expect(201);

    await request(server)
      .post(`/worker/work-orders/${workOrder.body.id}/finalize`)
      .send({ companyId, pin: "123456" })
      .expect(201);

    return {
      serviceClientId: clientResponse.body.id as string,
      workOrderId: workOrder.body.id as string,
      catalogItemId: catalogResponse.body.id as string
    };
  }

  async function seedAssignedIncompleteWorkOrder(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string,
    seed: { serviceClientId: string; catalogItemId: string }
  ) {
    const vehicleResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", session)
      .send({
        vin: "5YJSA1E14HF000001",
        serviceClientId: seed.serviceClientId,
        locationId: (
          await request(server)
            .get(`/company-operations/companies/${companyId}/locations`)
            .set("Cookie", session)
            .expect(200)
        ).body[0].id
      })
      .expect(201);

    const workOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleResponse.body.id,
        serviceCatalogItemIds: [seed.catalogItemId]
      })
      .expect(201);

    const employee = await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: "Carlos Rivera", pin: "654321" })
      .expect(201);

    await request(server)
      .post(`/company-operations/work-orders/${workOrder.body.id}/assignments`)
      .set("Cookie", session)
      .send({ employeeId: employee.body.id })
      .expect(201);

    return { workOrderId: workOrder.body.id as string };
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
