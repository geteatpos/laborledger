# Employee, Invoice, and Payment Audit and Implementation Plan

**Date:** 2026-07-28  
**Repository:** `/home/ubuntu/apps/laborledger`  
**Branch:** `feature/laborledger-field-v1-phase-0`  
**HEAD:** `30f86102420fa09b2ae56d917acb53b7ecd4652f`  
**Scope:** Employee model, photo/avatar storage, client invoice lifecycle, payment recording, Stripe integration readiness

---

## 1. RESUMEN EJECUTIVO

### Estado Actual

**Empleados (Employee):**  
El modelo `Employee` existe en Prisma (`schema.prisma` línea 398-429) con campos mínimos: `id`, `groupId`, `companyId`, `fullName`, `archivedAt`, `timestamps`. **No existe campo de foto, avatar, ni imagen** para empleados. El `Employee` es un entidad separada del `User` (autenticación admin): el Employee es identificado por PIN en kiosk, mientras que User representa usuarios admin/supervisor que inician sesión.

El `StorageService` (`apps/api/src/modules/storage/storage.service.ts` líneas 1-86) está diseñado exclusivamente para fotos de vehículos con categorías: `reception`, `exterior`, `interior`, `damage`, `part`. **No existe almacenamiento reusable para fotos de empleados.**

**Facturas (ClientInvoice):**  
El modelo `ClientInvoice` (`schema.prisma` líneas 1208-1248) soporta estados `DRAFT`, `ISSUED`, `VOID` (`ClientInvoiceStatus` línea 851-855). El número de factura se asigna al momento de emitir (`issue`) usando formato `INV-YYYYMMDD-####`. Los `ClientInvoiceLine` son inmutables después de la creación (líneas 1283-1318). `subtotalMinor`, `taxMinor` (siempre 0), `totalMinor` calculados en la creación. **No existe modelo Payment, no hay forma de registrar pagos, no hay Stripe, no hay webhooks.**

**Lo que falta para completar:**
- Foto/avatar para empleados + almacenamiento reusable
- Modelo Payment + endpoints para registrar pagos (cash, check, ACH, wire, card)
- Integración Stripe (PaymentIntents, Checkout, webhooks)
- Estados de pago derivados o almacenados: `UNPAID`, `PARTIAL`, `PAID`, `OVERDUE`
- Endpoint para marcar factura como pagada manualmente
- Manejo de pagos parciales
- Servicio de facturación que compute `balanceMinor` desde ledger de pagos

---

## 2. MODELOS ACTUALES

### 2.1 Modelo Employee

**Archivo:** `packages/database/prisma/schema.prisma` líneas 398-429

```prisma
model Employee {
  id          String   @id @default(cuid())
  groupId     String
  companyId   String
  fullName    String
  archivedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  company     Company  @relation(...)
  group       Group    @relation(...)
  rates       EmployeeRate[]
  pinCredentials EmployeePinCredential[]
  shifts      Shift[]
  // ... 15 relaciones más
  
  @@unique([companyId, fullName], map: "employees_company_id_full_name_key")
  @@index([groupId], [companyId], [archivedAt])
}
```

**Relaciones clave:**
- `Employee` → `Company` (many-to-one, línea 406)
- `Employee` → `Group` (many-to-one, línea 407)
- `Employee` → `EmployeeRate` (one-to-many, línea 408) - historial de tarifas
- `Employee` → `EmployeePinCredential` (one-to-many, línea 409) - PINes de acceso field
- `Employee` → `Shift` (one-to-many, línea 410) - turnos asignados
- `Employee` → `MobileSession` (one-to-many, línea 421) - sesiones móviles
- `Employee` → `EmployeeBadgeCredential` (one-to-many, línea 422) - credenciales de badge

**NO existe:** photo, avatar, phone, email, address, emergencyContact, hireDate, terminationDate, department, title, payFrequency, taxInfo

### 2.2 Modelo User (para contexto)

