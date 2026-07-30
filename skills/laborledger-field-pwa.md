# laborledger-field-pwa

## Cuándo usar

Cuando necesites trabajar con la PWA de campo: login PIN, clock, breaks, recepción de autos, jobs, labor work, progreso de servicio, VIN scan, bloqueos/notas, o entender las limitaciones offline.

## Decisión de producto

- Field/PWA es la única app operativa para empleados: clock, recepción de autos, VIN/jobs, labor work y progreso.
- Kiosk/Worker son legacy y no deben crecer.
- No crear nuevas features, pantallas ni apps separadas en `apps/kiosk` o `apps/worker`.
- Si hay endpoints `/kiosk/*` o `/worker/*`, tratarlos como compatibilidad temporal consumida por `apps/field` hasta `FIELD-UNIFICATION01`.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `apps/field/src/lib/field-session.ts` | HMAC-signed session cookies (TTL 8h) |
| `apps/field/src/lib/field-clock-utils.ts` | Mapeo temporal de estados legacy kiosk → field |
| `apps/field/src/lib/field-jobs-client.ts` | API client para endpoints legacy worker/jobs usados por Field |
| `apps/field/src/lib/field-kiosk-client.ts` | API client para endpoints legacy kiosk lookup/punch usados por Field |
| `apps/field/src/lib/field-labor-work-client.ts` | API client para labor work endpoints |
| `apps/field/src/lib/worker-scanner-utils.ts` | Lógica de scanner VIN (hardware + cámara) |
| `apps/field/src/lib/field-company-resolver.ts` | Resuelve company ID desde env |
| `apps/field/src/components/employee/FieldLoginPanel.tsx` | Login por PIN |
| `apps/field/src/components/employee/FieldClockPanel.tsx` | Clock in/out/break |
| `apps/field/src/components/employee/EmployeeJobWorkflowPanel.tsx` | Workflow completo de jobs (752 líneas) |
| `apps/field/src/components/employee/EmployeeCreateJobPanel.tsx` | Crear job desde cero |
| `apps/field/src/components/employee/EmployeeLaborWorkPanel.tsx` | Labor work tracking |
| `apps/field/src/components/worker/WorkerCameraScan.tsx` | Escaneo por cámara legacy-compatible dentro de Field (BarcodeDetector API) |

## Rutas field

| Ruta | Descripción |
|------|-------------|
| `/field/login` | Login por PIN |
| `/field/home` | Dashboard empleado |
| `/field/clock` | Clock in/out/break |
| `/field/summary` | Resumen de jobs |
| `/field/jobs/new` | Nuevo job desde campo |
| `/field/jobs/[jobId]` | Workflow de job específico |
| `/field/jobs/[jobId]/notes` | Notas de job |
| `/field/offline` | Página offline |

## Compatibilidad legacy dentro de Field

| Ruta / API | Estado |
|------------|--------|
| `/field/kiosk/*` | Redirects legacy hacia flujos Field-first. No crear pantallas nuevas aquí. |
| `/field/worker/*` | Redirects legacy hacia flujos Field-first. No crear pantallas nuevas aquí. |
| `/api/kiosk/*` | BFF temporal hacia API `/kiosk/*` para clock/punch. Proteger en SECURITY-HARDENING01. |
| `/api/worker/*` | BFF temporal hacia API `/worker/*` para VIN/jobs. Proteger en SECURITY-HARDENING01. |

## Sesiones Field

- Cookie `laborledger.field.sid` — HMAC-SHA256 signed
- Payload: `{ employeeId, companyId, fullName, sessionType }`
- TTL: 8 horas
- El PIN solo se transmite en `/api/field/login`. Después se usa la cookie.

## Limitaciones

- **No hay service worker** — la app no funciona offline. Los punches y jobs requieren conexión.
- El escaneo VIN por cámara usa `BarcodeDetector` API (Chrome/Edge). No soportado en todos los browsers.
- Hardware scanner: auto-submit en Enter/Tab con debounce de 2s.

## Reglas

- No exponer `WORKER_COMPANY_ID` al cliente (usar server-side resolver).
- El PIN debe ser exactamente 6 dígitos numéricos.
- No permitir clock-out si hay labor work activo (validado por API).
- Los endpoints worker NO tienen guard HTTP — companyId + pin van en body; el hardening actual aplica rate limiting en middleware.
- Los endpoints field/labor-work NO tienen guard HTTP — usan session cookie; el hardening actual aplica rate limiting en middleware.
- SECURITY-HARDENING01 debe proteger Field/PWA PIN login, clock actions, labor work actions, vehicle/job creation actions y endpoints legacy kiosk/worker existentes.
- FIELD-UNIFICATION01 debe reemplazar gradualmente adapters `field-kiosk-client`/`field-jobs-client` por endpoints Field-first sin crear nuevas apps.
