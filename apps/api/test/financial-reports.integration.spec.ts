import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  ClientInvoiceStatus,
  CompanyRole,
  GlobalRole,
  GroupRole,
  MembershipStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient
} from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ARGON2_OPTIONS, resetIntegrationDatabase } from "./integration-test-db";
import { AppModule } from "../src/modules/app.module";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.VIN_DECODER = "stub";
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";
process.env.MOBILE_AUTH_HASH_PEPPER = "financial-test-mobile-hash-pepper-32";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("financial reports endpoints", () => {
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

  it("aggregates sales, collected, outstanding, overdue, trends, debtors, and isolates companies", async () => {
    const password = "Admin!Financial1";
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

    const groupA = await prisma.group.create({ data: { name: "Finance Group A" } });
    const groupB = await prisma.group.create({ data: { name: "Finance Group B" } });
    const companyA = await prisma.company.create({
      data: { groupId: groupA.id, name: "Company A", currencyCode: "USD" }
    });
    const companyB = await prisma.company.create({
      data: { groupId: groupB.id, name: "Company B", currencyCode: "USD" }
    });

    const adminA = await prisma.user.create({
      data: {
        email: `admin-a-${randomBytes(3).toString("hex")}@example.com`,
        fullName: "Admin A",
        passwordHash,
        globalRole: GlobalRole.NONE
      }
    });
    const adminB = await prisma.user.create({
      data: {
        email: `admin-b-${randomBytes(3).toString("hex")}@example.com`,
        fullName: "Admin B",
        passwordHash,
        globalRole: GlobalRole.NONE
      }
    });

    await prisma.groupMembership.create({
      data: {
        groupId: groupA.id,
        userId: adminA.id,
        email: adminA.email,
        role: GroupRole.GROUP_OWNER,
        status: MembershipStatus.ACTIVE
      }
    });
    await prisma.groupMembership.create({
      data: {
        groupId: groupB.id,
        userId: adminB.id,
        email: adminB.email,
        role: GroupRole.GROUP_OWNER,
        status: MembershipStatus.ACTIVE
      }
    });
    await prisma.companyMembership.create({
      data: {
        companyId: companyA.id,
        userId: adminA.id,
        email: adminA.email,
        role: CompanyRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE
      }
    });
    await prisma.companyMembership.create({
      data: {
        companyId: companyB.id,
        userId: adminB.id,
        email: adminB.email,
        role: CompanyRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE
      }
    });

    const clientA1 = await prisma.serviceClient.create({
      data: { groupId: groupA.id, companyId: companyA.id, name: "Debtor One" }
    });
    const clientA2 = await prisma.serviceClient.create({
      data: { groupId: groupA.id, companyId: companyA.id, name: "Debtor Two" }
    });
    const clientB = await prisma.serviceClient.create({
      data: { groupId: groupB.id, companyId: companyB.id, name: "Other Co Client" }
    });

    const issuedAt = new Date("2026-07-15T15:00:00.000Z");
    const overdueDue = new Date("2026-07-01T00:00:00.000Z");
    const futureDue = new Date("2026-08-15T00:00:00.000Z");

    const draft = await prisma.clientInvoice.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        serviceClientId: clientA1.id,
        status: ClientInvoiceStatus.DRAFT,
        subtotalMinor: 5000,
        totalMinor: 5000,
        balanceMinor: 5000,
        currencyCode: "USD"
      }
    });

    const voided = await prisma.clientInvoice.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        serviceClientId: clientA1.id,
        status: ClientInvoiceStatus.VOID,
        subtotalMinor: 8000,
        totalMinor: 8000,
        balanceMinor: 0,
        currencyCode: "USD",
        issuedAt,
        voidedAt: new Date("2026-07-16T12:00:00.000Z"),
        invoiceNumber: "VOID-1"
      }
    });

    const issuedOpen = await prisma.clientInvoice.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        serviceClientId: clientA1.id,
        status: ClientInvoiceStatus.ISSUED,
        subtotalMinor: 10000,
        totalMinor: 10000,
        amountPaidMinor: 0,
        balanceMinor: 10000,
        currencyCode: "USD",
        issuedAt,
        dueDate: overdueDue,
        invoiceNumber: "INV-OPEN-1"
      }
    });

    const issuedPartial = await prisma.clientInvoice.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        serviceClientId: clientA2.id,
        status: ClientInvoiceStatus.ISSUED,
        subtotalMinor: 20000,
        totalMinor: 20000,
        amountPaidMinor: 5000,
        balanceMinor: 15000,
        currencyCode: "USD",
        issuedAt,
        dueDate: futureDue,
        invoiceNumber: "INV-PARTIAL-1"
      }
    });

    const issuedPaid = await prisma.clientInvoice.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        serviceClientId: clientA2.id,
        status: ClientInvoiceStatus.ISSUED,
        subtotalMinor: 7000,
        totalMinor: 7000,
        amountPaidMinor: 7000,
        balanceMinor: 0,
        currencyCode: "USD",
        issuedAt,
        dueDate: overdueDue,
        invoiceNumber: "INV-PAID-1"
      }
    });

    const otherCompanyInvoice = await prisma.clientInvoice.create({
      data: {
        groupId: groupB.id,
        companyId: companyB.id,
        serviceClientId: clientB.id,
        status: ClientInvoiceStatus.ISSUED,
        subtotalMinor: 99999,
        totalMinor: 99999,
        balanceMinor: 99999,
        currencyCode: "USD",
        issuedAt,
        dueDate: overdueDue,
        invoiceNumber: "INV-B-1"
      }
    });

    await prisma.clientInvoicePayment.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        clientInvoiceId: issuedPartial.id,
        amountMinor: 5000,
        currencyCode: "USD",
        method: PaymentMethod.CASH,
        status: PaymentStatus.POSTED,
        paymentDate: new Date("2026-07-20T12:00:00.000Z"),
        receivedAt: new Date("2026-07-20T12:00:00.000Z"),
        recordedByUserId: adminA.id
      }
    });

    await prisma.clientInvoicePayment.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        clientInvoiceId: issuedPaid.id,
        amountMinor: 7000,
        currencyCode: "USD",
        method: PaymentMethod.CARD,
        status: PaymentStatus.POSTED,
        paymentDate: new Date("2026-07-21T12:00:00.000Z"),
        receivedAt: new Date("2026-07-21T12:00:00.000Z"),
        recordedByUserId: adminA.id
      }
    });

    await prisma.clientInvoicePayment.create({
      data: {
        groupId: groupA.id,
        companyId: companyA.id,
        clientInvoiceId: issuedOpen.id,
        amountMinor: 1000,
        currencyCode: "USD",
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
        paymentDate: new Date("2026-07-22T12:00:00.000Z"),
        receivedAt: new Date("2026-07-22T12:00:00.000Z"),
        recordedByUserId: adminA.id
      }
    });

    await prisma.clientInvoicePayment.create({
      data: {
        groupId: groupB.id,
        companyId: companyB.id,
        clientInvoiceId: otherCompanyInvoice.id,
        amountMinor: 4000,
        currencyCode: "USD",
        method: PaymentMethod.CASH,
        status: PaymentStatus.POSTED,
        paymentDate: new Date("2026-07-20T12:00:00.000Z"),
        receivedAt: new Date("2026-07-20T12:00:00.000Z"),
        recordedByUserId: adminB.id
      }
    });

    void draft;
    void voided;

    const sessionA = await login(adminA.email, password);
    const sessionB = await login(adminB.email, password);

    const summary = await request(httpServer)
      .get(
        `/company-operations/companies/${companyA.id}/financial-summary?from=2026-07-01&to=2026-07-31&timezone=UTC&preset=custom`
      )
      .set("Cookie", sessionA)
      .expect(200);

    expect(summary.body.companyId).toBe(companyA.id);
    expect(summary.body.sales.amountMinor).toBe(37000);
    expect(summary.body.sales.invoiceCount).toBe(3);
    expect(summary.body.collected.amountMinor).toBe(12000);
    expect(summary.body.collected.paymentCount).toBe(2);
    expect(summary.body.outstanding.amountMinor).toBe(25000);
    expect(summary.body.outstanding.invoiceCount).toBe(2);
    expect(summary.body.overdue.amountMinor).toBe(10000);
    expect(summary.body.overdue.invoiceCount).toBe(1);
    expect(summary.body.dueSoon.invoiceCount).toBeGreaterThanOrEqual(0);

    await request(httpServer)
      .get(`/company-operations/companies/${companyA.id}/financial-summary`)
      .set("Cookie", sessionB)
      .expect(403);

    const trends = await request(httpServer)
      .get(
        `/company-operations/companies/${companyA.id}/financial-trends?from=2026-07-15&to=2026-07-21&timezone=UTC&interval=day`
      )
      .set("Cookie", sessionA)
      .expect(200);

    expect(trends.body.series).toHaveLength(7);
    expect(trends.body.series.every((point: { salesMinor: number; collectedMinor: number }) => typeof point.salesMinor === "number")).toBe(
      true
    );
    const salesDay = trends.body.series.find((point: { period: string }) => point.period === "2026-07-15");
    const collectedDay = trends.body.series.find((point: { period: string }) => point.period === "2026-07-20");
    expect(salesDay.salesMinor).toBe(37000);
    expect(collectedDay.collectedMinor).toBe(5000);

    const debtors = await request(httpServer)
      .get(`/company-operations/companies/${companyA.id}/top-debtors?limit=5`)
      .set("Cookie", sessionA)
      .expect(200);

    expect(debtors.body.debtors).toHaveLength(2);
    expect(debtors.body.debtors[0].serviceClientId).toBe(clientA1.id);
    expect(debtors.body.debtors[0].overdueAmountMinor).toBe(10000);
    expect(debtors.body.debtors.every((d: { serviceClientId: string }) => d.serviceClientId !== clientB.id)).toBe(
      true
    );

    const recent = await request(httpServer)
      .get(`/company-operations/companies/${companyA.id}/recent-payments`)
      .set("Cookie", sessionA)
      .expect(200);

    expect(recent.body.payments).toHaveLength(2);
    expect(recent.body.payments.every((p: { status: string }) => p.status === "POSTED")).toBe(true);
    expect(recent.body.payments.every((p: { amountMinor: number }) => p.amountMinor !== 99999)).toBe(true);

    const emptySummary = await request(httpServer)
      .get(
        `/company-operations/companies/${companyB.id}/financial-summary?from=2026-01-01&to=2026-01-31&timezone=UTC`
      )
      .set("Cookie", sessionB)
      .expect(200);

    expect(emptySummary.body.sales.amountMinor).toBe(0);
    expect(emptySummary.body.collected.amountMinor).toBe(0);
  });

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    return cookies?.[0] ?? "";
  }
});