**Archivo:** `packages/database/prisma/schema.prisma` líneas 133-187

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  fullName     String?
  globalRole   GlobalRole @default(NONE)
  // ... relaciones con CompanyMembership, GroupMembership, Session, etc.
}
```

**Distinción User/Employee:**
- `User` = usuario admin/supervisor que se autentica con email/password
- `Employee` = trabajador field identificado por PIN en kiosk

### 2.3 Modelo ClientInvoice

**Archivo:** `packages/database/prisma/schema.prisma` líneas 1208-1248

```prisma
model ClientInvoice {
  id                 String              @id @default(cuid())
  groupId            String
  companyId          String
  serviceClientId     String
  invoiceNumber      String?             // Asignado al emitir
  status             ClientInvoiceStatus @default(DRAFT)
  subtotalMinor      Int
  taxMinor           Int                 @default(0)   // Siempre 0
  totalMinor         Int
  currencyCode       String              @default("USD")
  notes              String?
  dueDate           DateTime?           // No se usa actualmente
  paymentTermsDays   Int?               // No se usa actualmente
  issuerSnapshot    Json?              // Capturado al emitir
  billToSnapshot    Json?              // Capturado al emitir
  amountPaidMinor   Int                 @default(0)  // Solo tracking
  balanceMinor      Int                 @default(0)  // Solo tracking
  issuedAt          DateTime?
  issuedByUserId    String?
  voidedAt          DateTime?
  voidedByUserId    String?
  voidReason        String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  lines             ClientInvoiceLine[]
  invoicedWorkOrders WorkOrder[]
  deliveries        ClientInvoiceDelivery[]
  
  @@index([companyId, status], [companyId, dueDate])
  @@unique([companyId, invoiceNumber])
}
```

### 2.4 Modelo ClientInvoiceLine

**Archivo:** `packages/database/prisma/schema.prisma` líneas 1283-1318

```prisma
model ClientInvoiceLine {
  id                      String        @id @default(cuid())
  groupId                 String
  companyId               String
  clientInvoiceId         String
  workOrderId             String
  workOrderServiceLineId  String
  vehicleId               String
  workOrderNumberSnapshot String
  vinSnapshot             String
  makeSnapshot            String?
  plateSnapshot           String?
  colorSnapshot           String?
  vehicleLabelSnapshot    String?
  serviceNameSnapshot     String
  serviceCategorySnapshot String?
  description             String?
  quantity                Int           @default(1)
  unitPriceMinor          Int
  lineTotalMinor          Int
  currencyCode            String        @default("USD")
  createdAt               DateTime      @default(now())
  
  // Relaciones con WorkOrder, WorkOrderServiceLine, Vehicle
}
```

### 2.5 Modelo CompanyBillingSettings

**Archivo:** `packages/database/prisma/schema.prisma` líneas 1251-1264

```prisma
model CompanyBillingSettings {
  id               String   @id @default(cuid())
  groupId          String
  companyId        String   @unique
  invoicePrefix    String   @default("INV")
  paymentTermsDays Int      @default(30)
  defaultNotes     String?
  // ...
}
```

### 2.6 StorageService (actual)

**Archivo:** `apps/api/src/modules/storage/storage.service.ts` líneas 1-86

```typescript
const ALLOWED_CATEGORIES = new Set([
  "reception", "exterior", "interior", "damage", "part"
]);
// NO existe "avatar" ni "employee" como categoría
```

Este servicio:
- Almacena archivos en `STORAGE_ROOT` (`/var/lib/laborledger/uploads` por defecto)
- Estructura: `{groupId}/{companyId}/{vehicleId}/{category}/{filename}`
- Genera nombres de archivo aleatorios con `randomBytes`
- NO está diseñado para fotos de empleados

### 2.7 Enums relevantes

**ClientInvoiceStatus** (`schema.prisma` líneas 851-855):
```prisma
enum ClientInvoiceStatus {
  DRAFT   // Editable, no enviado
  ISSUED  // Invoice con número asignado, enviado
  VOID    // Cancelado, no cobrable
}
```

---

## 3. BRECHAS IDENTIFICADAS

### 3.1 Empleados

| # | Brecha | Evidencia | Severidad |
|---|--------|-----------|-----------|
| 1 | No existe campo `photoUrl` ni `avatarUrl` en Employee | `schema.prisma` línea 398-429: Employee solo tiene id, groupId, companyId, fullName, archivedAt, timestamps | Alta |
| 2 | No hay servicio de almacenamiento reutilizable para fotos de empleados | `StorageService` línea 21-27: categorías hardcodeadas solo para vehículos | Alta |
| 3 | No hay pantalla admin para gestionar foto de empleado | `employees-workspace.tsx` líneas 1-256 y `employee-detail-drawer.tsx` líneas 1-227: no existe sección de foto | Alta |
| 4 | Employee no tiene: phone, email, address, emergencyContact, hireDate, terminationDate, department, title | `schema.prisma` línea 398-429: campos mínimos | Media |
| 5 | No hay relación User-Employee (el employee no tiene linked user account) | `schema.prisma` Employee no tiene userId ni relación con User | Media |

### 3.2 Facturas

| # | Brecha | Evidencia | Severidad |
|---|--------|-----------|-----------|
| 1 | No existe modelo `Payment` ni `PaymentApplication` | `schema.prisma` líneas 1208-1946: no hay modelo Payment | **Crítica** |
| 2 | No hay endpoint para registrar pagos | `company-operations.controller.ts` líneas 1-1438: no existe POST payment | **Crítica** |
| 3 | No hay Stripe integrado | Grep resultados: "Stripe" = 0 resultados en el codebase | **Crítica** |
| 4 | No hay webhooks para recibir pagos | Grep "webhook" = 0 resultados relevantes | Alta |
| 5 | `amountPaidMinor` y `balanceMinor` son tracking fields pero no se actualizan desde ningún ledger | `schema.prisma` líneas 1224-1225 + `voidClientInvoice` no modifica estos campos | Alta |
| 6 | `taxMinor` siempre es 0, no hay modelo de impuestos | `schema.prisma` línea 1216 + `COMPANY_BILLING_AUDIT_AND_PLAN.md` línea 42 | Media |
| 7 | Invoice number puede collisionar bajo concurrencia | `generateClientInvoiceNumber` usa conteo de filas, no secuencia atómica - `COMPANY_BILLING_AUDIT_AND_PLAN.md` línea 40 | Media |
| 8 | No hay forma de marcar factura como pagada manualmente (cash/bank transfer) | Solo existe `void` - `company-operations.service.ts` línea 4301 | Alta |
| 9 | No hay soporte para pagos parciales | `amountPaidMinor` y `balanceMinor` existen pero no hay lógica que los actualice | Alta |
| 10 | No existe `ClientInvoicePaymentStatus` (UNPAID/PARTIAL/PAID/OVERDUE) | Solo existe `ClientInvoiceStatus` (DRAFT/ISSUED/VOID) - línea 851 | Alta |

---

## 4. MODELO PROPUESTO

### 4.1 Extensión Employee para Photo

```prisma
// packages/database/prisma/schema.prisma

