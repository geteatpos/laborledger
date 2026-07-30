import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as argon2 from "argon2";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) return null;
  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function applyLocalEnvFiles() {
  for (const filename of [".env", ".env.example"]) {
    const envPath = resolve(repoRoot, filename);
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/u)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined || process.env[parsed.key] === "") {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

applyLocalEnvFiles();

const DEFAULT_DATABASE_URL =
  "postgresql://laborledger:laborledger@127.0.0.1:55432/laborledger?schema=public";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function hashPassword(password: string) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  const email = "mario@mariosautodetail.com";
  const password = "Boston2018";
  const fullName = "Mario Rodriguez";

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        fullName,
        passwordHash,
      },
      update: {
        fullName,
        passwordHash,
      },
    });

    console.log(`User confirmed: ${user.email} (${user.id})`);

    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
    });

    if (companies.length === 0) {
      console.log("No companies found in the database.");
      return;
    }

    console.log(`Found ${companies.length} companies.`);

    let assigned = 0;
    let skipped = 0;

    for (const company of companies) {
      const existing = await prisma.companyMembership.findFirst({
        where: {
          companyId: company.id,
          email,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      if (existing) {
        console.log(`  Already COMPANY_ADMIN: ${company.name} (${company.id})`);
        skipped++;
        continue;
      }

      await prisma.companyMembership.upsert({
        where: {
          companyId_email: {
            companyId: company.id,
            email,
          },
        },
        create: {
          companyId: company.id,
          userId: user.id,
          email,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          userId: user.id,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      console.log(`  Assigned COMPANY_ADMIN: ${company.name} (${company.id})`);
      assigned++;
    }

    console.log(`\nDone. ${assigned} assigned, ${skipped} skipped.`);

    if (assigned > 0) {
      console.log(`\nLogin credentials:`);
      console.log(`  Email:    ${email}`);
      console.log(`  Password: ${password}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof Error && error.message.includes("Can't reach database server")) {
    console.error("PostgreSQL is not reachable. Verify DATABASE_URL.");
  } else {
    console.error("Script failed.");
    console.error(error);
  }
  process.exit(1);
});
