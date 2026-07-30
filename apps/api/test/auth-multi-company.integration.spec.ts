import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ARGON2_OPTIONS,
  configureIntegrationTestEnv,
  resetIntegrationDatabase
} from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";

configureIntegrationTestEnv();

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

describe("AUTH multi-company membership selection", () => {
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

  it("login with multiple company memberships → choose-company; select foreign company → 403; select own → ok", async () => {
    const password = `Owner!${randomBytes(4).toString("hex")}`;
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    const email = `mario-multi-${randomBytes(3).toString("hex")}@example.com`;

    const group = await prisma.group.create({ data: { name: "Multi Tenant Group" } });

    const companyA = await prisma.company.create({
      data: { groupId: group.id, name: "Tenant A", currencyCode: "USD", settings: {} }
    });
    const companyB = await prisma.company.create({
      data: { groupId: group.id, name: "Tenant B", currencyCode: "USD", settings: {} }
    });
    const foreign = await prisma.company.create({
      data: { groupId: group.id, name: "Foreign Tenant", currencyCode: "USD", settings: {} }
    });

    const user = await prisma.user.create({
      data: {
        email,
        fullName: "Multi Owner",
        passwordHash
      }
    });

    await prisma.companyMembership.createMany({
      data: [
        {
          companyId: companyA.id,
          userId: user.id,
          email,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE,
          locationId: null
        },
        {
          companyId: companyB.id,
          userId: user.id,
          email,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE,
          locationId: null
        }
      ]
    });

    const login = await request(httpServer)
      .post("/auth/login")
      .send({ email, password })
      .expect(200);

    expect(login.body.redirectTo).toBe("choose-company");
    expect(login.body.accessibleCompanyCount).toBe(2);
    expect(login.body.activeCompanyId).toBeNull();

    const cookie = extractSessionCookie(login.headers["set-cookie"] as string[]);

    const me = await request(httpServer).get("/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body.requiresCompanySelection).toBe(true);
    expect(me.body.accessibleCompanies).toHaveLength(2);
    expect(me.body.activeCompany).toBeNull();

    await request(httpServer)
      .post("/auth/select-company")
      .set("Cookie", cookie)
      .send({ companyId: foreign.id })
      .expect(403);

    const selected = await request(httpServer)
      .post("/auth/select-company")
      .set("Cookie", cookie)
      .send({ companyId: companyB.id })
      .expect(200);

    expect(selected.body.activeCompany.id).toBe(companyB.id);
    expect(selected.body.activeCompany.name).toBe("Tenant B");

    const meAfter = await request(httpServer).get("/auth/me").set("Cookie", cookie).expect(200);
    expect(meAfter.body.activeCompany.id).toBe(companyB.id);
    expect(meAfter.body.requiresCompanySelection).toBe(false);

    // Switch without re-login
    const switched = await request(httpServer)
      .post("/auth/select-company")
      .set("Cookie", cookie)
      .send({ companyId: companyA.id })
      .expect(200);

    expect(switched.body.activeCompany.id).toBe(companyA.id);
  });
});

function extractSessionCookie(setCookie: string[] | undefined): string {
  const raw = setCookie?.find((value) => value.startsWith("laborledger.sid="));
  if (!raw) {
    throw new Error("Missing session cookie");
  }
  return raw.split(";")[0] ?? raw;
}