model Employee {
  // ... campos existentes ...
  
  // NUEVO: foto de perfil
  photoUrl        String?   // URL o path a la foto
  photoUpdatedAt  DateTime?
  
  // NUEVO: información personal adicional
  phone           String?
  email           String?
  emergencyContactName  String?
  emergencyContactPhone String?
  hireDate       DateTime?
  terminationDate DateTime?
  department      String?
  title          String?
  // ...
}
```

**Alternativa para StorageService:**
```typescript
// apps/api/src/modules/storage/storage.service.ts

const ALLOWED_CATEGORIES = new Set([
  "reception", "exterior", "interior", "damage", "part",
  // NUEVO:
  "employee_photo", "employee_avatar"
]);
```

### 4.2 Modelo Payment

```prisma
// packages/database/prisma/schema.prisma

enum PaymentMethod {
  CASH
  CHECK
  ACH
  WIRE
  CARD
  OTHER
}

enum PaymentStatus {
  POSTED
  VOIDED
}

model ClientInvoicePayment {
  id                 String        @id @default(cuid())
  groupId            String
  companyId          String
  clientInvoiceId     String
  amountMinor        Int
  currencyCode       String        @default("USD")
  paymentDate        DateTime      // Fecha en que se recibió el pago
  receivedAt         DateTime      @default(now()) // Timestamp de registro
  method             PaymentMethod
  reference          String?       // Check #, ACH trace #, etc.
  notes              String?
  status             PaymentStatus @default(POSTED)
  voidedAt           DateTime?
  voidedByUserId     String?
  voidReason         String?
  recordedByUserId   String
  createdAt          DateTime      @default(now())
  
  company            Company       @relation(...)
  group              Group         @relation(...)
  clientInvoice      ClientInvoice @relation(...)
  recordedBy         User          @relation(...)
  voidedBy           User?         @relation(...)
  
  @@index([companyId])
  @@index([clientInvoiceId])
  @@index([paymentDate])
  @@index([status])
}
```

### 4.3 Enum PaymentStatus para Invoice

```prisma
// packages/database/prisma/schema.prisma

