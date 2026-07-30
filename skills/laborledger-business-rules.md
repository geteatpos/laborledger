# laborledger-business-rules

## Cuándo usar

Cuando necesites verificar reglas de negocio antes de implementar un cambio, o cuando tengas dudas sobre cómo funciona una feature.

## Reglas inviolables

### Billing

- **Billing usa approved clock/punch minutes.** Service timers (prep/wash) son solo referencia. La facturación a clientes y el payroll se basan en horas aprobadas en los shifts, no en los timers de labor work.
- **Rate resolution:** se elige la tarifa más reciente con `effectiveStart <= fecha` y `(effectiveEnd IS NULL OR effectiveEnd > fecha)`. Si no hay tarifa definida, defaults: employee 1900 ($19.00/hora), client 2300 ($23.00/hora) minor units.
- **Labor billing drafts no están implementados.** `createDraft()` lanza `NotImplementedException`. Preview y CSV exports sí funcionan.

### Time clock (Field/PWA, legacy kiosk backend)

- **Producto:** Field/PWA es la única app operativa para empleados: clock, recepción de autos, VIN/jobs, labor work y progreso. Kiosk/Worker son legacy y no deben crecer.
- **Punch state machine:** `scheduled → clock_in → [break_start → break_end] → clock_out`. Solo 1 break no-pago por turno.
- **No clock-out si hay labor work activo.** El sistema bloquea clock-out si el empleado tiene `LaborWorkAssignment` en progreso.
- **Clock-in timing:** máximo 10 min antes del scheduled start, no después del scheduled end.
- **Idempotencia:** cada punch lleva un `idempotencyKey` (UUID) único. Duplicados se rechazan.
- **Late detection:** si clock-in es >5 min después del start, se marca como `isLate`.

### Weekly close

- **Un período cerrado congela shifts, punches y correcciones.** No se pueden modificar.
- **Solo GROUP_OWNER puede reabrir un período.** COMPANY_ADMIN y SUPERVISOR no.
- **Al cerrar, se crea un snapshot** con approvedShiftCount, payableMinutes, gross margin estimates.
- **Al reabrir, se permite modificar** shifts y punches del período.

### Multi-tenancy

- **Datos nunca cruzan compañías.** Un usuario de Compañía A no puede ver datos de Compañía B.
- **Jerarquía:** Platform → Groups → Companies → Locations.
- **Grupos tienen lifecycle:** ACTIVE → SUSPENDED / ARCHIVED. Al suspender, se revocan todas las sesiones del tenant.

### Roles

- **PLATFORM_SUPERADMIN:** acceso total al sistema, todas las compañías.
- **GROUP_OWNER:** acceso total al grupo y sus compañías.
- **COMPANY_ADMIN:** gestión completa de una compañía.
- **SUPERVISOR:** solo locations asignadas. No gestiona usuarios, kioskos, ni weekly close.

### Supervisor scope

- **Solo ve locations asignadas via `SupervisorLocationAssignment`.**
- **No puede:** crear/modificar usuarios, gestionar kioskos, acceder a weekly close, ver empleados de otras locations.
- **Puede:** ver shifts de sus locations, aprobar/rechazar correcciones, revisar work orders.

### Field/PWA unificada

- Nuevos flujos móviles de empleados deben implementarse en `apps/field`.
- No crear ni reintroducir `apps/kiosk` o `apps/worker` como apps separadas.
- Endpoints `/kiosk/*` y `/worker/*`, si existen, son compatibilidad temporal y deben protegerse en seguridad sin diseñar nuevas features sobre ellos.
- `FIELD-UNIFICATION01` debe migrar gradualmente recepción, clock, VIN/jobs y labor work a endpoints/UX Field-first.

### Service Client vs Customer Account

- `ServiceClient` es el cliente/ubicación donde se presta el servicio (ej: "Enterprise Car Sales NH Hudson").
- No confundir con cuentas de facturación (customer accounts). En la versión actual, billing se maneja por service client + work order.

### Work Orders

- **Status workflow:** DRAFT → READY → ASSIGNED → IN_PROGRESS → COMPLETED → INVOICED → CANCELLED.
- **Un work order INVOICED no puede modificarse** (protegido por la aplicación, no por DB constraint).
- **Work order number** se genera automáticamente por compañía.

### Vehicles

- **VIN es único por compañía** (unique constraint en DB).
- **VIN válido:** 17 caracteres, sin I/O/Q.
- **VIN decode** usa NHTSA VPIC API en producción, stub en desarrollo.

## Copy para usuarios

- Service times reference only: "Service times are reference only. Labor billing uses approved clock/punch hours."
- Supervisor blocked: "Supervisors can only manage their assigned locations."
- Weekly close: no confundir "close" con "approve todos los shifts primero".
