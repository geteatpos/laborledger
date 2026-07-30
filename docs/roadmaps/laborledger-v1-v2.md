# LaborLedger — Version 1 & Version 2 Roadmap

> Document status: **DRAFT**
> Created: 2026-07-19
> Based on: `docs/agent-system/CLEAN-REPOSITORY-AUDIT.md` (2026-07-17, commit 9f74ea4)
> Decisions: LaborLedger Version 1 / Version 2 architecture decision (this document)

---

## Table of Contents

1. [Version 1 Scope and Non-Goals](#1-version-1-scope-and-non-goals)
2. [Version 2 Scope and Non-Goals](#2-version-2-scope-and-non-goals)
3. [Native Android Application Architecture](#3-native-android-application-architecture)
4. [Mobile API Boundary and Authentication Flow](#4-mobile-api-boundary-and-authentication-flow)
5. [NFC Badge and PIN Punch Workflow](#5-nfc-badge-and-pin-punch-workflow)
6. [Device Enrollment and Location Binding](#6-device-enrollment-and-location-binding)
7. [VIN Scanning Workflow](#7-vin-scanning-workflow)
8. [Required Database Changes](#8-required-database-changes)
9. [Required API Endpoints](#9-required-api-endpoints)
10. [Required Audit Events](#10-required-audit-events)
11. [PWA Migration and Retirement Plan](#11-pwa-migration-and-retirement-plan)
12. [Hardware Pilot Plan](#12-hardware-pilot-plan)
13. [Security Fixes Required Before Pilot](#13-security-fixes-required-before-pilot)
14. [Testing and Acceptance Criteria](#14-testing-and-acceptance-criteria)
15. [Agent-by-Agent Implementation Assignments](#15-agent-by-agent-implementation-assignments)
16. [Ordered Implementation Phases](#16-ordered-implementation-phases)
17. [Risks, Rollback, and Human Approval Checkpoints](#17-risks-rollback-and-human-approval-checkpoints)

---

## 0. Evidence Base

This document is grounded in the findings of `CLEAN-REPOSITORY-AUDIT.md` (2026-07-17), which confirmed:

| Finding | Severity | Implication for V1/V2 |
|---------|----------|-----------------------|
| Telegram bot exposes all tenant data | CRITICAL | New Android app must enforce company/location scoping from day one |
| Field PWA blocked by `WORKER_COMPANY_ID` | HIGH | Android app needs proper device→company→location resolution |
| Vehicle inspection uses wrong employeeId | HIGH | NFC badge must identify the exact employee performing actions |
| Storage lacks disk/MIME validation | MEDIUM | Photo capture on Android needs explicit size and MIME checks |
| VIN scanner uses stub in production | HIGH | Camera OCR fallback is already in scope; must integrate properly |
| `exactOptionalPropertyTypes` violations | MEDIUM | New API endpoints must handle optional fields strictly |
| Company-operations.service.ts is 4,402 lines | LOW | Ongoing extraction is already planned; not a V1 blocker |
| Prisma migrations: 33 existing | — | Android app schema changes must be additive only for V1 |

### Current Repository Structure

```
laborledger/
├── apps/
│   ├── api/              # NestJS 11 — existing backend (port 4000)
│   ├── admin/            # Next.js 15 — Admin BFF (port 3000)
│   ├── field/            # Next.js 15 Field PWA (port 3001) — FROZEN
│   └── telegram-bot/     # Telegram bot — CRITICAL security fix needed
├── packages/
│   └── database/
│       └── prisma/
│           └── schema.prisma  # 33 migrations, ~40 models
├── tests/                # vitest unit/integration tests
└── docs/
```

### Current Authentication Model

| Client | Auth Method | Tenant Resolution |
|--------|-------------|-----------------|
| Admin | Cookie session (`laborledger.sid`) | `companyId` in session |
| Field PWA | 6-digit PIN | `WORKER_COMPANY_ID` env (single-tenant, hardcoded) |
| Telegram | `ADMIN_CHAT_ID` env | None — BROKEN |
| **Android V1** | **NFC badge + PIN → server-side session** | **Device enrollment → companyId/locationId** |

---

## 1. Version 1 Scope and Non-Goals

### 1.1 In Scope

**Employee Identity and Authentication**
- NFC badge read (ISO/IEC 14443) identifies the employee.
- Employee enters 6-digit PIN on device to confirm presence.
- Server issues an opaque, revocable, server-side mobile session token.
- No fingerprint, no facial recognition.
- PIN is validated server-side only; never stored or replayed after login.

**Time Punching**
- Clock in / clock out / start break / end break via NFC + PIN.
- Punch events are persisted with `employeeId`, `locationId`, `deviceId`, and `companyId`.
- Same punch state machine as existing NestJS `PunchEvent` model.
- Offline queue with server sync when connectivity returns.

**Device Enrollment**
- Each physical device is registered to one company and one location.
- Device record includes hardware identifiers (Android `ANDROID_ID`, device model, OS version).
- A device can only serve the enrolled location.
- Enrollment is done by a company admin via Admin app.

**VIN Scanning**
- Integrated 1D/2D barcode scanning (Zebra TC22 built-in scanner) as primary input.
- Camera OCR fallback (Google ML Kit) when barcode scan fails or is unavailable.
- Scanned VIN displayed for explicit user confirmation before use.
- Normalized and validated against ISO 3779 (check digit) before submission.
- If NHTSA vPIC is available, vehicle details are previewed; graceful fallback to manual entry otherwise.

**Visible Confirmation Before VIN Use**
- Scanned or OCR'd VIN is shown on screen.
- Employee must tap **"Confirm VIN"** to proceed.
- Manual correction is always available.

**Secure Mobile Session Management**
- Opaque JWT-free session token issued by NestJS API.
- Token stored in Android Keystore.
- Token is revocable server-side (existing `Session` model supports this).
- Session expires after 12 hours of inactivity or on explicit logout.

### 1.2 Explicitly Out of Scope for V1

| Feature | Reason |
|---------|--------|
| Work orders and service catalog | Admin-only for V1; Field PWA handles this until migration |
| Vehicle inspections | Handled by existing Field PWA until retirement |
| Labor work assignments | Handled by existing Field PWA until retirement |
| Client invoices | Admin-only |
| NFC badge provisioning / enrollment | Handled out-of-band by IT; V1 only reads badges |
| Multi-location punch routing | V1 device is enrolled to exactly one location |
| Photo capture of damage | V2 |
| Electronic signatures | V2 |
| GPS / geo-fencing | V2 |
| Offline work order download | V2 |
| Android to Android peer communication | Not planned |
| Apple iOS | Not planned |
| Telegram bot improvements | Separate track |

---

## 2. Version 2 Scope and Non-Goals

### 2.1 In Scope

**Full Field Operations Migration**
- Vehicle intake (receive vehicle, scan VIN, create work order).
- Inspection checklists with correct `employeeId` attribution (fixes audit finding #2).
- Labor work assignment start / progress / complete / block.
- Service line completion tracking.
- Photo capture of damage with MIME/size validation.
- GPS-validated punch (optional, opt-in per location).

**PWA Retirement**
- All V1 Field PWA features migrated to Android.
- Field PWA code removed from repository after migration verification.

**Advanced Vehicle Identification**
- VIN decode with NHTSA vPIC (already integrated in NestJS — exposed to Android).
- Vehicle history from scanned VIN.

**Multi-Tenant Field Routing**
- Replace `WORKER_COMPANY_ID` env var with proper tenant resolution via device enrollment.
- Hostname-based or subdomain-based routing for multi-company deployments.

### 2.2 Explicitly Out of Scope for V2

| Feature | Reason |
|---------|--------|
| iOS application | Not planned |
| Offline-first map navigation | V3 |
| AI-powered part identification | Not planned |
| Customer-facing mobile app | Separate product |
| Telemetry beyond operational metrics | V3 |

---

## 3. Native Android Application Architecture

### 3.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | Kotlin 1.9+ | First-class Android; required for Zebra TC22 |
| Min SDK | 33 (Android 13) | NFC ISO-DEP, biometric security APIs |
| Target SDK | 35 (Android 15) | Current stable |
| UI Framework | Jetpack Compose | Modern declarative UI; better for complex forms |
| Architecture | MVVM + Clean Architecture | Separation of UI / Domain / Data layers |
| DI | Hilt | Standard for Android; compile-time DI |
| Networking | Retrofit + OkHttp + Moshi | Type-safe API calls; JSON serialization |
| Local Storage | Room + DataStore | Structured local DB for offline queue; encrypted prefs |
| NFC | Android NFC API + IsoDep | Native NFC stack; no third-party NFC lib needed |
| Barcode Scanning | Zebra DataWedge API (TC22) + ML Kit CameraX OCR fallback | TC22 has built-in scanner; ML Kit for camera OCR |
| Security | Android Keystore + Jetpack Security Crypto | Hardware-backed key storage for session tokens |
| Background Work | WorkManager | Reliable offline sync and punch upload |
| Testing | JUnit 5 + MockK + Espresso | Unit and UI tests |

### 3.2 Module Structure

```
app/
├── :core
│   ├── :session-manager      # Encrypted session token storage and refresh
│   ├── :api-client           # Retrofit service definitions, auth interceptor
│   ├── :nfc                  # NFC badge reading, APDU commands
│   ├── :barcode-scanner      # DataWedge integration + ML Kit OCR fallback
│   ├── :data                 # Room DB, DataStore, offline queue repositories
│   └── :ui-components        # Shared design system (colors, typography, common components)
├── :features
│   ├── :login                # NFC badge + PIN authentication screen
│   ├── :punch                # Clock in/out, breaks
│   ├── :vin-scan             # Barcode + OCR + confirmation
│   └── :device-enrollment    # Admin-initiated device setup
└── :app (application, navigation)
```

> **Note:** The offline queue (Room + WorkManager) is infrastructure, not a feature, and lives inside `:core:data`. It is not a top-level module peer to `:features`. Feature modules (`:punch`, `:vin-scan`) depend on it via the data layer.

### 3.3 Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│  Presentation Layer (Jetpack Compose + ViewModels)   │
├─────────────────────────────────────────────────────┤
│  Domain Layer (Use Cases, Repository Interfaces)     │
├─────────────────────────────────────────────────────┤
│  Data Layer (Retrofit API, Room, DataStore, NFC)    │
└─────────────────────────────────────────────────────┘
```

### 3.4 Session Token Security

```
Employee NFC badge → Device NFC reader → Android app
                                              │
                                              ▼
                                    [Kotlin] Verify PIN server-side
                                              │
                                              ▼
                                     NestJS API issues an opaque, revocable session token
                                     (stored in MobileSession table; NOT a JWT)
                                              │
                                              ▼
                                    Stored in Android Keystore (hardware-backed)
                                              │
                                              ▼
                                    All subsequent API calls include token
                                    in Authorization: Bearer header
```

### 3.5 Offline Punch Queue

```
1. Employee clocks in offline → punch stored in Room (encrypted)
2. WorkManager schedules upload when connectivity returns
3. On sync success: punch marked uploaded, server responds with final punchEventId
4. Conflict resolution: server timestamp wins; employee notified of discrepancy
```

### 3.6 Accessibility Requirements

The workshop environment (gloves, poor lighting, one-handed operation) demands explicit accessibility targets:

| Requirement | Target |
|-------------|--------|
| Minimum touch target | 48×48dp for all interactive elements |
| Color contrast | WCAG AA (4.5:1 for text, 3:1 for UI components) |
| Font scaling | Supports system font size up to 200% without layout break |
| TalkBack support | All interactive elements have content descriptions; dialogs announce their purpose |
| NFC badge feedback | Haptic vibration (300ms) on successful badge read |
| Punch confirmation | Haptic vibration on confirm; distinct vibration pattern for success vs. error |
| Offline banner | High-contrast banner visible at all font sizes |

These requirements apply to all V1 screens: Login, Home, Punch, and VIN Scan.

### 3.7 MDM Strategy

Enterprise Android deployments beyond 1–2 devices require Mobile Device Management (MDM). The pilot uses a manual setup phase (§12.3), but MDM is mandatory before V1 full rollout.

**EMM Platform:** VMware Workspace ONE (AirWatch) — selected for Zebra TC22 native support, DataWedge profile management, and mature enterprise MDM capabilities. Samsung Knox may be evaluated for Tab Active5 devices.

**MDM Enrollment:** Pilot devices (Phase 5) are enrolled as **corporate-owned, work-profile** devices. Full rollout uses either corporate-owned work-profile or bring-your-own-device (BYOD) with work profile, depending on company policy.

**MDM Policies Applied:**

| Policy | Setting |
|--------|---------|
| DataWedge profiles | Pre-deployed via MDM — no manual device configuration |
| WiFi configuration | Pre-configured SSID + credentials pushed by MDM |
| Screen lock | PIN or password required (min 4 digits) |
| USB debugging | Disabled by default; enable only via MDM |
| App distribution | Private enterprise app catalog (not Google Play public) |
| App version pinning | IT can lock device to a specific app version |
| Remote lock/wipe | Available for lost/stolen devices |
| Device compliance | Root/jailbreak detection → device blocked from accessing work profile |

**At pilot scale (3–5 devices):** MDM enrollment is manual but documented. The DataWedge configuration guide (§12.3) is applied per device. MDM becomes the distribution channel for app updates at full rollout.

### 3.8 CI/CD Pipeline for Android App

The CI/CD pipeline must be designed before Phase 2 (Android Skeleton) begins.

**Build System:** Gradle Kotlin DSL. A shell project (empty Compose screens, no API integration) is created first to verify the build pipeline before feature development.

**CI Platform:** GitHub Actions (hosted runners) for build + test; self-hosted runners recommended for Android emulator (Mac Mini M1 or Linux ARM runners are cost-effective).

**Pipeline Stages:**

| Stage | Tool | Duration |
|-------|------|----------|
| Lint + static analysis | ktlint, detekt | ~2 min |
| Unit tests | JUnit 5, MockK | ~3 min |
| Instrumented tests | Espresso on Android emulator (CI runner) | ~10 min |
| Build debug APK | Gradle | ~4 min |
| Build release APK | Gradle (signed) | ~5 min |
| App distribution | GitHub Releases + MDM upload | ~2 min |

**Code Signing:**
- Debug APKs: local debug keystore
- Release APKs: Google Play Signing (upload key submitted to Google; Google re-signs)
- For MDM-distributed builds: enterprise signing key stored in GitHub Actions secrets

**MDM-distributed builds (full rollout):** After a release APK is built and signed, it is uploaded to the MDM enterprise app catalog via the MDM provider's API. MDM then pushes the update to all enrolled devices. This bypasses Google Play entirely for work-profile deployments.

**DataWedge APK:** If a custom DataWedge configuration APK is needed (for non-standard barcode formats), it has its own build/deploy pipeline, also via GitHub Actions.

**Versioning Strategy:** Semantic versioning aligned with pilot phases — `1.0.0-pilot.week3`, `1.0.0-pilot.week5`, `1.0.0` for production release.

---

## 4. Mobile API Boundary and Authentication Flow

### 4.1 API Boundary

The Android app communicates **exclusively** through the existing NestJS API (`apps/api`) via a **new Mobile API module**. No direct database access from the Android app. All BFF routing rules from the existing Field PWA apply unchanged.

**Existing routes used by Field PWA that Android will use:**
- `POST /worker/scan` — VIN scan submission
- `POST /worker/jobs/create` — Create job
- `POST /worker/jobs/decode-vin` — Preview VIN
- `POST /worker/service-lines/:id/complete` — Complete service line
- `POST /worker/jobs/recent-completions` — Recent completions

**New routes for Android V1:**
- `POST /mobile/auth/login` — NFC badge + PIN → session token
- `POST /mobile/auth/logout` — Revoke session
- `POST /mobile/punch` — Submit punch event (online or queued)
- `GET /mobile/punch/status` — Sync offline queue status
- `POST /mobile/devices/enroll` — Enroll device to company/location
- `GET /mobile/devices/{deviceId}` — Get device enrollment status
- `GET /mobile/employees/me` — Get logged-in employee profile

### 4.2 Authentication Flow (V1)

```
Step 1: Employee taps NFC badge on device
        → Android reads badge UID (ISO 14443 UUID)
        → Sends { badgeUid, deviceId } to POST /mobile/auth/login
        → Server looks up Employee by badgeUid (EmployeeBadgeCredential)
        → Server responds with a login challenge: { requiresPin: true }  ← employeeId NOT disclosed here
        → On unknown badge: server still returns { requiresPin: true } (no info leak about badge validity)

Step 2: Employee enters 6-digit PIN
        → Sends { badgeUid, deviceId, pin } to POST /mobile/auth/login
        → Server validates PIN via Argon2id (same as existing Field PIN)
        → Server creates Session record with companyId, locationId, employeeId
        → Server responds: { sessionToken, expiresAt, employee, location }

Step 3: Android stores sessionToken in Android Keystore
        → All subsequent requests include: Authorization: Bearer {sessionToken}

Step 4: On logout or session expiry: token is revoked server-side

**Rate limiting:** Login endpoint is rate-limited to 10 attempts per badge UID per 15 minutes. After 5 failed PIN attempts, the badge is locked server-side (EmployeeBadgeCredential.lockedAt set). Locked badges return 423 to the employee; an admin must unlock via Admin app.

### 4.3 API Response Contract for Punch

```typescript
// POST /mobile/punch
type MobilePunchRequest = {
  badgeUid: string;
  deviceId: string;
  action: "clock_in" | "clock_out" | "start_break" | "end_break";
  punchEventUtc: string; // ISO 8601 — client timestamp
  locationId: string;
  employeeId: string;
};

type MobilePunchResponse = {
  punchEventId: string;
  status: "recorded" | "conflict" | "offline_queued";
  serverUtc: string;
  conflictReason?: string;
};
```

---

## 5. NFC Badge and PIN Punch Workflow

### 5.1 NFC Badge Data Model

The employee carries an NFC badge (MIFARE Classic or ISO 14443compliant card) provisioned by the workshop administrator. The badge UID is the primary identity token.

**Critical requirement from audit finding #2:** The badge must identify the exact employee — not a device, not a location. Every punch event must carry the verified `employeeId` from the badge.

### 5.2 Punch State Machine

Identical to the existing NestJS punch state machine:

```
[CLOCKED_OUT] --clock_in--> [CLOCKED_IN]
[CLOCKED_IN] --start_break--> [ON_BREAK]
[ON_BREAK] --end_break--> [CLOCKED_IN]
[CLOCKED_IN] --clock_out--> [CLOCKED_OUT]
```

Invalid transitions are rejected server-side with descriptive errors.

### 5.3 Punch Flow on Device

The primary punch trigger is the **NFC badge tap**, with a confirmation dialog for explicit consent. On-screen punch buttons (Clock In, Start Break, End Break, Clock Out) are available as an alternative for environments where NFC tap is impractical (e.g., Tab Active5 fixed station with gloves).

```
1. Employee taps NFC badge
   → Device reads badge UID
   → Prompts for PIN

2. Employee enters PIN
   → Sent to /mobile/auth/login (badgeUid + pin)
   → On success: session token stored; proceed to home screen
   → On failure: "Invalid PIN. Try again." (max 5 attempts, then badge locked)

3. Home screen displays current state and available actions
   → Employee name + photo, current shift duration, today's total hours
   → Available punch actions: [Clock In] / [Start Break] / [End Break] / [Clock Out]
   → Each action shows a confirmation dialog:
     "Clock in as [Employee Name] at [Location]?"
     "Start break for [Employee Name]?"
     "End break for [Employee Name]?"
     "Clock out as [Employee Name]? Total: 7h 23m"

4. Employee confirms
   → Punch submitted (online or queued offline)
   → UI immediately updates to show new state
   → Shift summary on clock out (total hours, break duration)

5. NFC badge tap from home screen
   → If employee is CLOCKED_IN: offers [Start Break] or [Clock Out] options
   → If employee is ON_BREAK: offers [End Break]
   → Same confirmation dialog flow as step 3-4
```

### 5.4 Session Expiry UX

When a 12-hour session expires during an active shift:

- App detects expiry on next API call (server returns 401)
- Employee sees a banner on the home screen: "Session expiring in X minutes — tap to re-authenticate"
- If session expires mid-shift: employee must re-enter PIN (badge tap + PIN) to continue
- Active punch state is preserved locally; only the session token is invalidated
- If employee cannot re-authenticate (badge locked, network issue): punch state is frozen; supervisor can correct via Admin

### 5.5 Offline Behavior

- If no connectivity: punch stored in Room (encrypted), UI shows persistent banner "Offline — will sync when connected"
- WorkManager uploads queue when connectivity returns
- Server responds with `conflict` status if timestamp is outside allowed window
- **Conflict notification UX**: When a punch conflicts, the employee sees a modal on next app open:
  "Sync conflict: Your clock-out at 17:00 was adjusted to 16:58 by the server. Contact your supervisor if this is incorrect."
- Offline queue survives app force-kill; WorkManager persists the queue across restarts
- Queue depth: up to 50 offline punches per device; app warns employee at 40 punches ("Please connect to sync — queue almost full")

---

## 6. Device Enrollment and Location Binding

### 6.1 Device Record Schema

A new `Device` model is required in Prisma:

```prisma
model Device {
  id            String    @id @default(cuid())
  androidId     String    @unique  // Android ANDROID_ID (hardware constant)
  model         String           // e.g. "Zebra TC22"
  osVersion     String           // e.g. "Android 14"
  companyId     String
  locationId    String
  enrolledBy    String           // userId of admin who enrolled
  enrolledAt    DateTime  @default(now())
  lastSeenAt    DateTime?
  revokedAt     DateTime?
  sessionToken  String?          // current active session token

  company       Company   @relation(fields: [companyId], references: [id])
  location      Location  @relation(fields: [locationId], references: [id])
  punchEvents   PunchEvent[]

  @@index([androidId])
  @@index([companyId, locationId])
}
```

### 6.2 Enrollment Flow

```
Admin (in Admin web app):
1. Goes to Devices → Enroll Device
2. Enters Device ANDROID_ID (or scans QR code on TC22)
3. Selects Company and Location from dropdown
4. Submits → Device record created in DB
5. Admin shares the one-time enrollment token with the device operator

Device (on first boot):
1. App reads ANDROID_ID
2. App presents enrollment token entry screen (keyboard or QR scan)
3. POST /mobile/devices/enroll { androidId, model, osVersion, enrollmentToken }
   enrollmentToken = one-time code generated by admin (expires in 15 minutes)
4. Server validates token, links device to companyId + locationId
5. Device stores enrollment confirmation locally (encrypted DataStore)
6. On subsequent boots: device auto-authenticates if session valid
```

### 6.3 DeviceEnrollmentActivity Screen

The enrollment screen is the first screen shown on a device that has not yet been enrolled.

```
┌─────────────────────────────────────────────┐
│  LaborLedger — Device Setup                  │
│                                             │
│  This device is not enrolled.               │
│                                             │
│  Enter the enrollment code provided          │
│  by your administrator.                     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  [  enrollment_code               ] │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  — or scan QR code —                        │
│  [ Scan QR Code ]                           │
│                                             │
│  [ Enroll Device ]                          │
│                                             │
│  Errors:                                    │
│  • "Code expired — ask admin for a new one" │
│  • "Code already used — ask admin for new"  │
│  • "Device already enrolled"                │
└─────────────────────────────────────────────┘
```

**Screen states:** Initial → Loading (on submit) → Success (auto-navigates to login) → Error (shows message, allows retry). Manual keyboard entry is always available. QR scan requires camera permission; if denied, keyboard fallback is shown.

### 6.3 Location Binding Enforcement

Every punch event from the Android app carries `locationId` from the device enrollment. The NestJS API verifies:

```
punch.locationId === device.enrolledLocationId
```

If a device is revoked (`revokedAt != null`), all punch submissions are rejected.

---

## 7. VIN Scanning Workflow

### 7.1 Primary: Zebra TC22 Integrated Scanner

The Zebra TC22 has a built-in 1D/2D barcode scanner accessible via the **DataWedge** profile or the **Scanner SDK**. The Android app configures a DataWedge intent that receives scanned barcodes.

```
TC22 barcode scanner → DataWedge → Android intent → :barcode-scanner module
                                                                    │
                                                                    ▼
                                                       Normalize (trim, uppercase)
                                                                    │
                                                                    ▼
                                                       Validate VIN_PATTERN / checksum
                                                                    │
                                                                    ▼
                                                       Display VIN on screen with
                                                       "Confirm VIN" / "Retry" buttons
```

### 7.2 Fallback: Camera OCR (ML Kit)

When the barcode scan fails or the user requests camera mode:

```
CameraX → ML Kit Text Recognition → Parse VIN pattern from OCR text
                                         │
                                         ▼
                               Extract first 17-char alphanumeric match
                                         │
                                         ▼
                               Same validation and confirmation flow
```

### 7.3 Explicit Confirmation

```
┌─────────────────────────────────────────────┐
│  VIN Scanned                                │
│                                             │
│  5TDKZ3DC5NS145678                         │
│  2022 Toyota Sienna XSE                     │
│                                             │
│  [Camera OCR fallback]  [Retry scan]        │
│                                             │
│  [ ✓ Confirm VIN ]                         │
└─────────────────────────────────────────────┘
```

- VIN and vehicle description displayed.
- Employee explicitly taps **"Confirm VIN"** to proceed.
- Manual keyboard entry always available.
- Scan history shown (last 5 scans, selectable).

### 7.4 Validation Pipeline

```
1. Raw text from scanner/OCR
2. Normalize: trim, uppercase, remove spaces
3. VIN_PATTERN test: /^[A-HJ-NPR-Z0-9]{17}$/
4. ISO 3779 check digit validation
5. If invalid: show error "Invalid VIN barcode. Try again or enter manually."
6. If valid: show vehicle description (NHTSA decode if available)
7. Wait for explicit "Confirm VIN" tap
```

---

## 8. Required Database Changes

### 8.1 New Models

```prisma
// New: Employee badge credential (NFC UID → employeeId)
model EmployeeBadgeCredential {
  id          String   @id @default(cuid())
  employeeId  String
  badgeUid    String   @unique  // NFC badge UID (ISO 14443 UUID)
  label       String?           // e.g. "John's access badge"
  issuedAt    DateTime  @default(now())
  revokedAt   DateTime?
  employee    Employee @relation(fields: [employeeId], references: [id])

  @@unique([employeeId, badgeUid])
  @@index([badgeUid])
}

// New: Mobile device enrollment
model Device {
  id           String    @id @default(cuid())
  androidId    String    @unique  // Android ANDROID_ID
  model        String
  osVersion    String
  companyId    String
  locationId   String
  enrolledBy   String
  enrolledAt   DateTime  @default(now())
  lastSeenAt   DateTime?
  revokedAt    DateTime?
  company      Company   @relation(fields: [companyId], references: [id])
  location     Location  @relation(fields: [locationId], references: [id])
  punchEvents  PunchEvent[]

  @@index([androidId])
  @@index([companyId])
  @@index([companyId, locationId])
}

// New: Mobile session (separate from web sessions)
model MobileSession {
  id           String    @id @default(cuid())
  token        String    @unique  // opaque token
  employeeId   String
  deviceId     String
  companyId    String
  locationId   String
  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt   DateTime  @default(now())
  employee     Employee  @relation(fields: [employeeId], references: [id])
  device       Device    @relation(fields: [deviceId], references: [id])
  company      Company   @relation(fields: [companyId], references: [id])

  @@index([token])
  @@index([employeeId])
  @@index([deviceId])
  @@index([companyId, locationId])  // enables efficient session lookup by tenant
}

// New: Punch event source tracking
model PunchEvent {
  // ... existing fields ...
  deviceId     String?   // Android device that originated the punch
  source       PunchSource?

  device       Device?   @relation(fields: [deviceId], references: [id])
}

enum PunchSource {
  KIOSK     // Existing kiosk hardware
  FIELD_PWA // Existing Field PWA
  MOBILE    // New Android app
}
```

### 8.2 Additive Schema Changes Only (V1)

All changes to the existing schema are **additive only** to satisfy the constraint "do not break existing migrations":

- Add `deviceId String?` and `source PunchSource?` to `PunchEvent` — existing rows remain valid with `NULL`.
- Add `EmployeeBadgeCredential` — new table, no existing data.
- Add `Device` — new table, no existing data.
- Add `MobileSession` — new table, no existing data.
- Add `PunchSource` enum — new enum, no existing values.

### 8.3 Indexes for V1 Query Patterns

```prisma
// PunchEvent queries by employee + day (timekeeping)
@@index([employeeId, eventUtc])

// Device queries by company + location
@@index([companyId, locationId])

// MobileSession queries by token (auth)
@@index([token])
```

---

## 9. Required API Endpoints

### 9.1 New Mobile API Module

A new `MobileModule` in `apps/api/src/modules/mobile/` will expose:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/mobile/auth/login` | None (badge UID + PIN) | Authenticate badge + PIN, return session token |
| POST | `/mobile/auth/logout` | Bearer token | Revoke session |
| GET | `/mobile/auth/me` | Bearer token | Get current employee + location |
| POST | `/mobile/punch` | Bearer token | Submit punch event |
| GET | `/mobile/punch/sync` | Bearer token | Sync offline queue |
| POST | `/mobile/devices/enroll` | Admin cookie session | Enroll device to company/location |
| GET | `/mobile/devices/:deviceId` | Bearer token | Get device enrollment status |
| GET | `/mobile/employees/me` | Bearer token | Get employee profile |

### 9.2 Existing Endpoints Used by Android

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/worker/jobs/decode-vin` | Bearer token | VIN preview (NHTSA or stub) |
| POST | `/worker/scan` | Bearer token | Record scan event |

### 9.3 Endpoint Constraints

- **No JWT**: session tokens are opaque, stored in `MobileSession` table, revocable.
- **No cookie**: Android uses `Authorization: Bearer` header only.
- **Tenant scoping**: All queries scoped by `companyId` from session token.
- **Location enforcement**: `device.enrolledLocationId` is verified on every punch.
- **Guards**: All `/mobile/*` endpoints (except `/mobile/auth/login`) are protected by `MobileBearerGuard` — validates the Bearer token against `MobileSession` table, checks `revokedAt IS NULL` and `expiresAt > now()`, and injects `companyId`, `locationId`, `employeeId` into the request context. Admin-only enrollment endpoint uses `MobileAuthGuard` (checks session + admin role).
- **Rate limiting**: Login endpoint rate-limited: 10 attempts per badge UID per 15 minutes; 5 PIN failures trigger badge lockout (423 response).

---

## 10. Required Audit Events

Every significant action in the Android app must produce an audit event stored in the existing `AuditEvent` model (or equivalent new model):

| Event | Actor | Target | Metadata |
|-------|-------|--------|---------|
| `EMPLOYEE_CLOCK_IN` | employeeId | punchEventId | `{ deviceId, locationId, badgeUid, source: "MOBILE" }` |
| `EMPLOYEE_CLOCK_OUT` | employeeId | punchEventId | `{ deviceId, locationId, badgeUid, source: "MOBILE" }` |
| `EMPLOYEE_BREAK_START` | employeeId | punchEventId | `{ deviceId, locationId, source: "MOBILE" }` |
| `EMPLOYEE_BREAK_END` | employeeId | punchEventId | `{ deviceId, locationId, source: "MOBILE" }` |
| `DEVICE_ENROLLED` | adminUserId | deviceId | `{ androidId, companyId, locationId }` |
| `DEVICE_REVOKED` | adminUserId | deviceId | `{ androidId, companyId, reason }` |
| `NFC_BADGE_ISSUED` | adminUserId | employeeBadgeCredentialId | `{ badgeUid, employeeId }` |
| `NFC_BADGE_REVOKED` | adminUserId | employeeBadgeCredentialId | `{ badgeUid, employeeId }` |
| `VIN_SCANNED` | employeeId | workOrderId (if linked) | `{ vin, deviceId, source: "BARCODE" \| "CAMERA_OCR" }` |
| `VIN_CONFIRMED` | employeeId | workOrderId | `{ vin, confirmedByEmployeeId }` |
| `MOBILE_SESSION_CREATED` | employeeId | mobileSessionId | `{ deviceId, locationId }` |
| `MOBILE_SESSION_REVOKED` | employeeId | mobileSessionId | `{ reason: "logout" \| "admin" \| "expired" }` |
| `PIN_FAILURE` | — | employeeId | `{ badgeUid, deviceId, attemptCount }` (no personal data) |

---

## 11. PWA Migration and Retirement Plan

### 11.1 Migration Strategy

The existing Field PWA (`apps/field`) is **frozen** — no new features, no bug fixes unless security-critical. It continues to run for existing users until Android V1 is fully deployed and validated.

```
Phase 1 (V1 development): Field PWA frozen, Android V1 built in parallel
Phase 2 (V1 pilot): Android V1 runs alongside Field PWA at pilot location
Phase 3 (V1 rollout): Android V1 replaces Field PWA for all employees
Phase 4 (Field PWA retirement): Field PWA code removed from repository
```

### 11.2 Feature Migration Parity Checklist

| Feature | Field PWA | Android V1 | Android V2 |
|---------|-----------|-----------|-----------|
| PIN login | ✅ | ✅ | ✅ |
| NFC badge + PIN | ❌ | ✅ | ✅ |
| Clock in/out | ✅ | ✅ | ✅ |
| Break in/out | ✅ | ✅ | ✅ |
| VIN scan (barcode) | ✅ | ✅ (Zebra TC22) | ✅ |
| VIN scan (camera OCR) | ✅ | ✅ (ML Kit) | ✅ |
| VIN decode (NHTSA) | ✅ | ✅ | ✅ |
| Vehicle intake | ✅ | ❌ | ✅ |
| Inspection checklists | ✅ | ❌ | ✅ |
| Labor work assignment | ✅ | ❌ | ✅ |
| Offline queue | ❌ | ✅ | ✅ |
| Device enrollment | ❌ | ✅ | ✅ |

### 11.3 Retirement Conditions

The Field PWA **must not be removed** until:

1. Android V1 covers all active punch employees.
2. Zero employees actively using Field PWA (verified by `lastSeenAt` on sessions).
3. Admin explicitly marks Field PWA as retired in Admin settings.
4. Database migration to mark all Field PWA sessions as superseded.

---

## 12. Hardware Pilot Plan

### 12.1 Pilot Hardware

| Device | Role | Quantity | OS | NFC | Scanner | Spares |
|--------|------|---------|-----|-----|---------|--------|
| **Zebra TC22** | Mobile VIN scanning + punches | 3 units | Android 14 | ISO 14443 | Built-in 1D/2D imager | **+1 spare** |
| **Samsung Galaxy Tab Active5** | Fixed punch station (mounted) | 2 units | Android 14 | ISO 14443 | Rear camera + optional external scanner | **+1 spare** |

**Total: 4 TC22 units, 3 Tab Active5 units.** Each device ships with a protective case and charging cradle.

**DataWedge Provisioning (TC22):** DataWedge profiles must be pre-configured before device distribution. For the pilot, profiles are configured manually per device using the DataWedge profile import feature (JSON export from a reference device). At full rollout, DataWedge profiles are pushed via MDM.

DataWedge profile configuration for V1:
- Profile name: `LaborLedger_V1`
- Input enabled: Barcode (built-in imager)
- Output: Keystroke output (disabled), Intent output (enabled)
- Intent action: `com.laborledger.VIN_SCANNED`
- Intent category: `android.intent.category.DEFAULT`
- Decoder: Code 39 enabled (primary), QR Code enabled (secondary)

**NFC Badge Provisioning:** MIFARE Classic 1K badges are provisioned by IT using a USB NFC reader (e.g., ACS ACR122U) and `libnfc` or equivalent tool. Each badge UID is recorded in `EmployeeBadgeCredential` via the Admin app. Badge provisioning workflow is out-of-band for V1; the roadmap assumes IT handles this.

### 12.2 Pilot Location

Select one location with:
- 5–20 active hourly employees (manageable for go/no-go decision).
- Existing WiFi infrastructure (5 GHz preferred for TC22).
- A fixed tablet station near the shop entrance (Tab Active5).
- Supervisor willing to participate in daily check-ins during pilot.

### 12.3 Pilot Timeline

```
Week 1-2:   Enroll devices, provision NFC badges, configure DataWedge on TC22
Week 3:      Shadow mode — TC22 and Tab Active5 run alongside existing Field PWA
             No employee switches yet. Collect scan success rate, punch accuracy.
Week 4:      Switch 3 pilot employees to Android for clock in/out only
Week 5:      Expand to full pilot location
Week 6:     Go/No-Go decision meeting with pilot data
```

### 12.4 App Update Mechanism During Pilot

During the pilot (Weeks 3–6), a critical bug may require an app update. The update mechanism depends on the distribution channel:

| Scenario | Mechanism | Lead Time |
|----------|-----------|-----------|
| MDM-enrolled device | IT pushes update via MDM enterprise catalog | ~15 minutes |
| Non-MDM device (pilot) | Sideload via ADB or QR code pointing to APK download | ~30 minutes |
| Play Store (if distributed publicly) | staged rollout (25% → 50% → 100%) | 1–24 hours |

For the pilot: MDM enrollment is required before Week 5 expansion. MDM enables IT to push updates to all pilot devices within minutes.

### 12.5 Pilot Infrastructure Requirements

The following infrastructure must be verified at the pilot location before the pilot begins:

**WiFi:**
- 5 GHz WiFi access points preferred; TC22 supports 5 GHz but falls back to 2.4 GHz
- Site survey checklist: confirm ≥ –65 dBm signal strength at punch stations and shop floor
- Separate SSID for corporate devices (recommended; not required for V1)

**API Connectivity:**
- TC22 and Tab Active5 must reach the NestJS API endpoint (public internet or VPN)
- If on-premises API: VPN client (WireGuard) must be installed and MDM-enforced
- Latency requirement: ≤ 500ms round-trip for punch submissions
- Punch events are queued offline if connectivity is temporarily lost

**Staging Environment:**
- A staging NestJS API instance must be reachable from pilot devices during pilot testing
- Staging uses a separate database; no production data
- Pilot devices point to staging during Weeks 1–4, switch to production for Week 5+

**MDM Server:**
- VMware Workspace ONE UEM (or equivalent EMM) hosted in cloud (SaaS)
- MDM server must be accessible from corporate WiFi
- Backup MDM admin account required (in case primary account is locked)

**Monitoring (pilot phase):**
- GitHub Actions CI/CD shows build/test status
- NestJS API logs in staging/production for punch event monitoring
- MDM console shows device health (battery, connectivity, app crashes) — available only for MDM-enrolled devices

| Metric | Target | Measurement |
|--------|--------|-------------|
| Scan success rate (barcode) | ≥ 95% | TC22 scan events / total scan attempts |
| Scan success rate (OCR fallback) | ≥ 80% | Camera scans / total camera attempts |
| Punch accuracy | ≥ 99% | Reconciliation test: punches within ±2 min of expected shift schedule (per §14.5) |
| Device enrollment success | 100% | Devices enrolled without IT intervention |
| Offline queue sync | ≥ 99% | Offline punches synced within 5 minutes of connectivity |
| Zero data leaks | 100% | No punch events attributed to wrong employee |
| NFC badge read reliability | ≥ 98% | Successful badge reads / total badge taps |

> **Note:** MDM enrollment is required before Week 5 expansion. All pilot devices must be MDM-enrolled by end of Week 3.

---

## 13. Security Fixes Required Before Pilot

These fixes are **prerequisites** — the pilot must not begin until these are resolved in the existing codebase:

### 13.1 Critical (Must Fix Before Pilot)

| # | Finding | Fix |
|---|---------|-----|
| C1 | Telegram bot exposes all tenant data (no `companyId` filter) | Add `companyId` filter to all 4 handlers in `telegram-bot/src/index.ts` |
| C2 | `EmployeeBadgeCredential` model missing (NFC badge identity not modeled) | Add `EmployeeBadgeCredential` Prisma model |
| C3 | No device enrollment model | Add `Device` Prisma model |
| C4 | No mobile session model | Add `MobileSession` Prisma model |

### 13.2 High (Must Fix Before Pilot)

| # | Finding | Fix |
|---|---------|-----|
| H1 | Vehicle inspection uses wrong `employeeId` (`findFirst` by `createdAt`) | `createWorkerChecklist` must accept `employeeId` from authenticated session |
| H2 | `exactOptionalPropertyTypes` violations in `worker.controller.ts` | Fix optional property passing (already done for `scan`, `completeServiceLine`, `createFieldJob`) |
| H3 | Storage lacks disk space validation | Add disk space check in `StorageService.saveFile()` |
| H4 | Storage lacks MIME type enforcement beyond multer | Add MIME validation in `StorageService.saveFile()` |

### 13.3 Medium (Fix Within V1)

| # | Finding | Fix |
|---|---------|-----|
| M1 | Catch blocks without logging in `workspace-auth.ts`, `storage.service.ts` | Add structured `logger.warn()` calls |
| M2 | `company-operations.service.ts` is 4,402 lines | Ongoing extraction: extract `EmployeeService`, `VehicleService` incrementally |
| M3 | Field PWA uses `WORKER_COMPANY_ID` env (no multi-tenant) | Replace with device enrollment resolution |

---

## 14. Testing and Acceptance Criteria

### 14.1 Unit Tests (New Android App)

- NFC badge parsing (valid UID, invalid UID, duplicate UID)
- PIN validation (correct, incorrect, locked after 5 attempts)
- VIN normalization (trim, uppercase, spaces)
- VIN validation (17-char pattern, I/O/Q rejection, check digit)
- Offline punch queue (enqueue, dequeue, conflict detection)
- Session token storage/retrieval from Keystore

### 14.2 Integration Tests (NestJS API)

- `POST /mobile/auth/login` with valid/invalid badge + PIN
- `POST /mobile/auth/logout` revokes session
- `POST /mobile/punch` records punch with correct `employeeId`, `locationId`, `deviceId`
- `POST /mobile/devices/enroll` creates device record
- Revoked device is rejected on punch
- Offline punch queue sync endpoint
- NFC badge CRUD (admin provisions badge, revokes badge)

### 14.3 Physical Tests (Pilot Hardware)

- TC22 barcode scanner reads VIN from a real Code 39 sticker
- TC22 DataWedge intent is received and processed by Android app
- TC22 NFC reader reads MIFARE Classic badge UID
- Tab Active5 NFC reads badge UID in fixed station configuration
- Punch submitted on TC22 appears in Admin timekeeping view
- Offline punch syncs when WiFi reconnects
- Device revocation prevents further punch submissions

### 14.4 Security Tests

- Stolen session token is revoked; reused token returns 401
- Badge UID + correct PIN required; badge alone insufficient
- Wrong PIN 5 times locks badge; admin must unlock
- Device enrolled to Location A cannot submit punches for Location B
- Employee cannot punch on behalf of another employee
- Android app does not store PIN in plaintext or logs

### 14.5 Punch Accuracy — Reconciliation Test Definition

"Punch accuracy" is defined as the result of a **shift reconciliation test**:

1. Supervisor creates a expected shift list for the pilot period (clock-in/out times per employee)
2. After the pilot period, export all PunchEvent records for the pilot employees
3. For each employee: compare actual punch events against expected shift schedule
4. Accuracy = (matching punch events) / (total expected punch events), where "matching" means:
   - Clock-in within ±2 minutes of expected time
   - Clock-out within ±2 minutes of expected time
   - Break punches within ±2 minutes of expected windows
5. Target: ≥ 99% of punch events fall within the ±2-minute tolerance window

This replaces the vague "supervisor expectation" with an explicit, measurable reconciliation procedure.

### 14.6 Clock Skew and Concurrent Punch Tests

**Clock skew test:**
- Submit a punch with `punchEventUtc` set 5 minutes in the future
- Server must reject with 400 and message "Client timestamp too far in future"
- Submit a punch with `punchEventUtc` set 10 minutes in the past
- Server accepts (within allowed window) and records actual server timestamp

**Concurrent punch test:**
- Simulate two simultaneous clock-in punches from the same employee (same badge, same second)
- Only one PunchEvent is created; second request returns 409 Conflict
- Simulate concurrent clock-in from two different employees on two different devices
- Both succeed; no conflict

---

## 15. Agent-by-Agent Implementation Assignments

Based on the existing agent structure in `.opencode/agents/`:

| Agent | Responsibility |
|-------|---------------|
| **laborledger-backend** | NestJS MobileModule, PunchEvent, MobileSession, PunchState machine |
| **laborledger-database** | Prisma schema additions: Device, EmployeeBadgeCredential, MobileSession, PunchSource enum |
| **laborledger-frontend** | Android UI: Login (NFC + PIN), Home, Punch, VIN Scan screens (Jetpack Compose) |
| **security-auditor** | Review NFC/PIN auth flow, session token generation, badge provisioning security |
| **tenant-auditor** | Verify all mobile endpoints scope by `companyId` from session |
| **qa-reviewer** | Pilot test plan, acceptance criteria, regression scenarios |
| **laborledger-explorer** | Map existing `worker.controller.ts`, `field-job.service.ts` to mobile endpoints |

---

## 16. Ordered Implementation Phases

### Phase 0 — Foundation (Before V1 Development)

- [ ] Fix C1: Telegram bot `companyId` filter
- [ ] Add `EmployeeBadgeCredential` Prisma model + migration
- [ ] Add `Device` Prisma model + migration
- [ ] Add `MobileSession` Prisma model + migration
- [ ] Fix H1: Vehicle inspection `employeeId` (pass from session)
- [ ] Fix H2: Remaining `exactOptionalPropertyTypes` violations
- [ ] Fix H3: Storage disk space validation
- [ ] Fix H4: Storage MIME validation
- [ ] Write integration tests for new Prisma models

### Phase 1 — Mobile API Core (NestJS)

- [ ] Create `MobileModule` in `apps/api/src/modules/mobile/`
- [ ] Implement `POST /mobile/auth/login` (badge + PIN → session token)
- [ ] Implement `POST /mobile/auth/logout`
- [ ] Implement `GET /mobile/auth/me`
- [ ] Implement `POST /mobile/punch` (with state machine enforcement)
- [ ] Implement `POST /mobile/devices/enroll` (admin-only)
- [ ] Implement `GET /mobile/devices/:deviceId`
- [ ] Add `source: "MOBILE"` to `PunchEvent` on creation
- [ ] Add audit events for all mobile actions
- [ ] Write integration tests for all mobile endpoints

### Phase 2 — Android Skeleton

- [ ] Create Kotlin project with Jetpack Compose
- [ ] Set up Hilt DI
- [ ] Implement Retrofit API client with auth interceptor
- [ ] Set up Room database for offline queue
- [ ] Set up WorkManager for sync
- [ ] Implement Android Keystore session storage
- [ ] Implement `DeviceEnrollmentActivity` (QR code scan for enrollment token)
- [ ] Write unit tests for session manager, offline queue

### Phase 3 — Android Login & Punch

- [ ] Implement NFC badge reading (`IsoDep`)
- [ ] Implement PIN entry screen
- [ ] Implement `POST /mobile/auth/login` flow
- [ ] Implement home screen with current state display
- [ ] Implement punch buttons (Clock In, Start Break, End Break, Clock Out)
- [ ] Implement offline queue (Room + WorkManager)
- [ ] Write Espresso UI tests for punch flow

### Phase 4 — Android VIN Scanning

- [ ] Integrate DataWedge scanner intent receiver
- [ ] Implement ML Kit CameraX OCR fallback
- [ ] Implement VIN confirmation screen
- [ ] Integrate `POST /worker/jobs/decode-vin` for vehicle preview
- [ ] Implement `POST /worker/scan` for scan events
- [ ] Write unit tests for VIN normalization and validation

### Phase 5 — Pilot Deployment

- [ ] Provision NFC badges for pilot employees
- [ ] Enroll 3 TC22 + 2 Tab Active5 devices (MDM enrollment required)
- [ ] Configure DataWedge profiles on TC22 (manual for pilot; MDM push at full rollout)
- [ ] Deploy to pilot location
- [ ] Run shadow mode for 2 weeks
- [ ] Collect pilot metrics
- [ ] Go/No-Go decision

### Phase 6 — V1 Full Rollout

- [ ] Provision all employee NFC badges
- [ ] Enroll all devices
- [ ] Roll out to all locations
- [ ] Monitor punch accuracy
- [ ] Freeze Field PWA (if all employees migrated)

### Phase 7 — V2 Development (See Section 2)

- [ ] Migrate vehicle intake from Field PWA to Android
- [ ] Migrate inspection checklists
- [ ] Migrate labor work assignments
- [ ] Retire Field PWA

---

## 17. Risks, Rollback, and Human Approval Checkpoints

### 17.1 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| TC22 DataWedge configuration is complex and device-specific | HIGH | HIGH | Pre-configure DataWedge profiles in MDM; include in device setup guide |
| NFC badge UID collision (two badges with same UID) | LOW | HIGH | Use `EmployeeBadgeCredential.badgeUid` as unique constraint; reject duplicate badge provisioning |
| Employee loses NFC badge | MEDIUM | MEDIUM | Admin can revoke lost badge and issue new one without changing PIN |
| Android Keystore unavailable on rooted device | LOW | MEDIUM | Detect root; show warning; allow PIN-based fallback with admin approval |
| Offline queue conflicts on shift boundary crossing | MEDIUM | LOW | Server timestamp wins; employee notified; supervisor can correct in Admin |
| NHTSA vPIC API unavailable during VIN decode | MEDIUM | LOW | Show "VIN confirmed — vehicle details unavailable"; employee enters year/make/model manually |
| Device enrollment token intercepted | LOW | HIGH | Enrollment token is one-time; expires in 15 minutes; HTTPS enforced |
| Critical bug found in Week 5 requiring app update | MEDIUM | MEDIUM | MDM enables push update within 15 min; manual sideload fallback |
| MDM enrollment fails or is delayed | MEDIUM | HIGH | Pilot can proceed with manual DataWedge setup through Week 4; MDM required before Week 5 expansion |

### 17.2 Rollback Procedures

| Scenario | Rollback Action |
|---------|----------------|
| Android punch data incorrect | Admin corrects via existing timekeeping correction flow |
| Device compromised / stolen | Admin revokes device in Admin app → `Device.revokedAt = now()` → device rejects all punches |
| Session token stolen | Admin or employee calls `POST /mobile/auth/logout` → `MobileSession.revokedAt = now()` |
| NFC badge lost | Admin revokes badge → `EmployeeBadgeCredential.revokedAt = now()` |
| Android app fails on specific device model | Filed as bug; pilot continues on remaining devices |

### 17.3 Human Approval Checkpoints

| Checkpoint | Approver | Criteria |
|-----------|---------|---------|
| Phase 0 complete (schema + security fixes) | CTO + Security | All C* findings resolved; audit log shows clean |
| Phase 1 API complete | Backend Lead | Integration tests passing; no regressions in existing tests |
| Phase 3 punch flow ready | QA Lead | Espresso tests passing; offline queue verified |
| Pilot hardware approved | Operations Lead | DataWedge configured; NFC tested on all pilot devices |
| Pilot start | CTO + Operations | Metrics baseline documented |
| Pilot Go/No-Go | CTO + Pilot Supervisor | ≥ 95% scan success, ≥ 99% punch accuracy, zero security incidents |
| V1 full rollout | CTO | All locations enrolled, all employees badged, Field PWA traffic < 5% of peak |
| Field PWA retirement | CTO + Product | Zero active Field PWA sessions; admin sign-off |

---

## Appendix A: Reference — Audit Findings (CLEAN-REPOSITORY-AUDIT.md)

| # | Finding | Status for V1/V2 |
|---|---------|------------------|
| 1 | Telegram bot no `companyId` filter | **C1 — fix before pilot** |
| 2 | Inspection uses wrong `employeeId` | **H1 — fix before pilot** |
| 3 | Field PWA blocked by `WORKER_COMPANY_ID` | **Resolved by device enrollment** |
| 4 | Storage no disk check | **H3 — fix before pilot** |
| 5 | VIN scanner validation correct | No change needed |
| 6 | Catch blocks without logging | **M1 — fix within V1** |
| 7 | Multi-tenancy Admin complete | No change needed |
| 8 | Auth cookie functional | No change needed |
| 9 | NHTSA vPIC functional with stub fallback | **Improved: default now NHTSA, retry, error differentiation** |
| 10 | WASM scanner exists in public/wasm | No change needed |

## Appendix B: Reference — VIN Scanner Configuration (2026-07-19 Fix)

The existing VIN scanner in `apps/field/src/components/employee/VinCameraScan.tsx` was updated (2026-07-19) with the following changes (verified by code review):

| Change | Detail |
|--------|--------|
| Format | `formats: ["code_39"]` — limits decoder to Code 39 only |
| Resolution | `width/height: ideal 1920×1080 max` — reduced from 4096×2160 |
| Decode interval | `timeBetweenDecodingAttempts: 300ms` — increased from 100ms |
| Camera release | `stopCamera()` now calls `track.stop()` + `srcObject = null` |
| Checksum validation | `hasValidVinCheckDigit()` called in `handleDecodeResult` |
| Visual guide | Horizontal band overlay added to guide VIN sticker positioning |
| Lifecycle | Cleanup effect calls `stopCamera()` on unmount |

These changes are compatible with the Android V1 barcode scanning approach (Zebra TC22 DataWedge handles hardware scanning natively; ML Kit handles OCR fallback).
