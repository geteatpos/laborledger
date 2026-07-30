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

describe("client invoice draft editing and line items", () => {
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

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    return cookies?.[0] ?? "";
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

  it("creates draft, edits it, adds line items, and issues", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedCompletedWorkOrder(httpServer, adminASession, setupA.companyId);

    // Create a draft invoice
    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId],
        notes: "Original notes"
      })
      .expect(201);

    expect(draft.body.status).toBe("DRAFT");
    expect(draft.body.invoiceNumber).toBeNull();
    expect(draft.body.lines).toHaveLength(1);

    // Edit the draft invoice
    const edited = await request(httpServer)
      .patch(`/company-operations/client-invoices/${draft.body.id}`)
      .set("Cookie", adminASession)
      .send({
        notes: "Updated notes",
        dueDate: "2026-08-15T00:00:00.000Z"
      })
      .expect(200);

    expect(edited.body.notes).toBe("Updated notes");
    expect(edited.body.dueDate).toBeTruthy();

    // Add a manual SERVICE line item
    const addServiceLine = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "SERVICE",
        description: "Additional inspection",
        quantity: 1,
        unitPriceMinor: 5000,
        taxable: true,
        taxRate: 0.08
      })
      .expect(201);

    expect(addServiceLine.body.lines).toHaveLength(2);
    const serviceLine = addServiceLine.body.lines.find((l: { description: string }) => l.description === "Additional inspection");
    expect(serviceLine).toBeTruthy();
    expect(serviceLine.lineSubtotalMinor).toBe(5000);
    expect(serviceLine.taxAmountMinor).toBe(400);
    expect(serviceLine.lineTotalMinor).toBe(5400);
    expect(serviceLine.lineItemType).toBe("SERVICE");
    expect(serviceLine.lineItemSource).toBe("MANUAL");

    // Verify invoice totals were recalculated
    expect(addServiceLine.body.subtotalMinor).toBe(9900 + 5000); // work order line + service line
    expect(addServiceLine.body.taxMinor).toBe(400);
    expect(addServiceLine.body.totalMinor).toBe(9900 + 5400);

    // Add a DISCOUNT line item
    const addDiscountLine = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "DISCOUNT",
        description: "Loyalty discount",
        quantity: 1,
        unitPriceMinor: 1000,
        taxable: false
      })
      .expect(201);

    expect(addDiscountLine.body.lines).toHaveLength(3);

    // Update the discount line
    const updateDiscount = await request(httpServer)
      .patch(`/company-operations/client-invoices/${draft.body.id}/lines/${addDiscountLine.body.lines[2].id}`)
      .set("Cookie", adminASession)
      .send({
        unitPriceMinor: 1500
      })
      .expect(200);

    expect(updateDiscount.body.lines[2].unitPriceMinor).toBe(1500);

    // Remove the discount line
    const removeDiscount = await request(httpServer)
      .delete(`/company-operations/client-invoices/${draft.body.id}/lines/${addDiscountLine.body.lines[2].id}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(removeDiscount.body.lines).toHaveLength(2);

    // Issue the invoice
    const issued = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    expect(issued.body.status).toBe("ISSUED");
    expect(issued.body.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/u);

    // Verify editing draft after issue is rejected
    await request(httpServer)
      .patch(`/company-operations/client-invoices/${draft.body.id}`)
      .set("Cookie", adminASession)
      .send({ notes: "Should fail" })
      .expect(400);

    // Verify adding line items after issue is rejected
    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "SERVICE",
        description: "Should fail",
        quantity: 1,
        unitPriceMinor: 1000
      })
      .expect(400);
  });

  it("rejects negative price on line item", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedCompletedWorkOrder(httpServer, adminASession, setupA.companyId);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(201);

    // Try to add line item with negative price
    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "SERVICE",
        description: "Test service",
        quantity: 1,
        unitPriceMinor: -100
      })
      .expect(400);

    // Try to add line item with negative quantity
    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "SERVICE",
        description: "Test service",
        quantity: -1,
        unitPriceMinor: 100
      })
      .expect(400);
  });

  it("isolates draft edits between tenants", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const adminBSession = await login(setupB.adminEmail, setupB.adminPassword);

    const seedA = await seedCompletedWorkOrder(httpServer, adminASession, setupA.companyId);
    const seedB = await seedCompletedWorkOrder(httpServer, adminBSession, setupB.companyId);

    const draftA = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seedA.serviceClientId,
        workOrderIds: [seedA.workOrderId]
      })
      .expect(201);

    const draftB = await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/client-invoices`)
      .set("Cookie", adminBSession)
      .send({
        serviceClientId: seedB.serviceClientId,
        workOrderIds: [seedB.workOrderId]
      })
      .expect(201);

    // Admin A tries to edit Admin B's invoice - should fail
    await request(httpServer)
      .patch(`/company-operations/client-invoices/${draftB.body.id}`)
      .set("Cookie", adminASession)
      .send({ notes: "Cross-tenant edit" })
      .expect(403);

    // Admin A tries to add line to Admin B's invoice - should fail
    await request(httpServer)
      .post(`/company-operations/client-invoices/${draftB.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "SERVICE",
        description: "Cross-tenant line",
        quantity: 1,
        unitPriceMinor: 1000
      })
      .expect(403);

    // Admin B can edit their own invoice
    const editB = await request(httpServer)
      .patch(`/company-operations/client-invoices/${draftB.body.id}`)
      .set("Cookie", adminBSession)
      .send({ notes: "Admin B's edit" })
      .expect(200);

    expect(editB.body.notes).toBe("Admin B's edit");

    // Admin B can add lines to their own invoice
    const addLineB = await request(httpServer)
      .post(`/company-operations/client-invoices/${draftB.body.id}/lines`)
      .set("Cookie", adminBSession)
      .send({
        type: "PART",
        description: "Brake pads",
        quantity: 2,
        unitPriceMinor: 7500,
        taxable: true,
        taxRate: 0.08
      })
      .expect(201);

    expect(addLineB.body.lines).toHaveLength(2);
  });

  it("creates draft with all line item types", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedCompletedWorkOrder(httpServer, adminASession, setupA.companyId);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(201);

    const lineTypes = ["SERVICE", "PART", "REPAIR", "LABOR", "FEE", "DISCOUNT", "OTHER"] as const;

    for (const type of lineTypes) {
      const addLine = await request(httpServer)
        .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
        .set("Cookie", adminASession)
        .send({
          type,
          description: `Test ${type.toLowerCase()} line`,
          quantity: type === "DISCOUNT" ? 1 : 2,
          unitPriceMinor: type === "DISCOUNT" ? 2000 : 5000,
          taxable: type !== "DISCOUNT",
          taxRate: 0.1
        })
        .expect(201);

      expect(addLine.body.lines[addLine.body.lines.length - 1].lineItemType).toBe(type);
    }

    // Verify we have all the lines
    const finalInvoice = await request(httpServer)
      .get(`/company-operations/client-invoices/${draft.body.id}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(finalInvoice.body.lines).toHaveLength(1 + lineTypes.length); // 1 from work order + 7 manual
  });

  it("recalculates totals correctly with multiple taxable lines", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedCompletedWorkOrder(httpServer, adminASession, setupA.companyId);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(201);

    // Work order line: 9900 (no tax since original lines don't have taxable flag)
    // Add line 1: 1000 qty 1, price 1000, taxable 10% = subtotal 1000, tax 100, total 1100
    const line1 = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "SERVICE",
        description: "Service 1",
        quantity: 1,
        unitPriceMinor: 1000,
        taxable: true,
        taxRate: 0.1
      })
      .expect(201);

    expect(line1.body.subtotalMinor).toBe(9900 + 1000); // 10900
    expect(line1.body.taxMinor).toBe(100);
    expect(line1.body.totalMinor).toBe(9900 + 1100); // 11000

    // Add line 2: 500 qty 2, price 500, taxable 8% = subtotal 1000, tax 80, total 1080
    const line2 = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "PART",
        description: "Part 1",
        quantity: 2,
        unitPriceMinor: 500,
        taxable: true,
        taxRate: 0.08
      })
      .expect(201);

    expect(line2.body.subtotalMinor).toBe(9900 + 1000 + 1000); // 11900
    expect(line2.body.taxMinor).toBe(100 + 80); // 180
    expect(line2.body.totalMinor).toBe(9900 + 1100 + 1080); // 12080

    // Add non-taxable line: 2000 qty 1, price 2000, not taxable = subtotal 2000, tax 0, total 2000
    const line3 = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "FEE",
        description: "Environmental fee",
        quantity: 1,
        unitPriceMinor: 2000,
        taxable: false
      })
      .expect(201);

    expect(line3.body.subtotalMinor).toBe(9900 + 1000 + 1000 + 2000); // 13900
    expect(line3.body.taxMinor).toBe(180); // unchanged
    expect(line3.body.totalMinor).toBe(9900 + 1100 + 1080 + 2000); // 14080
  });

  it("creates a manual empty draft, adds vehicle-linked lines, and issues without work orders", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL!,
      process.env.PLATFORM_SUPERADMIN_PASSWORD!
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Manual", "manual-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-clients`)
      .set("Cookie", adminASession)
      .send({ name: "Walking Customer" })
      .expect(201);

    const locationResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/locations`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Shop",
        timezone: "America/New_York"
      })
      .expect(201);

    const vehicleResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        plate: "4MW 939",
        color: "GREY"
      })
      .expect(201);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientResponse.body.id,
        workOrderIds: [],
        vehicleId: vehicleResponse.body.id,
        notes: "Manual paint job"
      })
      .expect(201);

    expect(draft.body.status).toBe("DRAFT");
    expect(draft.body.lines).toHaveLength(0);
    expect(draft.body.totalMinor).toBe(0);
    expect(draft.body.defaultVehicleId).toBe(vehicleResponse.body.id);

    const withLine = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/lines`)
      .set("Cookie", adminASession)
      .send({
        type: "REPAIR",
        description: "Paint front bumper",
        quantity: 1,
        unitPriceMinor: 30000,
        taxable: false,
        vehicleId: vehicleResponse.body.id
      })
      .expect(201);

    expect(withLine.body.lines).toHaveLength(1);
    expect(withLine.body.lines[0].vehicleId).toBe(vehicleResponse.body.id);
    expect(withLine.body.lines[0].vinSnapshot).toBe(KNOWN_VIN);
    expect(withLine.body.lines[0].lineItemSource).toBe("MANUAL");
    expect(withLine.body.totalMinor).toBe(30000);

    const issued = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    expect(issued.body.status).toBe("ISSUED");
    expect(issued.body.invoiceNumber).toBeTruthy();
    expect(issued.body.totalMinor).toBe(30000);
  });
});