// AGREGAR a ClientInvoiceStatus existente
// O crear nuevo enum:
enum ClientInvoicePaymentStatus {
  UNPAID     // Haven't received any payment
  PARTIAL    // Received some but not full amount
  PAID       // amountPaidMinor >= totalMinor
  OVERDUE    // Past due date and unpaid/partial
}
```

### 4.4 Extensión ClientInvoice

```prisma
// packages/database/prisma/schema.prisma - ClientInvoice existente

model ClientInvoice {
  // ... campos existentes ...
  
  // NUEVO: estado de pago derivado
  paymentStatus     ClientInvoicePaymentStatus? // Puede derivarse de Payments o almacenarse
  
  // Las siguientes ya existen pero no se usan para cálculos:
  // amountPaidMinor, balanceMinor
}
```

---

## 5. MIGRACIONES NECESARIAS

**Nota: Estas son migraciones a crear, NO a ejecutar.**

### 5.1 Migración 1: Agregar campos de foto a Employee

```sql
-- packages/database/prisma/migrations/XXXXX_add_employee_photo_fields/
-- NO modificar migración existente, crear nueva

ALTER TABLE "employees" 
  ADD COLUMN "photoUrl" TEXT,
  ADD COLUMN "photoUpdatedAt" TIMESTAMP,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "hireDate" DATE,
  ADD COLUMN "terminationDate" DATE,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "title" TEXT;
```

### 5.2 Migración 2: Extender StorageService categories (no es migración Prisma)

Esta es una cambio de código en `storage.service.ts` para aceptar categorías `employee_photo` y `employee_avatar`.

### 5.3 Migración 3: Crear modelo Payment

```sql
-- packages/database/prisma/migrations/XXXXX_add_client_invoice_payment/

CREATE TABLE "client_invoice_payments" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientInvoiceId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'USD',
  "paymentDate" TIMESTAMP NOT NULL,
  "receivedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'POSTED',
  "voidedAt" TIMESTAMP,
  "voidedByUserId" TEXT,
  "voidReason" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);

CREATE INDEX "client_invoice_payments_company_id_idx" ON "client_invoice_payments"("companyId");
CREATE INDEX "client_invoice_payments_client_invoice_id_idx" ON "client_invoice_payments"("clientInvoiceId");
CREATE INDEX "client_invoice_payments_payment_date_idx" ON "client_invoice_payments"("paymentDate");
CREATE INDEX "client_invoice_payments_status_idx" ON "client_invoice_payments"("status");

ALTER TABLE "client_invoice_payments" 
  ADD CONSTRAINT "client_invoice_payments_company_id_fkey" 
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT;

ALTER TABLE "client_invoice_payments" 
  ADD CONSTRAINT "client_invoice_payments_client_invoice_id_fkey" 
  FOREIGN KEY ("clientInvoicId") REFERENCES "client_invoices"("id") ON DELETE RESTRICT;
