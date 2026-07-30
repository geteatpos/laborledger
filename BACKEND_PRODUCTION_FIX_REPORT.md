# Backend Production Fix Report

- **Workspace:** `/home/ubuntu/apps/laborledger`
- **Date (UTC):** 2026-07-28
- **Scope:** API + PostgreSQL only
- **Not modified:** `/home/ubuntu/apps/laborledger-fleetstaff-recovery` (HEAD remains `4314ed3fdaab388534b5582e88daa3ed2220e318`), `apps/admin`, Android, Stitch design
- **No GitHub / no push**

## 1. Pre-change backups & PM2 identity

| Item | Detail |
|---|---|
| Source backup dir | `/home/ubuntu/backups/laborledger/backend-fix-20260728/` |
| Files backed up | `kiosk-punch.service.ts`, `mobile-field.service.ts`, `labor-work-assignment.service.ts`, `field-job.service.ts`, `worker-auth.helper.ts`, `mobile-field.controller.ts` |
| DB dump | `servihour-20260728T230857Z.dump` (pg_dump custom format, ~365KB) |
| PM2 API process | `laborledger-api` (cwd `/home/ubuntu/apps/laborledger`, PORT `4000`) |
| DB used by PM2 API | host `127.0.0.1:5432` / db `servihour` (same DB inspected for migrations) |
| Other PM2 (untouched) | `laborledger-admin`, `laborledger-field` |

Secrets were not printed in this report.

## 2. Root causes

### 2.1 Clock mobile (`lookupByEmployeeId` / `processPunchByEmployeeId`)

- `MobileFieldService` correctly injects `KioskPunchService` and calls:
  - `lookupByEmployeeId(kiosk, session.employeeId)`
  - `processPunchByEmployeeId(kiosk, session.employeeId, …)`
- Those methods **did not exist** on `KioskPunchService` (src or dist). Only PIN-based `lookup` / `processPunch` existed.
- Not a wrong DI target and not merely a stale build: the methods were missing from source.

### 2.2 PIN required on Bearer `/mobile/field/*`

- Mobile field routes pass `{ companyId, employeeId }` into domain services.
- `LaborWorkAssignmentService` and `FieldJobService` authenticated only via PIN (`Employee PIN must be exactly 6 digits.` when `pin` was undefined).
- Kiosk PIN flow must remain unchanged.

### 2.3 Invoice Prisma `P2022` (`lineSubtotalMinor`)

- Column declared in `packages/database/prisma/schema.prisma`.
- Migration present: `20260728041000_add_line_item_manual_fields`.
- Pending on production DB (with sibling `20260728040908_add_invoice_payment_model`).
- Confirmed column missing before deploy; present after `prisma migrate deploy`.

## 3. Fixes applied

### 3.1 `KioskPunchService`

- Added `lookupByEmployeeId` and `processPunchByEmployeeId`.
- Refactored shared punch/lookup core used by both PIN and employee-id paths.
- Kiosk `lookup` / `processPunch` still require 6-digit PIN.

### 3.2 Field auth without PIN for mobile sessions

- Extended `worker-auth.helper.ts` with `resolveEmployeeById` + `resolveFieldEmployee` (prefer `employeeId`, else PIN).
- `FieldJobService`: options / create / VIN decode / recent completions use `resolveFieldEmployee`.
- Added `createJob` alias → `createAndCompleteJob` (used by `MobileFieldService`).
- `LaborWorkAssignmentService.authenticateFieldEmployee`: accepts optional `employeeId` for Bearer sessions; PIN path retained for field/kiosk PWA controllers.

### 3.3 Database

```text
prisma migrate deploy
  → 20260728040908_add_invoice_payment_model
  → 20260728041000_add_line_item_manual_fields
prisma generate
```

- No `migrate reset`, no DB drop/recreate.
- Verified columns on `client_invoice_lines`: `lineSubtotalMinor`, `taxAmountMinor`, `lineItemType`.

### 3.4 Build & restart

- `pnpm --filter @laborledger/api build` succeeded.
- Confirmed in `apps/api/dist`:
  - `kiosk-punch.service.js`: `lookupByEmployeeId`, `processPunchByEmployeeId`
  - `worker-auth.helper.js`: `resolveFieldEmployee`
  - `field-job.service.js`: `createJob`, `resolveFieldEmployee` usage
- Restarted **only** `pm2 restart laborledger-api`.
- Nest boot: `Nest application successfully started` (pid after restart online).

## 4. Endpoint test results (real)

Bearer session minted for the **same** live mobile identity used in production failures:

- employeeId `cms3ns8b70001sjdecsz33xc3` (Test NFC Employee)
- companyId `cmrnw260c000bsjbeavwh92yr`
- locationId `cmrnw260e000fsjbeg8znqmpp`
- deviceId `cms0yo8xq005esjeszrjheium`

Token value is not included in this report.

| Endpoint | Method | HTTP | Result |
|---|---|---:|---|
| `/mobile/auth/me` | GET | **200** | Session + employee + ACTIVE device |
| `/mobile/field/clock/status` | GET | **200** | `configured: true`, punch state returned (no TypeError) |
| `/mobile/field/clock/in` | POST | **200** | After creating eligible `SCHEDULED` shift: `punchState: clocked_in` |
| `/mobile/field/clock/in` (already clocked in) | POST | **400** | Business rule: `Clock-in is not allowed for the current punch state.` (expected) |
| `/mobile/field/break/start` | POST | **200** | `punchState: on_break` |
| `/mobile/field/break/end` | POST | **200** | `punchState: clocked_in` |
| `/mobile/field/clock/out` | POST | **200** | `punchState: clocked_out`, workedMinutes returned |
| `/mobile/field/labor-work/active` | GET | **200** | No PIN error; assignment payload |
| `/mobile/field/labor-work/available-options` | GET | **200** | Clients/locations/catalog/vehicles (no PIN error) |
| `/mobile/field/jobs/options` | GET | **200** | Options list (no PIN error) |
| `/mobile/field/jobs/decode-vin` | POST | **200** | NHTSA decode for `1HGBH41JXMN109186` |
| Invoice `cms4025a20056sj0osp33argx` via API | GET `/company-operations/client-invoices/cms4025a20056sj0osp33argx` | **200** | `INV-20260728-0004`, lines include `lineSubtotalMinor` |
| Same invoice via admin BFF `:3000` | GET `/api/company-operations/client-invoices/cms4025a20056sj0osp33argx` | **200** | `hasLineSubtotal: true` |

## 5. Post-fix log confirmation

Error log entries **after** API restart (`23:11` local):

| Pattern | Count after restart |
|---|---:|
| `lookupByEmployeeId is not a function` | **0** |
| `processPunchByEmployeeId is not a function` | **0** |
| `Employee PIN must be exactly 6 digits` on Bearer field tests | **0** |
| Prisma `P2022` | **0** |
| New `ExceptionsHandler` 500s related to above | **0** |

(Historical occurrences remain in older log lines from before the restart.)

## 6. Files changed (laborledger only)

- `apps/api/src/modules/kiosk/kiosk-punch.service.ts`
- `apps/api/src/modules/worker/worker-auth.helper.ts`
- `apps/api/src/modules/worker/field-job.service.ts`
- `apps/api/src/modules/labor-work-assignment/labor-work-assignment.service.ts`
- DB migrations applied (not reset)
- `apps/api/dist/**` regenerated by build

## 7. Stop point

Backend clock, labor-work/jobs Bearer auth, and invoice column migration are verified working. No commit/push performed in this step. Ready for human review before any further promotion of admin UI recovery.
