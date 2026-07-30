/**
 * Idempotent tenant seed for LaborLedger.
 *
 * Creates 4 companies (tenants) + locations (branches) and mario@gmail.com
 * as COMPANY_ADMIN (owner) on all four with locationId = null (all branches).
 *
 * Usage:
 *   SEED_OWNER_PASSWORD='...' pnpm --filter @laborledger/database seed:tenants
 *
 * Requires migration `20260716154500_company_settings_and_membership_location`
 * to be applied first. Does NOT run migrate — apply SQL after review.
 *
 * WARNING: truncates all public data tables (keeps schema). Backup first.
 */

import {
  CompanyRole,
  GlobalRole,
  MembershipStatus,
  PrismaClient,
  type Prisma
} from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as argon2 from "argon2";

import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings
} from "./company-settings.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }
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
  for (const filename of [".env.production", ".env", ".env.example"]) {
    const envPath = resolve(repoRoot, filename);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined || process.env[parsed.key] === "") {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

applyLocalEnvFiles();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const OWNER_EMAIL = "mario@gmail.com";
const GROUP_NAME = "Mario Operating Group";
const DEFAULT_TIMEZONE = DEFAULT_COMPANY_SETTINGS.defaultTimezone;

type TenantSeed = {
  name: string;
  branches: readonly string[];
  settings?: Partial<CompanySettings>;
};

const TENANTS: readonly TenantSeed[] = [
  { name: "Family Autobody and Sales", branches: ["NH"] },
  { name: "Marios General Services", branches: ["Woburn", "NH"] },
  { name: "Marios Autodetail Corp", branches: ["Woburn"] },
  { name: "Brothers Corp", branches: ["Woburn"] }
] as const;

/** Tables truncated in dependency-safe order via CASCADE from roots. */
const TRUNCATE_ROOTS = [
  "sessions",
  "password_reset_tokens",
  "invitations",
  "audit_events",
  "in_app_notifications",
  "mechanic_part_ai_suggestions",
  "mechanic_order_parts",
  "mechanic_order_approvals",
  "vehicle_photos",
  "vehicle_inspection_checklist_items",
  "vehicle_inspection_checklists",
  "labor_work_assignments",
  "labor_billing_drafts",
  "client_invoice_deliveries",
  "client_invoice_lines",
  "client_invoices",
  "service_completions",
  "worker_scan_events",
  "vehicle_responsibility_logs",
  "work_order_assignments",
  "work_order_status_history",
  "work_order_service_lines",
  "work_orders",
  "vehicles",
  "punch_corrections",
  "correction_requests",
  "punch_events",
  "shifts",
  "shift_generation_batches",
  "schedule_templates",
  "weekly_close_snapshots",
  "weekly_periods",
  "kiosk_credentials",
  "kiosks",
  "field_sites",
  "supervisor_location_assignments",
  "employee_pin_credentials",
  "employee_rates",
  "client_labor_rates",
  "employees",
  "service_catalog_items",
  "locations",
  "service_clients",
  "company_memberships",
  "group_memberships",
  "companies",
  "groups",
  "users"
] as const;

async function wipePublicData(prisma: PrismaClient) {
  const existing = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  const present = new Set(existing.map((row) => row.tablename));
  const toTruncate = TRUNCATE_ROOTS.filter((name) => present.has(name));
  if (toTruncate.length === 0) {
    return;
  }
  const list = toTruncate.map((name) => `"${name}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  const password = process.env.SEED_OWNER_PASSWORD?.trim() ?? "";
  if (!password || password.length < 10) {
    throw new Error(
      "SEED_OWNER_PASSWORD is required (min 10 chars). Never hardcode the owner password."
    );
  }

  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://laborledger:laborledger@127.0.0.1:55432/laborledger?schema=public";

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    console.log("[seed-tenants] Wiping public data (schema kept)…");
    await wipePublicData(prisma);

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    const settingsJson = DEFAULT_COMPANY_SETTINGS as unknown as Prisma.InputJsonValue;

    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          email: OWNER_EMAIL,
          fullName: "Mario",
          passwordHash,
          globalRole: GlobalRole.NONE
        }
      });

      const group = await tx.group.create({
        data: { name: GROUP_NAME }
      });

      const companies: Array<{
        id: string;
        name: string;
        locations: Array<{ id: string; name: string }>;
      }> = [];

      for (const tenant of TENANTS) {
        const company = await tx.company.create({
          data: {
            groupId: group.id,
            name: tenant.name,
            currencyCode: "USD",
            settings: settingsJson
          }
        });

        const serviceClient = await tx.serviceClient.create({
          data: {
            groupId: group.id,
            companyId: company.id,
            name: `${tenant.name} Default Client`
          }
        });

        const locations: Array<{ id: string; name: string }> = [];
        for (const branchName of tenant.branches) {
          const location = await tx.location.create({
            data: {
              groupId: group.id,
              companyId: company.id,
              serviceClientId: serviceClient.id,
              name: branchName,
              timezone: DEFAULT_TIMEZONE
            }
          });
          locations.push({ id: location.id, name: location.name });
        }

        await tx.companyMembership.create({
          data: {
            companyId: company.id,
            userId: owner.id,
            email: OWNER_EMAIL,
            role: CompanyRole.COMPANY_ADMIN,
            status: MembershipStatus.ACTIVE,
            locationId: null
          }
        });

        companies.push({ id: company.id, name: company.name, locations });
      }

      return { owner, group, companies };
    });

    console.log("[seed-tenants] Done.");
    console.log(`  Owner: ${result.owner.email} (${result.owner.id})`);
    console.log(`  Group: ${result.group.name}`);
    for (const company of result.companies) {
      const branches = company.locations.map((l) => l.name).join(", ");
      console.log(`  Company: ${company.name} → [${branches}]`);
    }
    console.log(
      "  Login as mario@gmail.com → expect redirectTo=choose-company (4 memberships)."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed-tenants] Failed:", error);
  process.exitCode = 1;
});
