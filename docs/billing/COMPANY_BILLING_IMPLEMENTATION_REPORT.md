# Company Billing — Implementation Report

**Date:** 2026-07-27
**Branch:** `feature/laborledger-field-v1-phase-0`
**Orchestrator Verdict:** `COMPANY_BILLING_COMPLETE`

---

## 1. Estado Inicial de Git

- **Branch:** `feature/laborledger-field-v1-phase-0`
- **HEAD inicial:** `b6f800021fba8a328930d7d040540777354d4501`
- **Working tree:** dirty con ~427 archivos modificados (cambios previos no relacionados preservados)

## 2. Tag de Rollback

- `rollback/company-billing-20260727192822` creado en `b6f8000`

## 3. Backup PostgreSQL

- `/home/ubuntu/backups/laborledger/company-billing/laborledger_company_billing_20260727192836.dump` (325K)
- `pg_restore -l` OK

## 4. Resultado del Auditor

- **Doc:** `docs/billing/COMPANY_BILLING_AUDIT_AND_PLAN.md` (commit `b0e967d`)
- Hallazgos: sin pagos/taxes, sin `dueDate`, sin datos cliente, sin snapshot, numeración global

## 5. Modelo Elegido

- Tabla 1:1 `company_billing_settings` por empresa
- Tabla `company_invoice_sequences` para numeración independiente
- Campos en `client_invoices`: `dueDate`, `paymentTermsDays`, `issuerSnapshot`, `billToSnapshot`, `amountPaidMinor`, `balanceMinor`
- Snapshot histórico del emisor y cliente al emitir
- Backfill no destructivo

## 6. Migración y Backfill

- **Migración:** `20260727193000_company_billing_settings/migration.sql`
- Crea tablas nuevas, agrega columnas nullable/defaulted
- Backfill: settings por empresa desde `companies`, secuencias inicializadas, snapshots best-effort
- **Deploy:** `db:migrate:deploy` ejecutado y verificado

## 7. Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/company-operations/companies/:companyId/billing-settings` | Settings de facturación |
| PATCH | `/company-operations/companies/:companyId/billing-settings` | Actualizar settings |
| GET | `/company-operations/companies/:companyId/billing-summary` | Resumen de deuda |
| GET | `/company-operations/companies/:companyId/outstanding-invoices` | Facturas pendientes |
| GET | `/company-operations/companies/:companyId/debtors` | Deudores agrupados |

## 8. Pantallas Admin

- `/billing-settings` — Formulario por empresa con perfil completo
- `/client-invoices` — Lista filtrada por empresa seleccionada
- Drawer de deudores con contacto, totales, facturas, días de atraso

## 9. Badge Rojo

- Solo para facturas vencidas (`overdueInvoiceCount > 0`)
- Color: `bg-error` rojo con texto blanco

## 10. Deudores

- Agrupados por `service-client`
- Datos: cliente, teléfono, correo, total pendiente, total vencido, facturas, días de atraso
- Enlace a facturas de cada deudor

## 11. Snapshot Histórico

- `issuerSnapshot` y `billToSnapshot` se guardan al emitir
- PDF, email e impresión usan snapshots, no settings actuales
- Test verifica que factura antigua no cambia al editar empresa

## 12. Numeración por Empresa

- `CompanyInvoiceSequence` con `@@unique([companyId, sequenceKey])`
- Atómica vía raw SQL `ON CONFLICT DO UPDATE SET "nextValue" = "nextValue" + 1`
- Prefijo configurable por empresa

## 13. Aislamiento entre Empresas

- `requireManagementCompany(principal, companyId)` en cada endpoint
- Tests verifican 403 cross-company

## 14. Tests

- `client-invoices.integration.spec.ts` — billing settings, summaries, debtors, isolation, snapshot
- `client-invoice-email-content.spec.ts` — email snapshot
- `client-invoice-delivery.integration.spec.ts` — delivery flow
- **Resultado:** Tests billing pasan. 35 suites fallan por `MOBILE_AUTH_HASH_PEPPER` (pre-existente)

