/**
 * Idempotent: create demo Field employees + PINs for Marios Autodetail Corp.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @laborledger/database exec tsx src/seed-autodetail-employees.ts
 */

import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const COMPANY_ID = "cmrnoo64a000lsjvdvkjiy7vs";
const GROUP_ID = "cmrnoo63x0001sjvdycprl3ga";
const OWNER_USER_ID = "cmrnoo63v0000sjvdxq6t5ohr";
const DEFAULT_EMPLOYEE_RATE_MINOR = 1900;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const EMPLOYEES = [
  { fullName: "Raquel", pin: "111111" },
  { fullName: "Deiber", pin: "222222" },
  { fullName: "Yunior", pin: "333333" },
  { fullName: "Steven", pin: "444444" },
  { fullName: "Bruna", pin: "555555" },
  { fullName: "Alexander", pin: "666666" }
] as const;

async function hashPin(pin: string) {
  return argon2.hash(pin, ARGON2_OPTIONS);
}

async function ensurePinUniqueInCompany(
  prisma: PrismaClient,
  companyId: string,
  pin: string,
  employeeIdToIgnore?: string
) {
  const activeCredentials = await prisma.employeePinCredential.findMany({
    where: {
      companyId,
      revokedAt: null,
      employee: { archivedAt: null },
      ...(employeeIdToIgnore ? { employeeId: { not: employeeIdToIgnore } } : {})
    },
    select: { pinHash: true }
  });

  for (const credential of activeCredentials) {
    if (await argon2.verify(credential.pinHash, pin)) {
      throw new Error(`PIN ${pin} already in use for company ${companyId}.`);
    }
  }
}

async function ensureEmployee(
  prisma: PrismaClient,
  input: { fullName: string; pin: string }
) {
  let employee = await prisma.employee.findFirst({
    where: {
      companyId: COMPANY_ID,
      fullName: input.fullName,
      archivedAt: null
    }
  });

  if (!employee) {
    await ensurePinUniqueInCompany(prisma, COMPANY_ID, input.pin);
    const pinHash = await hashPin(input.pin);

    employee = await prisma.employee.create({
      data: {
        groupId: GROUP_ID,
        companyId: COMPANY_ID,
        fullName: input.fullName
      }
    });

    await prisma.employeePinCredential.create({
      data: {
        employeeId: employee.id,
        companyId: COMPANY_ID,
        pinHash,
        createdByUserId: OWNER_USER_ID
      }
    });

    await prisma.employeeRate.create({
      data: {
        employeeId: employee.id,
        companyId: COMPANY_ID,
        rateMinorUnits: DEFAULT_EMPLOYEE_RATE_MINOR,
        currencyCode: "USD",
        effectiveStart: new Date(),
        createdByUserId: OWNER_USER_ID
      }
    });

    console.log(`Created ${input.fullName} (PIN ${input.pin})`);
    return;
  }

  const activePin = await prisma.employeePinCredential.findFirst({
    where: {
      employeeId: employee.id,
      companyId: COMPANY_ID,
      revokedAt: null
    }
  });

  if (!activePin) {
    await ensurePinUniqueInCompany(prisma, COMPANY_ID, input.pin, employee.id);
    const pinHash = await hashPin(input.pin);
    await prisma.employeePinCredential.create({
      data: {
        employeeId: employee.id,
        companyId: COMPANY_ID,
        pinHash,
        createdByUserId: OWNER_USER_ID
      }
    });
    console.log(`Added PIN for existing employee ${input.fullName} (PIN ${input.pin})`);
    return;
  }

  console.log(`Skipped ${input.fullName} — already has an active PIN`);
}

async function main() {
  const prisma = new PrismaClient();

  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true, name: true }
  });

  if (!company) {
    throw new Error(`Company ${COMPANY_ID} not found.`);
  }

  console.log(`Seeding Field employees for ${company.name}...`);

  for (const employee of EMPLOYEES) {
    await ensureEmployee(prisma, employee);
  }

  const count = await prisma.employeePinCredential.count({
    where: { companyId: COMPANY_ID, revokedAt: null }
  });

  console.log(`Done. ${count} active PIN credential(s) for ${company.name}.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
