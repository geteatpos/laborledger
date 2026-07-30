# LaborLedger Project Memory

> Durable project context for coding agents. Keep this concise. Record only verified facts, durable decisions, invariants, and active risks. Never store secrets or temporary task notes here.

## Identity

- Name: **LaborLedger**.
- Domain: automotive workshop operations and labor/time management.
- Replaces: ServiHour legacy system.
- Current state: production-functional, with significant technical and operational debt.
- Analysis confidence: approximately 75%; static analysis only, not a runtime audit.

## Stack and Repository

- pnpm workspace monorepo.
- `apps/api`: NestJS 11 backend, normally port 4000.
- `apps/admin`: Next.js 15 admin application, BFF pattern, normally port 3000.
- `apps/field`: Next.js 15 Field PWA, BFF pattern, normally port 3001.
- `packages/database`: Prisma 6 schema and migrations for PostgreSQL.
- Deployment references include PM2 and Nginx.
- Analysis reported 33 Prisma migrations and roughly 332 integration tests.

## Product Model

Tenant hierarchy:

```text
Platform
└── Group
    └── Company
        └── Location
```

Roles:

- Platform superadmin: global platform administration.
- `GROUP_OWNER`: group-wide access and weekly close.
- `COMPANY_ADMIN`: company operations and administration.
- `SUPERVISOR`: limited to assigned locations.
- Field employee: PIN-based Field PWA access, not normal admin authentication.

Core domain entities include Group, Company, Location, User, Session, Employee, EmployeePinCredential, EmployeeRate, ServiceClient, ServiceCatalogItem, Vehicle, WorkOrder, WorkOrderServiceLine, WorkOrderAssignment, Shift, PunchEvent, CorrectionRequest, WeeklyPeriod, LaborWorkAssignment, ClientInvoice, mechanic parts, and approvals.

## Architectural Invariants

- Browser clients communicate through Next.js BFF routes, not directly with NestJS.
- Authentication uses server-side cookie sessions rather than JWTs.
- Session records include tenant context such as active company.
- Tenant-owned Prisma queries require explicit `companyId` scope.
- Supervisor operations require assigned-location scope.
- Timekeeping is a state machine with idempotency and weekly-close rules.
- Prisma transactions protect multi-write business operations.
- Local storage currently handles uploads and is a production risk.

## Known Strengths

- Robust cookie-session authentication and Argon2id password storage.
- Multi-tenant schema and generally consistent company scoping.
- Time-clock state machine and idempotency.
- Functional work-order lifecycle.
- Client invoice PDF and email delivery.
- Field PWA as the current operational employee interface (V1, frozen during Android V2 migration).
- Significant integration-test coverage.

## Active Critical Risks

1. Telegram bot queries were reported without `companyId` scoping.
2. File storage lacks verified disk-capacity and MIME checks.
3. Automated PostgreSQL/upload backups and restore drills are not confirmed.
4. Field PWA is single-tenant via `WORKER_COMPANY_ID`; multi-tenant Field routing is the next phase.
5. `company-operations.service.ts` is approximately 4,402 lines and holds many responsibilities.
6. Vehicle inspection reportedly associates a checklist with the wrong employee.
7. Several catch blocks may swallow errors or lack useful logging.
8. Historical documentation appears to contain an exposed API credential; rotate it and clean history.
9. Rate limiting is in-memory only — not distributed; WAF/rate-limit layer needed before public API exposure.

## Product Scope Decisions

Keep focused on the complete operational loop:

```text
employee time → vehicle intake → work order → labor execution → completion → client invoice
```

Temporarily freeze or avoid expanding:

- AI Shopping.
- Additional VIN providers beyond NHTSA.
- Telegram bot functionality beyond security maintenance.
- Legacy Kiosk/Worker features.
- SaaS subscription billing until operational stability is achieved.

Audit before deciding:

- `LaborWorkAssignment` reference and snapshot fields.
- Legacy Kiosk/Worker removal.
- AI provider consolidation.

## Refactoring Policy

- Never rewrite `company-operations.service.ts` wholesale.
- Extract one domain boundary at a time, beginning with low-coupling CRUD such as employees, vehicles, or locations.
- Keep existing controller contracts compatible during extraction.
- Add characterization/integration tests before moving behavior.
- Do not mix refactoring with unrelated feature changes.