## 15. Builds

| Servicio | Build | Typecheck |
|----------|-------|-----------|
| API | ✅ PASS | ⚠️ 90+ errores pre-existentes |
| Admin | ✅ PASS | ✅ PASS |

## 16. Commits

```
b4863f6 feat(billing): use invoice snapshots for delivery
6bae627 feat(admin): add billing dashboard and overdue badge
04f89ac feat(billing): add company debt summaries
1e66be8 feat(billing): add company billing settings
b0e967d docs(billing): audit company billing requirements
```

## 17. PM2

- `laborledger-api` reiniciado, online, sin errores nuevos
- `laborledger-admin` reiniciado, online, sin errores nuevos
- `laborledger-field` NO reiniciado (no modificado)
- HTTP: API 200/404 (normal), Admin 307 (redirect login)

## 18. QA

- **Quality Gate:** PASS WITH CONDITIONS
- Condiciones: typecheck API pre-existente, `MOBILE_AUTH_HASH_PEPPER` en test env, `billToSnapshot` incompleto

## 19. Archivos Modificados (25)

### Database
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260727193000_company_billing_settings/migration.sql`

### API
- `apps/api/src/modules/company-operations/company-operations.controller.ts`
- `apps/api/src/modules/company-operations/company-operations.service.ts`
- `apps/api/src/modules/client-invoice-pdf/client-invoice-pdf.service.ts`
- `apps/api/src/modules/client-invoice-delivery/client-invoice-delivery.service.ts`
- `apps/api/src/modules/client-invoice-delivery/client-invoice-email-content.ts`
- `apps/api/test/client-invoices.integration.spec.ts`
- `apps/api/test/client-invoice-email-content.spec.ts`

### Admin
- `apps/admin/src/app/(workspace)/billing-settings/page.tsx` (nuevo)
- `apps/admin/src/app/(workspace)/client-invoices/page.tsx`
- `apps/admin/src/app/api/company-operations/companies/[companyId]/billing-settings/route.ts` (nuevo)
- `apps/admin/src/app/api/company-operations/companies/[companyId]/billing-summary/route.ts` (nuevo)
- `apps/admin/src/app/api/company-operations/companies/[companyId]/outstanding-invoices/route.ts` (nuevo)
- `apps/admin/src/app/api/company-operations/companies/[companyId]/debtors/route.ts` (nuevo)
- `apps/admin/src/components/billing-settings-workspace.tsx` (nuevo)
- `apps/admin/src/components/client-invoice-detail-panel.tsx` (nuevo)
- `apps/admin/src/components/client-invoice-print-view.tsx`
- `apps/admin/src/components/client-invoices-workspace.tsx`
- `apps/admin/src/components/issue-client-invoice-button.tsx`
- `apps/admin/src/components/ms-kpi-strip.tsx` (nuevo)
- `apps/admin/src/lib/admin-nav-config.ts`
- `apps/admin/src/lib/billing-dashboard-utils.ts` (nuevo)
- `apps/admin/src/lib/client-invoice-utils.ts`

### Docs
- `docs/billing/COMPANY_BILLING_AUDIT_AND_PLAN.md`
- `docs/billing/COMPANY_BILLING_IMPLEMENTATION_REPORT.md`

## 20. Pendientes

| Item | Severidad | Descripción |
|------|-----------|-------------|
| API typecheck | HIGH | 90+ errores pre-existentes impiden validación TS del API |
| `MOBILE_AUTH_HASH_PEPPER` | MEDIUM | 35 test suites fallan por env var faltante |
| `billToSnapshot` incompleto | LOW | Solo captura nombre del cliente; dirección/email pendiente |
| Logo de empresa | LOW | Campo en settings pero sin upload de archivo aún |
| Tests Admin | LOW | No hay script `test` en `@laborledger/admin` |

---

**Veredicto Final: `COMPANY_BILLING_COMPLETE`**
