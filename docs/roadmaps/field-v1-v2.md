# LaborLedger Field — Version 1 & Version 2 Roadmap

> Document status: **DRAFT**
> Created: 2026-07-20
> App: `apps/field` (Next.js 15 Field PWA)
> Based on: `docs/agent-system/CLEAN-REPOSITORY-AUDIT.md`, `MEMORY.md`, `laborledger-v1-v2.md`

---

## Table of Contents

1. [Document Relationship](#1-document-relationship)
2. [Overview](#2-overview)
3. [Dual-Mode Architecture](#3-dual-mode-architecture)
4. [Technical Design](#4-technical-design)
5. [Page and Route Inventory](#5-page-and-route-inventory)
6. [Known Issues](#6-known-issues)
7. [Version 1 Scope: Maintenance Only](#7-version-1-scope-maintenance-only)
8. [Version 2 Scope: Android Migration](#8-version-2-scope-android-migration)
9. [Feature Parity Checklist](#9-feature-parity-checklist)
10. [PWA Retirement Conditions](#10-pwa-retirement-conditions)
11. [V1 to V2 Migration Phases](#11-v1-to-v2-migration-phases)

---

## 1. Document Relationship

This document is the **companion to `laborledger-v1-v2.md`** for the Field PWA specifically. The main roadmap covers:

- Android app (V1/V2) as the replacement for the Field PWA
- PWA migration and retirement policy (§11)
- Feature parity between Field PWA and Android

This document provides the **deep-dive on the Field PWA itself**: its two operating modes, current architecture, known issues, and the migration path to Android.

```
laborledger-v1-v2.md     → Android strategy, hardware pilot, security fixes
field-v1-v2.md (this)    → Field PWA internals, known issues, migration from PWA
```

---

## 2. Overview

The LaborLedger Field PWA (`apps/field`) is a Next.js 15 application serving workshop floor employees. It is the **employee-facing operational interface** — distinct from the Admin app (supervisors/admins) and the NestJS API (business logic).

| Property | Value |
|----------|-------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Port | 3001 |
| Auth | 6-digit PIN (Argon2id on API); HMAC-signed cookie session |
| Tenant resolution | Hostname-based (DB) or `WORKER_COMPANY_ID` env (single-tenant fallback) |
| Offline support | localStorage (no service worker; no offline queue for work orders) |
| PWA manifest | Configured; theme color `#0f8a66`; standalone display |
| Status | **FROZEN** — no new features; security fixes only |

The Field PWA serves two distinct use cases from a single codebase, differentiated by URL path:

```
/field/kiosk/*   → Fixed station: clock in/out, breaks only
/field/worker/*  → Mobile/tablet: vehicle intake, VIN scan, work orders, labor tracking
/field/*         → Shared: login, shifts, summary
```

---

## 3. Dual-Mode Architecture

The Field PWA has two modes that share components but serve different physical contexts.

### 3.1 Kiosk Mode (`/field/kiosk/*`, `/field/clock`)

**Purpose:** Fixed station terminal — typically a tablet mounted near the shop entrance. Employees clock in and out, take breaks.

**Physical context:** Shared device; one employee at a time; no NFC badge scanning; PIN-only authentication.

**Key routes:**

| Route | Component | Purpose |
|-------|-----------|---------|
| `/field/kiosk` | — | Redirects to `/field/clock` |
| `/field/kiosk/punch` | `KioskPunchPanel` | Punch action UI (clock in/out, breaks) |
| `/field/clock` | `FieldClockPanel` | Same as above; `/field/clock` is the canonical route |

**Auth mechanism:** Kiosk mode uses **server-to-server header authentication** — `KIOSK_ID` and `KIOSK_SECRET` HTTP headers sent from the Next.js BFF to the NestJS API. The PIN is validated server-side. No browser-exposed credentials.

```typescript
// apps/field/src/lib/field-kiosk-client.ts (server-only)
function kioskHeaders(): Record<string, string> {
  return {
    "x-kiosk-id": process.env.KIOSK_ID!,
    "x-kiosk-secret": process.env.KIOSK_SECRET!
  };
}
```

**Session:** No cookie session for kiosk mode. Each punch action is stateless, validated against the kiosk's credentials and the employee's PIN.

**Bootstrap:** `GET /field/bootstrap` is called without authentication. Returns `{ clock: { available: true } }` if `KIOSK_ID`/`KIOSK_SECRET` are configured.

### 3.2 Worker Mode (`/field/worker/*`, `/field/home`, `/field/work`)

**Purpose:** Mobile or tablet use by field employees. Full vehicle intake, VIN scanning, work order execution, labor tracking.

**Physical context:** Individual employee using their own device (or shared in some shops). Full PIN-based login with cookie session.

**Key routes:**

| Route | Component | Purpose |
|-------|-----------|---------|
| `/field/login` | `FieldLoginPanel` | PIN entry |
| `/field/home` | `FieldHomePanel` | Hub: assigned work, current state |
| `/field/work` | `EmployeeWorkExecutionPanel` | Active work order execution |
| `/field/worker` | `WorkerAssignmentsPanel` | Assigned work orders list |
| `/field/worker/home` | — | Redirects to `/field/home` |
| `/field/worker/clock` | `FieldClockPanel` | Clock in/out |
| `/field/worker/scan-vin` | `VinCameraScan` | Camera VIN scanner (ZXing WASM) |
| `/field/worker/summary` | `FieldSummaryPage` | Employee's daily/weekly summary |
| `/field/shifts` | `MyShiftsPanel` | Shift history |
| `/field/summary` | `FieldSummaryPage` | Same as above |
| `/field/offline` | — | Offline mode page |

**Auth mechanism:** Employee enters 6-digit PIN. BFF calls `POST /worker/lookup` or `POST /field/clock/lookup`. On success, sets `laborledger.field.sid` HMAC-signed cookie.

**Session cookie:**

```typescript
// apps/field/src/lib/field-session.ts
export const FIELD_SESSION_COOKIE = "laborledger.field.sid";
export const FIELD_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
```

Cookie is HTTP-only, signed with HMAC-SHA256 using `FIELD_SESSION_SECRET` / `KIOSK_SECRET` / `WORKER_COMPANY_ID` as the key. Not a JWT — opaque token validated server-side via timing-safe comparison.

**Tenant resolution:** Two mechanisms, tried in order:

1. **Hostname-based (primary):** `GET /field/bootstrap` with `x-field-host` header → NestJS looks up company/location by hostname → returns configured features
2. **Environment variable (fallback):** `WORKER_COMPANY_ID`, `FIELD_COMPANY_DISPLAY_NAME`, `FIELD_LOCATION_DISPLAY_NAME`, `FIELD_LOCATION_ID` → single-tenant, hardcoded

> **Risk:** The env-var fallback is single-tenant. Real multi-tenant routing requires hostname-based resolution and device enrollment (see `laborledger-v1-v2.md` §6). This is a V2 Android fix, not a PWA fix.

---

## 4. Technical Design

### 4.1 BFF Pattern

The Field PWA follows the BFF (Backend for Frontend) pattern. Browser clients never call the NestJS API directly. All API calls go through Next.js Route Handlers (`src/app/api/`).

```
Browser → Next.js Route Handler → NestJS API → Prisma → PostgreSQL
```

**Route handler location:** `apps/field/src/app/api/{module}/{resource}/route.ts`

| Module | Route prefix | Purpose |
|--------|-------------|---------|
| `field/` | `/api/field/*` | Clock, login, bootstrap, context, jobs, labor-work, checklist, photos |
| `kiosk/` | `/api/kiosk/*` | Kiosk punch/lookup (server-to-server headers, not browser) |
| `worker/` | `/api/worker/*` | Scan, complete-service, work-orders, lookup |

Each route handler is thin — it extracts auth context (cookie session or kiosk headers), forwards the request to the NestJS API, and returns the response to the browser.

### 4.2 Session Management

```
Employee enters PIN
       ↓
POST /api/field/login (or /api/kiosk/lookup)
       ↓
NestJS validates PIN via Argon2id
       ↓
Next.js BFF receives session data
       ↓
Sets HttpOnly, SameSite=Lax, Secure cookie: laborledger.field.sid
       ↓
HMAC-SHA256 signed; payload: { employeeId, employeeName, companyId, locationId, pin (masked), issuedAt }
       ↓
All subsequent requests: cookie automatically included
       ↓
readFieldSession() validates: signature, pin format (6 digits), TTL (8h)
```

Session secret hierarchy (first available):
1. `FIELD_SESSION_SECRET` env var
2. `KIOSK_SECRET` env var
3. `WORKER_COMPANY_ID` env var

### 4.3 Middleware

`apps/field/src/middleware.ts` applies to all `/api/*` and `/field/*` routes:

| Feature | Implementation |
|---------|---------------|
| Rate limiting | In-memory Map; `field-login`: 10 req/5min per IP; `field-actions`: 120 req/min per IP |
| Security headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy: microphone=(), geolocation=()` |

### 4.4 Offline Strategy

The Field PWA uses **localStorage for offline state** but has **no service worker for offline work order access**.

```
Offline writes: localStorage.setItem("ll_pending_punch", JSON.stringify(punchEvent))
Online sync:   navigator.onLine listener → flush queue on reconnect
```

Offline capabilities are limited to:
- Caching the current session (not the employee list or work orders)
- Storing pending punch events until reconnect

**Gap:** Work order data (assigned lines, checklist items) is not cached. An employee who loses connectivity mid-work-order cannot see their checklist. This is addressed in Android V1 offline queue (see `laborledger-v1-v2.md` §3.5).

### 4.5 PWA Configuration

```typescript
// apps/field/src/lib/field-pwa.ts
FIELD_PWA_NAME = "LaborLedger Field"
FIELD_PWA_THEME_COLOR = "#0f8a66"
FIELD_PWA_START_URL = "/field/login"
FIELD_PWA_DISPLAY = "standalone"
```

PWA icons: `/public/icons/field-icon.svg`. The PWA is installable on mobile devices as a standalone app.

---

## 5. Page and Route Inventory

### 5.1 Authentication

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| `/field/login` | `FieldLoginPanel` | No | Redirects to `/field/home` if already logged in |

### 5.2 Kiosk / Clock

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| `/field/kiosk` | — | No | Redirects to `/field/clock` |
| `/field/kiosk/punch` | `KioskPunchPanel` | Kiosk headers | Server-side only; no browser session |
| `/field/clock` | `FieldClockPanel` + `EmployeeHelpCard` | Cookie session | Canonical kiosk route; also accessible from worker mode |

### 5.3 Worker: Hub and Navigation

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| `/field/home` | `FieldHomePanel` | Cookie session | Main hub after login |
| `/field/worker` | `WorkerAssignmentsPanel` | Cookie session | Work order assignments list |
| `/field/worker/home` | — | Cookie session | Redirects to `/field/home` |
| `/field/worker/clock` | `FieldClockPanel` | Cookie session | Clock page in worker mode |
| `/field/worker/summary` | `FieldSummaryPage` | Cookie session | Employee summary |
| `/field/shifts` | `MyShiftsPanel` | Cookie session | Shift history |
| `/field/summary` | `FieldSummaryPage` | Cookie session | Alias for `/field/worker/summary` |
| `/field/select-mode` | — | No | Redirects to `/field/login` |

### 5.4 Worker: Vehicle and VIN

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| `/field/worker/scan-vin` | `VinCameraScan` | Cookie session | Camera-based VIN scanner (ZXing WASM) |
| `/field/jobs/new` | `ReceiveVehiclePanel` | Cookie session | Vehicle intake: scan/enter VIN, create work order |

### 5.5 Worker: Job Execution

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| `/field/work` | `EmployeeWorkExecutionPanel` | Cookie session | Active job execution view |
| `/field/jobs/[jobId]` | `EmployeeJobWorkflowPanel` | Cookie session | Job detail with service lines |
| `/field/jobs/[jobId]/notes` | `EmployeeJobNotesForm` / `EmployeeJobNotesPagePanel` | Cookie session | Job notes |

### 5.6 Worker: Service and Labor

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| `/field/jobs/[jobId]/services/mark` | (via route handler) | Cookie session | Mark service line complete |
| `/field/jobs/[jobId]/finalize` | (via route handler) | Cookie session | Finalize work order |

### 5.7 Worker: Inspection and Checklist

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| — | `VehicleChecklistPanel` | Cookie session | Vehicle inspection checklist |
| — | `ServiceChecklistPanel` | Cookie session | Service checklist (embedded in job) |

### 5.8 Worker: Photos and Parts

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| — | `VehiclePhotosCapture` | Cookie session | Photo capture for vehicles |
| — | `MechanicPartsEditor` | Cookie session | AI-assisted parts identification |

### 5.9 Utility

| Route | Component | Auth required | Notes |
|-------|-----------|--------------|-------|
| `/field/offline` | — | No | Offline fallback page |
| — | `NotificationsPanel` | Cookie session | Employee notifications |
| — | `EmployeeHelpCard` | — | Help card (shared) |
| — | `EmployeeLaborWorkPanel` | Cookie session | Labor work assignment start/progress/complete |

### 5.10 API Route Handlers

| Handler | Path | Auth | Purpose |
|---------|------|------|---------|
| `login/route.ts` | `POST /api/field/login` | None | PIN login → sets cookie |
| `logout/route.ts` | `POST /api/field/logout` | Cookie | Clears cookie |
| `me/route.ts` | `GET /api/field/me` | Cookie | Current employee info |
| `bootstrap/route.ts` | `GET /api/field/bootstrap` | None | Tenant/company resolution |
| `context/route.ts` | `GET /api/field/context` | Cookie | Current job context |
| `clock/in/route.ts` | `POST /api/field/clock/in` | Cookie | Clock in |
| `clock/out/route.ts` | `POST /api/field/clock/out` | Cookie | Clock out |
| `clock/status/route.ts` | `GET /api/field/clock/status` | Cookie | Clock status |
| `break/start/route.ts` | `POST /api/field/break/start` | Cookie | Start break |
| `break/end/route.ts` | `POST /api/field/break/end` | Cookie | End break |
| `shifts/route.ts` | `GET /api/field/shifts` | Cookie | Employee shifts |
| `jobs/route.ts` | `GET/POST /api/field/jobs` | Cookie | List/create jobs |
| `jobs/[jobId]/route.ts` | `GET/PATCH /api/field/jobs/[jobId]` | Cookie | Job detail/update |
| `jobs/[jobId]/complete/route.ts` | `POST /api/field/jobs/[jobId]/complete` | Cookie | Complete job |
| `jobs/[jobId]/notes/route.ts` | `GET/POST /api/field/jobs/[jobId]/notes` | Cookie | Job notes |
| `jobs/[jobId]/services/mark/route.ts` | `POST /api/field/jobs/[jobId]/services/mark` | Cookie | Mark service |
| `jobs/[jobId]/services/unmark/route.ts` | `POST /api/field/jobs/[jobId]/services/unmark` | Cookie | Unmark service |
| `jobs/[jobId]/finalize/route.ts` | `POST /api/field/jobs/[jobId]/finalize` | Cookie | Finalize job |
| `jobs/scan/route.ts` | `POST /api/field/jobs/scan` | Cookie | Record scan event |
| `jobs/decode-vin/route.ts` | `POST /api/field/jobs/decode-vin` | Cookie | NHTSA VIN decode |
| `jobs/options/route.ts` | `GET /api/field/jobs/options` | Cookie | Job type options |
| `jobs/context/route.ts` | `GET /api/field/jobs/context` | Cookie | Job context |
| `checklist/route.ts` | `GET/POST /api/field/checklist` | Cookie | Inspection checklists |
| `checklist/[id]/route.ts` | `GET/PATCH /api/field/checklist/[id]` | Cookie | Checklist detail |
| `checklist/[id]/complete/route.ts` | `POST /api/field/checklist/[id]/complete` | Cookie | Complete checklist |
| `checklist/[id]/items/[itemId]/route.ts` | `PATCH /api/field/checklist/[id]/items/[itemId]` | Cookie | Update checklist item |
| `labor-work/active/route.ts` | `GET /api/field/labor-work/active` | Cookie | Active labor assignment |
| `labor-work/start/route.ts` | `POST /api/field/labor-work/start` | Cookie | Start labor work |
| `labor-work/[id]/progress/route.ts` | `POST /api/field/labor-work/[id]/progress` | Cookie | Update progress |
| `labor-work/[id]/complete/route.ts` | `POST /api/field/labor-work/[id]/complete` | Cookie | Complete labor work |
| `labor-work/[id]/block/route.ts` | `POST /api/field/labor-work/[id]/block` | Cookie | Block labor work |
| `labor-work/[id]/cancel/route.ts` | `POST /api/field/labor-work/[id]/cancel` | Cookie | Cancel labor work |
| `labor-work/available-options/route.ts` | `GET /api/field/labor-work/available-options` | Cookie | Available labor options |
| `mechanic-orders/route.ts` | `GET/POST /api/field/mechanic-orders` | Cookie | Mechanic work orders |
| `mechanic-orders/[workOrderId]/route.ts` | `GET/PATCH /api/field/mechanic-orders/[workOrderId]` | Cookie | Work order detail |
| `mechanic-orders/[workOrderId]/parts/route.ts` | `GET/POST /api/field/mechanic-orders/[workOrderId]/parts` | Cookie | Parts list |
| `mechanic-orders/[workOrderId]/parts/[partId]/route.ts` | `PATCH /api/field/mechanic-orders/[workOrderId]/parts/[partId]` | Cookie | Update part |
| `mechanic-orders/[workOrderId]/parts/[partId]/ai-identify/route.ts` | `POST .../ai-identify` | Cookie | AI part identification |
| `mechanic-orders/[workOrderId]/parts/[partId]/ai-apply/route.ts` | `POST .../ai-apply` | Cookie | Apply AI part suggestion |
| `photos/[photoId]/stream/route.ts` | `GET /api/field/photos/[photoId]/stream` | Cookie | Stream photo |
| `vehicles/[vehicleId]/photos/route.ts` | `POST /api/field/vehicles/[vehicleId]/photos` | Cookie | Upload vehicle photo |
| `notifications/route.ts` | `GET /api/field/notifications` | Cookie | Employee notifications |
| `notifications/[id]/read/route.ts` | `POST /api/field/notifications/[id]/read` | Cookie | Mark notification read |

### 5.11 Worker-Specific API Routes

| Handler | Path | Auth | Purpose |
|---------|------|------|---------|
| `worker/lookup/route.ts` | `POST /api/worker/lookup` | None | PIN lookup (used by worker login) |
| `worker/scan/route.ts` | `POST /api/worker/scan` | Cookie | Record scan event (VIN confirmation) |
| `worker/service-lines/[workOrderServiceLineId]/complete/route.ts` | `POST /api/worker/service-lines/[id]/complete` | Cookie | Complete service line |
| `worker/work-orders/[workOrderId]/services/mark/route.ts` | `POST /api/worker/work-orders/[id]/services/mark` | Cookie | Mark service |
| `worker/work-orders/[workOrderId]/services/unmark/route.ts` | `POST /api/worker/work-orders/[id]/services/unmark` | Cookie | Unmark service |
| `worker/work-orders/[workOrderId]/finalize/route.ts` | `POST /api/worker/work-orders/[id]/finalize` | Cookie | Finalize work order |
| `worker/jobs/options/route.ts` | `GET /api/worker/jobs/options` | Cookie | Worker job options |
| `kiosk/lookup/route.ts` | `POST /api/kiosk/lookup` | Kiosk headers | Server-to-server PIN lookup |
| `kiosk/punch/route.ts` | `POST /api/kiosk/punch` | Kiosk headers | Server-to-server punch |

---

## 6. Known Issues

These issues are documented in `MEMORY.md` and `CLEAN-REPOSITORY-AUDIT.md`. Only the PWA-relevant ones are listed here.

### 6.1 CRITICAL — Multi-Tenant Routing Blocked

| Issue | Location | Impact |
|-------|----------|--------|
| `WORKER_COMPANY_ID` env var hardcodes single company | `field-bootstrap.ts`, `field-session.ts` | Field PWA cannot serve multiple companies via hostname routing. Real multi-tenant requires Android device enrollment (see `laborledger-v1-v2.md` §6). |

This is **not being fixed in the PWA**. The fix is Android V1 device enrollment.

### 6.2 HIGH — Vehicle Inspection Uses Wrong Employee

| Issue | Location | Impact |
|-------|----------|--------|
| Inspection checklist `employeeId` assigned via `findFirst({ orderBy: { createdAt: 'asc' } })` instead of authenticated session employee | `VehicleInspectionService.createWorkerChecklist` | Inspections are attributed to the first employee who created any checklist on the vehicle, not the actual inspector. Fix required before pilot per `laborledger-v1-v2.md` §13. |

This affects the Field PWA's inspection flow (`VehicleChecklistPanel`). The fix is in the NestJS API (`apps/api`), not the PWA.

### 6.3 MEDIUM — Missing Error Logging in Catch Blocks

| File | Issue |
|------|-------|
| `workspace-auth.ts` | Catch block without `logger.warn()` — authentication failures are silent |
| `storage.service.ts` | Catch block without `logger.warn()` — storage failures are silent |

These are NestJS API files. The Field PWA calls these via the BFF. Fixing them does not require PWA changes.

### 6.4 MEDIUM — exactOptionalPropertyTypes Violations

The `exactOptionalPropertyTypes: true` compiler option causes TS2379 errors when passing `undefined` to optional properties. These exist in the NestJS API controllers called by the Field PWA:

| Controller | Endpoints affected |
|------------|-------------------|
| `worker.controller.ts` | `scan`, `completeServiceLine`, `createFieldJob`, `lookup` |
| `field-bootstrap.controller.ts` | `clockLookup`, `clockPunch` |
| `field-job.controller.ts` | Multiple |

These are NestJS-layer fixes. The Field PWA's BFF route handlers pass through the optional fields as-is. See `laborledger-v1-v2.md` §13 H2.

### 6.5 MEDIUM — Pre-Existing Lint Errors

Four files have lint errors that are pre-existing (not introduced by recent changes):

| File | Error |
|------|-------|
| `sync-zxing-wasm.mjs` | Likely ESLint or Prettier error |
| `MechanicPartsEditor.tsx` | Likely missing/incorrect JSX or import |
| `VehiclePhotosCapture.tsx` | Likely missing/incorrect JSX or import |
| `packages/database/src/seed-demo.ts` | `prefer-const` (line 744: `existing` should be `const`) |

These should be fixed as part of V1 maintenance.

### 6.6 MEDIUM — Storage Lacks Disk/MIME Validation

| Issue | Location | Impact |
|-------|----------|--------|
| No disk space check before saving file | `StorageService.saveFile()` | Upload can fail silently or corrupt data |
| No MIME type enforcement beyond multer defaults | `StorageService.saveFile()` | Unsafe file types may be stored |

These are NestJS API fixes. Photo capture in the Field PWA (`VehiclePhotosCapture`) is affected.

---

## 7. Version 1 Scope: Maintenance Only

The Field PWA is **frozen**. No new features, no UX improvements, no refactoring — unless security-critical.

### 7.1 V1 Policy

> **"FROZEN"** means: only the following types of changes are permitted:
> 1. Security fixes (authentication, authorization, injection, XSS)
> 2. Data integrity fixes (wrong employeeId, wrong companyId)
> 3. Crash fixes (unhandled exceptions, uncaught promise rejections)
> 4. Breaking API fixes (field type changes that prevent compilation)
>
> All other work — UX improvements, new screens, new API routes, refactoring — is **prohibited** unless it unblocks the Android V1 pilot.

### 7.2 V1 Allowed Changes

| Priority | Issue | Fix location | Type |
|----------|-------|-------------|------|
| HIGH | Vehicle inspection wrong `employeeId` (H1) | NestJS API | Data integrity |
| MEDIUM | Catch blocks without logging (M1) | NestJS API | Security/logging |
| MEDIUM | Pre-existing lint errors | Field PWA | Code hygiene |
| MEDIUM | Storage disk/MIME validation (H3, H4) | NestJS API | Security |
| LOW | Remaining TS2379 in worker controller | NestJS API | Type safety |

### 7.3 V1 Explicit Non-Goals

The following are **not permitted** in V1:

| Non-Goal | Reason |
|----------|--------|
| Adding new features to Kiosk/Worker modules | Expands frozen code; Android replaces these |
| Multi-tenant routing fix in PWA | Requires PWA rewrite; Android has proper fix |
| Service worker for offline work orders | Android V1 has proper offline queue |
| New API routes for PWA | All new routes go in Android MobileModule |
| Refactoring `field-job.service.ts`, `field-clock-utils.ts`, etc. | Frozen code; Android replaces these |
| UI/UX changes | Not security fixes |

---

## 8. Version 2 Scope: Android Migration

V2 is not a version of the PWA — it is the **deprecation of the PWA** in favor of the native Android app.

### 8.1 What Android Replaces

| Field PWA | Android equivalent | Notes |
|-----------|-------------------|-------|
| `/field/kiosk/*` (clock station) | Android V1 (TC22 / Tab Active5) | NFC badge + PIN; fixed station |
| `/field/worker/*` (full field ops) | Android V1 | NFC badge + PIN; mobile; offline queue |
| `/field/worker/scan-vin` (ZXing WASM camera) | Android V2 (TC22 barcode or ML Kit) | TC22 has built-in scanner |
| `VehicleChecklistPanel` (inspection) | Android V2 | Fixed employeeId attribution |
| `EmployeeLaborWorkPanel` | Android V2 | Labor work assignment on Android |
| `VehiclePhotosCapture` | Android V2 | Photo capture with MIME/size validation |
| `MechanicPartsEditor` + AI identify | Android V2 | AI part identification on Android |

### 8.2 What Survives Beyond PWA Retirement

| Component | Status |
|-----------|--------|
| NestJS `MobileModule` | V1 — new mobile API |
| NestJS `WorkerController` | Deprecated after PWA retirement; Android uses `MobileModule` |
| NestJS `FieldBootstrapController` | Deprecated after PWA retirement |
| NestJS `FieldJobService`, `FieldJobController` | Deprecated after PWA retirement |
| NestJS `KioskPunchService`, `KioskController` | Continues for physical kiosk hardware |
| `EmployeeBadgeCredential`, `Device`, `MobileSession` models | V1 — required for Android |

### 8.3 Kiosk Hardware Coexistence

Physical kiosk hardware (dedicated clock terminals) may continue using the existing `/kiosk/*` NestJS endpoints. These are **not** replaced by Android — they are a separate system using the same NestJS API.

```
Physical kiosk terminal → KioskPunchService (NestJS) → Prisma → PostgreSQL
Android V1 app         → MobileModule (NestJS)       → Prisma → PostgreSQL
Field PWA (deprecated) → WorkerController (NestJS)    → Prisma → PostgreSQL
```

The `KIOSK_ID`/`KIOSK_SECRET` header-authenticated endpoints are independent of the PWA and survive beyond PWA retirement.

---

## 9. Feature Parity Checklist

This checklist tracks which Field PWA features are replaced by Android V1 and V2.

| Feature | Field PWA | Android V1 | Android V2 |
|---------|-----------|-----------|-----------|
| PIN login | ✅ | ✅ | ✅ |
| Cookie session (HMAC) | ✅ | ❌ (Bearer token) | ❌ (Bearer token) |
| NFC badge + PIN | ❌ | ✅ | ✅ |
| Clock in/out | ✅ | ✅ | ✅ |
| Start/end break | ✅ | ✅ | ✅ |
| Shift history | ✅ | ✅ | ✅ |
| Offline punch queue | ❌ | ✅ | ✅ |
| Kiosk mode (fixed station) | ✅ | ✅ (Android) | ✅ |
| Hostname-based tenant routing | ⚠️ (env fallback) | ✅ (device enrollment) | ✅ |
| Vehicle intake | ✅ | ❌ | ✅ |
| VIN scan (camera) | ✅ (ZXing WASM) | ❌ | ✅ (TC22 or ML Kit) |
| VIN decode (NHTSA) | ✅ | ✅ | ✅ |
| Work order list | ✅ | ❌ | ✅ |
| Service line completion | ✅ | ❌ | ✅ |
| Vehicle inspection checklist | ✅ (wrong employeeId) | ❌ | ✅ (fixed) |
| Labor work assignment | ✅ | ❌ | ✅ |
| Photo capture | ✅ (no MIME/size check) | ❌ | ✅ |
| Mechanic parts + AI identify | ✅ | ❌ | ❌ (not planned) |
| Employee notifications | ✅ | ❌ | ✅ |
| PWA installability | ✅ | ❌ (native) | ❌ (native) |
| Session lifetime | 8 hours | 12 hours | 12 hours |

---

## 10. PWA Retirement Conditions

The Field PWA **must not be removed** until all of the following are true:

| Condition | Verification |
|-----------|-------------|
| Android V1 covers all active punch employees | ` PunchEvent.source = "MOBILE"` count ≥ 95% of active punch events |
| Zero employees actively using Field PWA | `lastSeenAt` on Field PWA sessions is stale (> 30 days) |
| Admin explicitly marks Field PWA as retired | New `FieldPwa.retiredAt` flag in database or Admin setting |
| All work order features migrated to Android V2 | Per feature parity checklist |
| Kiosk endpoints audited for Field PWA references | No API routes in Field PWA BFF call NestJS endpoints that will be removed |
| Database migration to mark Field PWA sessions as superseded | Migration adds `retiredAt` timestamp to all existing Field PWA sessions |

---

## 11. V1 to V2 Migration Phases

### Phase 0 — Field PWA Maintenance (Parallel with Android V1 development)

- [ ] Fix H1: Vehicle inspection `employeeId` (pass from session)
- [ ] Fix M1: Add `logger.warn()` to catch blocks in `workspace-auth.ts`, `storage.service.ts`
- [ ] Fix lint errors in `sync-zxing-wasm.mjs`, `MechanicPartsEditor`, `VehiclePhotosCapture`
- [ ] Fix H3/H4: Storage disk space and MIME validation
- [ ] Fix remaining TS2379 violations in `worker.controller.ts`
- [ ] No new features, no UX changes, no refactoring

### Phase 1 — Android V1 Pilot (Parallel with PWA frozen)

- [ ] Android V1 runs at pilot location alongside Field PWA
- [ ] Pilot employees use Android for clock in/out
- [ ] Field PWA continues for non-pilot employees
- [ ] No changes to Field PWA

### Phase 2 — Android V1 Rollout

- [ ] All employees migrated to Android for time punching
- [ ] Field PWA still serves vehicle intake, work orders, inspections
- [ ] Field PWA usage drops (measured by session `lastSeenAt`)

### Phase 3 — Android V2 Migration

- [ ] Vehicle intake migrated to Android
- [ ] Inspection checklists migrated (with correct `employeeId`)
- [ ] Labor work assignments migrated
- [ ] Photo capture migrated with MIME/size validation
- [ ] MechanicPartsEditor + AI identify → evaluated for Android or retirement

### Phase 4 — Field PWA Retirement

- [ ] Verify retirement conditions (§10)
- [ ] Admin marks Field PWA as retired
- [ ] Remove Field PWA from repository (or archive)
- [ ] Archive `apps/field/` to `apps/field-legacy/`
- [ ] Remove Field PWA BFF route handlers from NestJS API (keep kiosk endpoints)

---

## Appendix A: Key Files Reference

### Field PWA

| File | Purpose |
|------|---------|
| `apps/field/src/middleware.ts` | Rate limiting, security headers |
| `apps/field/src/lib/field-session.ts` | HMAC-signed cookie session management |
| `apps/field/src/lib/field-bootstrap.ts` | Tenant resolution (hostname or env) |
| `apps/field/src/lib/field-kiosk-client.ts` | Server-to-server kiosk auth |
| `apps/field/src/lib/field-pwa.ts` | PWA manifest configuration |
| `apps/field/src/components/employee/FieldLoginPanel.tsx` | PIN login UI |
| `apps/field/src/components/employee/FieldClockPanel.tsx` | Clock in/out/break UI |
| `apps/field/src/components/employee/VinCameraScan.tsx` | ZXing WASM VIN scanner |
| `apps/field/src/components/employee/ReceiveVehiclePanel.tsx` | Vehicle intake |
| `apps/field/src/components/employee/VehicleChecklistPanel.tsx` | Inspection checklists |
| `apps/field/src/components/employee/EmployeeWorkExecutionPanel.tsx` | Work order execution |

### NestJS API (Field PWA backend)

| File | Purpose |
|------|---------|
| `apps/api/src/modules/field/field-bootstrap.controller.ts` | Bootstrap, clock lookup/punch |
| `apps/api/src/modules/field/field-job.controller.ts` | Jobs, services, checklists |
| `apps/api/src/modules/field/field-labor-work.controller.ts` | Labor work |
| `apps/api/src/modules/field/field-bootstrap.service.ts` | Bootstrap business logic |
| `apps/api/src/modules/worker/worker.controller.ts` | Worker scan, complete, lookup |
| `apps/api/src/modules/kiosk/kiosk.controller.ts` | Kiosk punch (physical hardware) |
| `apps/api/src/modules/kiosk/kiosk-punch.service.ts` | Kiosk punch state machine |

---

## Appendix B: Auth Mechanism Comparison

| Aspect | Kiosk mode | Worker mode | Android V1 |
|--------|-----------|-------------|-----------|
| Credential | `KIOSK_ID`/`KIOSK_SECRET` HTTP headers | 6-digit PIN → HMAC cookie | NFC badge + 6-digit PIN → Bearer token |
| Browser exposure | None (server-to-server) | PIN entered, not stored; HMAC cookie HTTP-only | PIN entered, not stored; token in Android Keystore |
| Session lifetime | Per-request (stateless) | 8 hours | 12 hours |
| Revocability | Rotate KIOSK_SECRET | Admin invalidates sessions | Admin or employee logout |
| Tenant isolation | Kiosk bound to locationId | Cookie scoped to companyId | Device enrolled to companyId + locationId |

(End of file)