## Verification Policy

- Inspect package scripts before running commands.
- Run focused tests first.
- Typical full checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Production commands, PM2 restarts, migrations, and data-changing scripts require explicit approval.

## Memory Update Protocol

Update this file only when one of these changes:

- a durable product decision;
- a verified architecture boundary;
- a critical invariant;
- a production risk or its resolution;
- an official command or workflow.

For each update, add a dated entry below. Do not store task transcripts.

## Decision Log

### 2026-07-16 — Initial agent memory

- Established LaborLedger as the canonical product name.
- Adopted stabilization-before-expansion priority.
- Adopted explicit tenant-scoping and BFF invariants.
- Adopted incremental-only refactoring for company operations.

### 2026-07-21 — C1 Documentation Archive and MEMORIA Merge

**C1 Archive:** Archived legacy planning docs (MASTER_PLAN.md, OPENCODE_RESUME.md, backendplan.md), Phase 0A operational report, 6 historical agent-system audit files, and Stitch design outputs. No source code, tests, or migrations affected.

**MEMORIA merge:** Consolidated durable Spanish-language operational knowledge into this document. Items merged:

- PM2 restart: prefer `pm2 delete + pm2 start` from ecosystem.config.cjs over `pm2 restart --update-env` for reliable env refresh.
- Integration test DB: requires PostgreSQL on port 55432 with specific credentials (see `scripts/with-db-url.mjs`).
- Superadmin sync: `PLATFORM_SUPERADMIN_PASSWORD` in `.env.production` is synced to DB at API startup; requires PM2 restart to pick up changes.
- Health endpoint: must validate database connectivity, not only NestJS process liveness, to avoid false positives during Prisma failures.
- Rate limiting: in-memory rate-limit middleware resolved (2026-06-30) for auth/login, PIN/clock, and legacy kiosk/worker endpoints. Distributed WAF/rate-limit layer remains a production risk for multi-process or public API exposure.
- Scope boundary: Kiosk/Worker apps are legacy frozen components. `apps/field` is the current V1 operational employee interface, frozen during Android V2 migration. Native Android Kotlin is the approved V2 future Field client. Do not create new kiosk/worker-specific features.
- VIN scanning: migrated from native `BarcodeDetector` API to `web-wasm-barcode-reader` v1.6.1 (ZBar WASM). Components: `VinCameraScan.tsx` in `apps/field/src/components/employee/`. WASM assets at `apps/field/public/wasm/a.out.{js,wasm}`.
- Mechanic orders: Slice C completed. Extended `WorkOrderStatus` with `PENDING_MECHANIC_APPROVAL` and `MECHANIC_REJECTED`. New models: `MechanicOrderPart`, `MechanicOrderApproval`, `InAppNotification`.
- Mechanic orders: Slice D+ AI Find Part Online: uses MiniMax-M3 vision model to identify parts from photos, persists to `MechanicOrderPart`, builds pre-formatted query URLs for Amazon/RockAuto/AutoZone/NAPA/O'Reilly/Advance/ eBay. Requires `MINIMAX_API_KEY`. Falls back to part name query without it.
- Prisma migration safety: `prisma migrate deploy` must complete before new models (`mechanic_order_parts`, `mechanic_order_approvals`, `in_app_notifications`) are first accessed, or Prisma throws P2021.
- Superadmin escape hatch: `/choose-company` page shows "Go to platform dashboard" button when `globalRole === PLATFORM_SUPERADMIN` for deep-link refresh scenarios.
- Bug fix: `mechanic-orders/page.tsx` server components called BFF routes with `apiGet` but received 404 because `apiGet` pointed to API directly. Fixed by routing through API direct path with `selectedCompany.id`.
- Tenant restructure (2026-07-16): `Company.settings` JSON + `CompanyMembership.locationId` (null = all locations). Seed: `pnpm --filter @laborledger/database seed:tenants` with `SEED_OWNER_PASSWORD`. Migration `20260716154500_company_settings_and_membership_location` — review SQL before production migrate.
- Field single-tenant: `WORKER_COMPANY_ID` env var sets company context in `field-company-resolver.ts`. BFF clients (`field-mechanic-client`, `field-checklist-client`, etc.) inject single `companyId` from PIN session. Multi-tenant field routing is the next phase after Android V2.