```

### 5.4 Migración 4: Agregar paymentStatus a ClientInvoice (opcional, puede derivarse)

```sql
-- Este campo puede derivarse de los Payments, así que es opcional denormalizarlo
ALTER TABLE "client_invoices" ADD COLUMN "paymentStatus" TEXT;
```

---

## 6. ENDPOINTS REQUERIDOS

### 6.1 Endpoints de Empleado (Extensión)

| Método | Path | Descripción |
|--------|------|-------------|
| `PATCH` | `/company-operations/employees/:employeeId/photo` | Subir/actualizar foto de empleado |
| `GET` | `/company-operations/employees/:employeeId/photo` | Obtener URL de foto actual |
| `DELETE` | `/company-operations/employees/:employeeId/photo` | Eliminar foto |
| `PATCH` | `/company-operations/employees/:employeeId/profile` | Actualizar info personal (phone, email, emergency, etc.) |

### 6.2 Endpoints de Pagos (NUEVOS)

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/company-operations/client-invoices/:clientInvoiceId/payments` | Listar pagos de una factura |
| `POST` | `/company-operations/client-invoices/:clientInvoiceId/payments` | Registrar un pago |
| `POST` | `/company-operations/client-invoice-payments/:paymentId/void` | Anular un pago |
| `GET` | `/company-operations/companies/:companyId/receivables` | Lista de facturas pendientes con filtros |
| `GET` | `/company-operations/client-invoices/:clientInvoiceId/payment-status` | Obtener estado de pago actual |

### 6.3 Endpoints de Factura (Extensión)

| Método | Path | Descripción |
|--------|------|-------------|
| `POST` | `/company-operations/client-invoices/:clientInvoiceId/mark-paid` | Marcar factura como pagada (pago manual completo) |
| `POST` | `/company-operations/client-invoices/:clientInvoiceId/payments/:paymentId/apply` | Aplicar pago a factura (para pagos parciales) |

---

## 7. PANTALLAS ADMIN REQUERIDAS

### 7.1 Pantallas de Empleado (Extensión)

1. **Employee Photo Upload**
   - Componente: `upload-employee-photo-form.tsx`
   - Ubicación: Dentro de `EmployeeDetailDrawer`
   - Funcionalidad: Upload de imagen, preview, delete
   - Estados: loading, success, error

2. **Employee Profile Section**
   - Componente: `employee-profile-section.tsx` (extensión de `employee-detail-drawer.tsx`)
   - Agregar campos: phone, email, emergency contact, hire date, department, title

### 7.2 Pantallas de Facturas (Extensión)

1. **Invoice Payment Panel**
   - Componente: `client-invoice-payment-panel.tsx`
   - Ubicación: Dentro de `ClientInvoiceDetailPanel`
   - Secciones:
     - Payment status badge (UNPAID/PARTIAL/PAID/OVERDUE)
     - Balance amount
     - Payment history list
     - "Record Payment" button
     - Payment form modal (method, amount, date, reference)

2. **Record Payment Modal**
   - Componente: `record-payment-form.tsx`
   - Campos: method (select), amount, payment date, reference, notes
   - Validación: amount > 0, amount <= balance

3. **Receivables View**
   - Nueva página: `/apps/admin/src/app/(workspace)/receivables/page.tsx`
   - Tabla con filtros: service client, status, due date range, overdue only
   - Exportar CSV

4. **Payment Void Confirmation**
   - Componente: `void-payment-dialog.tsx`
   - Campos: void reason (required)

---

## 8. RIESGOS

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|--------|
| 1 | **Pérdida de datos en migración Employee** | Crítica | Crear migración aditiva (nuevas columnas nullable) que no destruya datos existentes |
| 2 | **Invoice number collision bajo concurrencia** | Alta | Ya identificado en `COMPANY_BILLING_AUDIT_AND_PLAN.md` - implementar secuencia atómica |
| 3 | **Double payment**: dos pagos parciales que exceden total | Alta | Validar en servicio: `amountPaidMinor + newPayment <= totalMinor` |
| 4 | **Void payment no recalcula balance** | Alta | En同一个 transaction: void payment + recalculate `amountPaidMinor`/`balanceMinor` |
| 5 | **Storage path traversal** si se acepta category user-input | Alta | Validar que category esté en ALLOWED_CATEGORIES (ya implementado) |
| 6 | **Photo upload sin rate limiting** | Media | Implementar file size limits (max 5MB), image dimension validation |
| 7 | **Employee-User link ambiguo** | Media | Documentar que Employee y User son entidades separadas con propósitos distintos |
| 8 | **Overdue status derivation incorrecta** | Media | Derivar overdue de `dueDate < now() AND paymentStatus != PAID` |

