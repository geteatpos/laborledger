# LaborLedger Agent Rules

## Mission

Work on LaborLedger as a production system for automotive workshop operations, timekeeping, work orders, field execution, and client invoicing. Prefer small, reversible, verified changes over broad rewrites.

## Product Context

- Product: **LaborLedger**.
- Architecture: pnpm monorepo; NestJS 11 API; Next.js 15 Admin and Field PWA; PostgreSQL; Prisma 6.
- Tenant hierarchy: Platform → Group → Company → Location.
- Core users: platform superadmin, group owner, company admin, supervisor, field employee.
- Core flows: time clock, scheduling, shift review, corrections, weekly close, vehicle intake, inspection, work orders, labor work, client invoices.
- Current production use is effectively single-tenant, although the data model is multi-tenant.

## Required Reading

Before changing code:

1. Read `MEMORY.md`.
2. Read the relevant section of `CODE_GRAPH.md`.
3. Inspect the implementation and tests; analysis documents are context, not runtime proof.
4. Load the smallest relevant skill from `.opencode/skills/`.

## Non-Negotiable Invariants

1. Every tenant-owned query must scope by `companyId`; add `groupId` or `locationId` where the domain requires it.
2. Admin and Field clients must use their Next.js BFF routes. Do not expose or call the NestJS API directly from the browser.
3. Do not weaken cookie-session authentication, role authorization, supervisor location scope, PIN validation, punch idempotency, or weekly-close locks.
4. Do not change `schema.prisma`, run a destructive Prisma command, or rewrite migration history without an explicit migration plan and user approval.
5. Never run `prisma migrate reset`, `prisma db push --force-reset`, destructive SQL, production deploys, PM2 restarts, or data backfills without explicit approval.
6. Never read, print, copy, commit, or document secret values. Use environment-variable names only.
7. Do not expand legacy Kiosk/Worker modules, AI Shopping, Telegram commands, or additional VIN providers unless the task explicitly requires it.
8. Do not refactor `company-operations.service.ts` broadly. Extract one bounded responsibility at a time with compatibility tests.
9. Preserve money, time zone, date, status-machine, snapshot, and idempotency semantics. Never “simplify” these without tracing all reads and writes.
10. A change is not complete until focused verification passes or the exact blocking failure is reported.

## Current Priority Order

1. Backups and restore verification.
2. Storage capacity and MIME validation.
3. Telegram tenant isolation.
4. Correct employee identity in vehicle inspection.
5. Logging for swallowed errors.
6. Focused UX consistency and error handling.
7. CI, E2E tests, multi-tenant Field routing, then deep refactors.

## Change Workflow

1. Restate the requested outcome and identify the affected flow.
2. Map entry point → BFF → API controller → service → Prisma models → side effects → tests.
3. State assumptions and risks before editing.
4. Make the smallest coherent patch.
5. Add or update tests at the nearest useful level.
6. Run focused checks first, then broader checks only when warranted.
7. Review `git diff` for tenant leaks, secrets, accidental generated files, and unrelated edits.
8. Update `MEMORY.md` only for durable decisions, discovered invariants, or changed architecture.
9. Update `CODE_GRAPH.md` when module boundaries, routes, data ownership, or critical dependencies change.

## Verification Commands

Use repository scripts as the source of truth. Typical commands identified by the analysis are:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Prefer package- or test-file-specific commands before running the whole suite. Do not claim a command passed unless it was executed successfully.

## Definition of Done

- Requested behavior is implemented without unrelated scope.
- Tenant and authorization boundaries are explicit.
- Error paths are handled and observable.
- Focused tests cover the regression or feature.
- Lint/typecheck/tests relevant to the change pass.
- No secrets, destructive commands, or production actions were introduced.
- Durable architecture changes are reflected in `MEMORY.md` and `CODE_GRAPH.md`.

## Response Format

For implementation work, report:

1. What changed.
2. Why this is the smallest safe solution.
3. Files changed.
4. Verification performed and results.
5. Remaining risks or follow-up work.
