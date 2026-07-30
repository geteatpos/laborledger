# laborledger-api-modules

## Cuándo usar

Cuando necesites entender o modificar los módulos de la API NestJS: company operations, kiosk, worker, labor billing, labor work, invoices, reports, VIN decode, o email.

## Módulos

### Company Operations (`company-operations/`)

El módulo más grande (~3500 líneas en el service). CRUD de:

| Recurso | Endpoints clave |
|---------|----------------|
| Service Clients | CRUD + archive/unarchive + rates |
| Service Catalog | CRUD + archive/unarchive |
| Vehicles | CRUD + archive/unarchive + VIN decode |
| Work Orders | CRUD + cancel + assign/unassign employees |
| Client Invoices | CRUD + issue/void + PDF + send email + deliveries |
| Locations | CRUD + archive/unarchive + rates |
| Employees | CRUD + archive/unarchive + PIN regenerate + rates |
| Supervisors | Assign/unassign a locations |
| Shifts | CRUD + cancel + copy week |
| Shift Review | List + approve + approve additional time |
| Corrections | List + create + approve/reject/apply |
| Weekly Close | Summary + close + reopen |
| Reports | Operations summary KPIs |
| Labor Pay Billing | Preview + CSV payroll + CSV client billing |
| Labor Work Assignments | List + export CSV + patch |
| Company Profile | Get + update |
| Kiosk Admin | CRUD + archive/unarchive + rotate secret |

### Kiosk (`kiosk/`)

| Endpoint | Auth | Propósito |
|----------|------|-----------|
| POST `/kiosk/lookup` | KioskAuthGuard (X-Kiosk-Id + X-Kiosk-Secret) | Lookup empleado por PIN |
| POST `/kiosk/punch` | KioskAuthGuard | Procesar punch (clock_in/out, break) |

### Worker (`worker/`)

| Endpoint | Auth | Propósito |
|----------|------|-----------|
| POST `/worker/lookup` | Body {companyId, pin} | Lookup empleado + asignaciones |
| POST `/worker/scan` | Body {companyId, pin, ...} | Escanear VIN contra work order |
| POST `/worker/service-lines/:id/complete` | Body {companyId, pin} | Completar service line |
| POST `/worker/jobs/options` | Body {companyId, pin} | Opciones para crear job |
| POST `/worker/jobs/create` | Body {companyId, pin, ...} | Crear job desde campo (work order + service + completion) |
| POST `/worker/jobs/recent-completions` | Body {companyId, pin} | Completions recientes |

### Labor Work Assignment (`labor-work-assignment/`)

| Endpoint | Propósito |
|----------|-----------|
| GET/POST `/field/labor-work/active` | Assignment activo |
| GET/POST `/field/labor-work/available-options` | Opciones para empezar trabajo |
| POST `/field/labor-work/start` | Iniciar assignment (requiere clock-in) |
| PATCH `/field/labor-work/:id/progress` | Actualizar progreso (0/25/50/75/100) |
| POST `/field/labor-work/:id/complete` | Completar |
| POST `/field/labor-work/:id/block` | Reportar bloqueo |
| POST `/field/labor-work/:id/cancel` | Cancelar |

### Corrections (`corrections/`)

6 tipos de corrección: MISSING_CLOCK_OUT, OPEN_BREAK_END, INCORRECT_CLOCK_IN/OUT/BREAK_START/BREAK_END. Flujo: PENDING → APPROVED/REJECTED → APPLIED.

### Weekly Close (`weekly-close/`)

Cierra un período semanal. Crea snapshot con approvedShiftCount, payableMinutes, gross margin estimates. Lockea el período — no más modificaciones. Solo GROUP_OWNER puede reabrir.

### Client Invoice PDF (`client-invoice-pdf/`)

Genera PDF con PDFKit. Company letterhead, line items, totals. DRAFT/VOID watermarks.

### Client Invoice Delivery (`client-invoice-delivery/`)

Envía invoice por email vía Resend. Registra delivery attempt en DB.

### Email (`email/`)

Abstracción: `EmailProvider` interface. Dos implementaciones: `ConsoleEmailProviderService` (dev, logea a consola) y `ResendEmailProviderService` (producción).

### VIN Decode (`vin-decode/`)

Dos implementaciones: `StubVinDecoderService` (falso para dev) y `NhtsaVpicVinDecoderService` (real, consulta NHTSA VPIC API).

### Labor Pay Billing (`labor-pay-billing/`)

Preview semanal + CSV exports. Draft creation NO implementado (`NotImplementedException`).

### Operations Reports (`operations-reports/`)

KPIs agregados: vehículos completados, work orders, revenue, employee breakdowns.

## Reglas

- No modificar `company-operations.service.ts` sin revisar los ~3500 lines completos.
- No cambiar reglas de billing (usa approved clock/punch minutes, no service timers).
- Los endpoints worker NO tienen guard — la auth va en el body (companyId + pin).
- Los endpoints field/labor-work NO tienen guard — la auth se maneja desde Field PWA.
- Los endpoints kiosk usan KioskAuthGuard (headers X-Kiosk-Id + X-Kiosk-Secret).