---

## 9. PLAN POR COMMITS (Sugerido - NO ejecutar)

**Orden sugerido de implementación:**

### Fase 1: Photo Storage Foundation
```
1. [db] Add employee photo fields migration (nullable columns)
2. [api] Extend StorageService with employee_photo category
3. [api] Add employee photo upload endpoint PATCH /employees/:id/photo
4. [api] Add employee photo get/delete endpoints
5. [admin] Add upload-employee-photo-form component
6. [admin] Integrate photo upload in EmployeeDetailDrawer
```

### Fase 2: Payment Model & Recording  
```
7. [db] Create client_invoice_payments table migration
8. [api] Add Payment service with create/void/list methods
9. [api] Add POST /client-invoices/:id/payments endpoint
10. [api] Add GET /client-invoices/:id/payments endpoint
11. [api] Add POST /client-invoice-payments/:id/void endpoint
12. [api] Update amountPaidMinor/balanceMinor on payment create/void
13. [api] Add payment status derivation logic
14. [admin] Add record-payment-form component
15. [admin] Add payment panel in ClientInvoiceDetailPanel
```

### Fase 3: Mark as Paid & Receivables
```
16. [api] Add POST /client-invoices/:id/mark-paid (full payment shortcut)
17. [api] Add GET /companies/:id/receivables endpoint
18. [admin] Add "Mark as Paid" button in invoice detail
19. [admin] Create receivables page
20. [admin] Add payment status badge to invoice list
```

### Fase 4: Stripe Integration (Futuro)
```
21. [api] Add Stripe SDK dependency
22. [api] Add Stripe PaymentIntent creation endpoint
23. [api] Add Stripe webhook handler
24. [api] Add Checkout session creation endpoint
25. [admin] Add "Pay Online" button with Stripe Checkout
```

---

## 10. TESTS REQUERIDOS

### 10.1 Employee Photo Tests

1. **Upload photo** - employee can upload photo, photoUrl is updated
2. **Replace photo** - uploading new photo replaces old one
3. **Delete photo** - photoUrl set to null, file deleted from storage
4. **Invalid category rejected** - StorageService rejects non-employee categories
5. **File size validation** - files > 5MB rejected
6. **Authorization** - only company admin can upload photo for their employees

### 10.2 Payment Recording Tests

1. **Record full payment** - amount equals balance, paymentStatus becomes PAID
2. **Record partial payment** - amount < balance, paymentStatus becomes PARTIAL
3. **Overpayment rejected** - amount > balance returns error
4. **Void payment** - payment status becomes VOIDED, balance recalculated
5. **Void recalculates correctly** - voiding a partial payment restores correct balance
6. **Payment methods** - all enum values (CASH, CHECK, ACH, WIRE, CARD, OTHER) accepted
7. **Cross-company rejected** - cannot record payment for invoice belonging to different company
8. **Void requires reason** - empty voidReason rejected

### 10.3 Invoice Payment Status Tests

1. **UNPAID derived correctly** - invoice with no payments has UNPAID status
2. **PARTIAL derived correctly** - invoice with totalPaid < total has PARTIAL status
3. **PAID derived correctly** - invoice with totalPaid >= total has PAID status
4. **OVERDUE derived correctly** - invoice past due date with UNPAID/PARTIAL has OVERDUE status
5. **Void invoice has no payment status** - voided invoices excluded from receivables

### 10.4 Integration Tests

1. **Payment on issued invoice only** - cannot record payment on DRAFT or VOID invoice
2. **Invoice number uniqueness** - concurrent issue attempts don't duplicate numbers
3. **Payment audit trail** - all payment operations create AuditEvent records
4. **Balance calculation accuracy** - multiple partial payments correctly accumulate

---

## 11. COMPATIBILIDAD

### 11.1 Datos Existentes

**Employee:**
- Todos los empleados existentes permanecen válidos
- `photoUrl` será `null` hasta que se suba una foto
- Campos opcionales (phone, email, etc.) serán `null` por defecto

**ClientInvoice:**
- Facturas existentes (DRAFT, ISSUED, VOID) permanecen válidas
- `amountPaidMinor = 0` y `balanceMinor = totalMinor` (o 0 si ya se trackeó)
- `paymentStatus` será `null` o puede derivarse de Payments existentes

**Payments:**
- Si no hay Payments, todas las facturas ISSUED tendrán `paymentStatus = UNPAID` o `balanceMinor = totalMinor`
- No hay forma de migrar "pagos manuales" históricos sin crear registros Payment

### 11.2 Regresión

- Invoice creation/issue/void flow existente NO se modifica
- StorageService existente para vehicles NO se modifica (se extiende el ALLOWED_CATEGORIES)
- EmployeeRate y PIN credential management NO se modifica
- Todos los endpoints existentes siguen funcionando

### 11.3 Notas de Implementación

1. **Employee photo debe coexistir con Vehicle photo storage** - StorageService puede manejar ambas con diferentes categorías
2. **Payment derivation puede ser on-the-fly** - no es obligatorio denormalizar paymentStatus si el performance de queries lo permite
3. **Invoice overdue es derivado, no stored** - `dueDate < now() && paymentStatus != PAID` es suficiente para la mayoría de casos

---

## 12. HALLAZGOS ADICIONALES

### 12.1 User-Employee Relationship

**Hallazgo:** No existe relación directa entre `User` (admin que se loguea) y `Employee` (trabajador que usa PIN en kiosk). Un User no tiene por qué tener un Employee asociado y viceversa.

**Implicación:** Si se necesita que un employee tenga "cuenta de usuario" para ver sus propios datos, esto es un feature separate y requiere diseño de permisos.

### 12.2 Employee Badge Credential

**Hallazgo:** Existe `EmployeeBadgeCredential` (`schema.prisma` líneas 1841-1879) para badges físicos (NFC/RFID). Esto es diferente de una foto de perfil.

**Implicación:** Photo de empleado es para display/admin, no para autenticación física.

### 12.3 StorageService Path Structure

**Hallazgo:** StorageService guarda archivos en `{storageRoot}/{groupId}/{companyId}/{vehicleId}/{category}/{filename}`

**Implicación:** Para photos de empleado, necesitaríamos una estructura como `{storageRoot}/{groupId}/{companyId}/employee/{employeeId}/{category}/{filename}` o reutilizar la estructura existente con `vehicleId = "employee-{employeeId}"`.

### 12.4 Invoice Number Collision Risk

**Hallazgo:** `generateClientInvoiceNumber` usa `aggregate` para contar invoices del día y generar el sufijo secuencial. Esto no es atómico.

**Evidencia:** `COMPANY_BILLING_AUDIT_AND_PLAN.md` línea 40 ya identifica esto.

### 12.5 CompanyBillingSettings.paymentTermsDays

**Hallazgo:** Existe en `CompanyBillingSettings` (línea 1256) pero NO se usa para calcular `dueDate` en la factura. El `dueDate` se calcula en `issueClientInvoice` (línea 4225) desde `billingSettings.paymentTermsDays`.

**Implicación:** Si se cambia `paymentTermsDays` en settings después de emitir una factura, no afecta facturas ya emitidas.

---

## 13. CONCLUSIONES Y BLOQUEOS

### Puede Implementarse Sin Decisión de Negocio:
- Extensión de Employee con photoUrl y campos personales (son aditivas y opcionales)
- StorageService para photos de empleados (extensión de categorías existentes)
- Modelo Payment y endpoints de recording (el flujo está claro)
- Extensión de invoice detail panel para mostrar payment status y registrar pagos

### Requiere Decisión de Negocio:
1. **¿Se requiere link User-Employee?** (para que employee tenga cuenta o vea sus datos)
2. **¿Stripe es mandatory o son suficientes pagos manuales (cash/check/ACH)?** (determina si se implementa integración Stripe)
3. **¿El pago puede exceder el total (overpayment)?** (manejo de overpayment vs rechazo)
4. **¿Facturas pueden tener múltiples pagos de diferentes methods?** (ej: partial ACH + final check)
5. **¿PaymentStatus se almacena o se deriva?** (tradeoff: consistency vs simplicity)

### No Hay Bloqueos Técnicos Que Prevengan Implementación:
- El schema es extensible con migraciones aditivas
- No hay conflictos con work orders o shift scheduling
- El flujo Admin BFF → API Controller → Service → Prisma está establecido
- Tests de integración existentes pueden extenderse

---

**Documento preparado por:** Auditor de Dominio  
**Fecha:** 2026-07-28  
**Tipo:** Documentación de auditoría y plan de implementación  
**Nota:** Este documento es solo lectura. No ejecutar migraciones ni commits listados en el plan.

---

## IMPLEMENTATION STATUS (2026-07-28)

### Commits Realizados

| # | Commit | Descripción |
|---|--------|-------------|
| 1 | 174ecee | feat(employees): add employee profile and photo support |
| 2 | 90d0b3d | feat(admin): add employee profile UI with photo upload |
| 3 | 92a8185 | feat(invoices): add DRAFT editing and manual line items |
| 4 | 7208255 | feat(admin): add invoice DRAFT editor and payment management UI |
| 5 | 3e1c96b | fix(admin): remove unused vars and fix lint errors |

### Estado de Implementación

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| **Employee Profile** | ✅ Implementado | Campos: photoUrl, phone, email, title, department, hireDate, terminationDate, address, emergency contact |
| **Employee Photo Upload** | ✅ Implementado | Storage service con validación MIME (JPEG/PNG/WebP), 5MB límite |
| **Employee Admin UI** | ✅ Implementado | Ficha con avatar fallback, formulario editable, estados loading/empty/error |
| **Invoice DRAFT Editing** | ✅ Implementado | Endpoints PATCH para editar DRAFT |
| **Manual Line Items** | ✅ Implementado | Tipos: SERVICE, PART, REPAIR, LABOR, FEE, DISCOUNT, OTHER |
| **Server-side Recalculation** | ✅ Implementado | subtotal, tax, total se recalculan en el servidor |
| **ClientInvoicePayment Model** | ✅ Implementado | Con PaymentMethod (CASH, BANK_TRANSFER, CARD) y PaymentStatus |
| **Manual Payment Recording** | ✅ Implementado | POST /payments para CASH y BANK_TRANSFER |
| **Payment Admin UI** | ✅ Implementado | Diálogo "Marcar como pagada", historial de pagos |
| **Invoice Detail Panel** | ✅ Implementado | Muestra documento status, payment status, method |
| **Stripe Integration** | ⚠️ Stub | `createStripeCheckoutSession` lanza error "Stripe not configured" |

### Pendientes / Decisiones Necesarias

| Item | Prioridad | Descripción |
|------|-----------|-------------|
| **Stripe Account Model** | 🔴 Alta | ¿Cuenta única de plataforma o Stripe Connect por empresa? |
| **Webhook Stripe** | 🟡 Media | Endpoint `/api/webhooks/stripe` no implementado |
| **Pagos Parciales** | 🟡 Media | No implementado - pagos manuales deben cubrir balance completo |
| **Overpayment** | 🟢 Baja | No manejado - decisión de negocio necesaria |

### Errores de Build Pre-Existentes (NO bloquean)

| Archivo | Error | Origen |
|---------|-------|--------|
| `service-client-billing-fields.tsx` | Missing exports | Fase anterior (mobile/field) |
| `shift-review.service.ts` | TypeScript errors | Pre-existente |
| `weekly-close.ts` | TypeScript errors | Pre-existente |
| `worker/*.ts` | TypeScript errors | Pre-existente |

### Rollback Tag

```
feature-billing-employee-rollback-20260728023402
```

### Backup

No se ejecutó migración de base de datos. Los cambios de schema están en archivos migration SQL pero NO aplicados.

---

**Actualizado por:** Orquestador  
**Fecha:** 2026-07-28  
**Veredicto:** `STRIPE_ACCOUNT_MODEL_DECISION_REQUIRED`
