# Company Billing Audit and Implementation Plan

Date: 2026-07-27

## Scope and constraints

This artifact documents the current company billing surface and the recommended implementation plan for customer billing, invoices, and payments. It is documentation-only: no application code, migrations, Android, Field, VIN, or Telegram changes are included here. Existing uncommitted Admin, invoice, and settings work must be preserved by any future implementation.

## What exists today

- `Company` already stores tenant billing profile fields: `name`, `legalName`, `phone`, `billingEmail`, `primaryContactName`, `addressLine1`, `addressLine2`, `city`, `stateRegion`, `postalCode`, `country`, `currencyCode`, `groupId`, and `settings`.
- `ServiceClient` is tenant-scoped by `groupId` and `companyId`, but currently only stores `name`, archive metadata, and relationships. It does not store customer billing address, billing email, phone, contact name, tax identifier, or payment terms.
- `ClientInvoice` supports draft, issued, and void lifecycle states through `ClientInvoiceStatus` (`DRAFT`, `ISSUED`, `VOID`). It has `subtotalMinor`, `taxMinor`, `totalMinor`, `currencyCode`, notes, issue metadata, void metadata, and invoice lines.
- `ClientInvoiceLine` snapshots work order, VIN, vehicle, service, quantity, and money fields at invoice creation.
- `ClientInvoiceDelivery` tracks invoice email delivery attempts and provider metadata.
- Admin uses BFF-style API routes under `apps/admin/src/app/api/company-operations/...` that forward to the API service endpoints.
- API endpoints currently include:
  - `GET /company-operations/companies/:companyId/client-invoices`
  - `POST /company-operations/companies/:companyId/client-invoices`
  - `GET /company-operations/companies/:companyId/invoiceable-work-orders`
  - `GET /company-operations/client-invoices/:clientInvoiceId`
  - `POST /company-operations/client-invoices/:clientInvoiceId/issue`
  - `POST /company-operations/client-invoices/:clientInvoiceId/void`
  - `GET /company-operations/client-invoices/:clientInvoiceId/deliveries`
  - `GET /company-operations/client-invoices/:clientInvoiceId/pdf`
  - delivery/email endpoints already exist around issued invoices.
- API controller methods delegate to `CompanyOperationsService`, `ClientInvoicePdfService`, and `ClientInvoiceDeliveryService`.
- Current authorization for billing actions uses `requireManagementCompany(principal, companyId)` or invoice company access. This is acceptable for admin/management access, but it is not granular enough for future collections/payment roles.
- Current invoice creation flow validates one active `ServiceClient`, completed work orders, invoice-ready service lines, and same-client work orders; then it creates a draft invoice inside a Prisma transaction.
- Current issue flow creates an invoice number, marks the invoice `ISSUED`, records issue metadata, and moves linked work orders to `INVOICED` inside a Prisma transaction.
- Current void flow marks issued invoices `VOID` and requires a void reason.
- Current PDF generation loads `Company` profile data for `FROM`, uses only `ServiceClient.name` for `BILL TO`, renders lines and totals, and sets `taxMinor` from the invoice record.

## What is missing

- There is no payment model, payment ledger, payment state, settlement workflow, or accounting/tax processing in V1.
- `ClientInvoice` does not have `dueDate`, payment terms, `balanceMinor`, `amountPaidMinor`, paid/partial/overdue states, or a normalized ledger of payment applications.
- `ClientInvoiceStatus` only models document lifecycle (`DRAFT`, `ISSUED`, `VOID`), not receivables state (`UNPAID`, `PARTIAL`, `PAID`, `OVERDUE`, `UNCOLLECTIBLE`, etc.).
- `ServiceClient` lacks billing address, billing email, phone, billing contact, tax identifier, default terms, and any structured billing preferences.
- Invoice numbering currently uses `INV-YYYYMMDD-####` derived from counting existing invoices for the day. This can collide under concurrency and should not be treated as production-safe numbering.
- PDF and email output lack a formal immutable invoice snapshot for issuer and customer. The PDF uses current `Company` profile fields for `FROM` and only the service client name for `BILL TO`, so later profile edits can change historical rendering.
- `taxMinor` is always set to `0`; no tax model, rate selection, exemption handling, jurisdiction, or tax snapshot exists.
- There is no company selector-specific billing UX beyond current company context and filters. Future Admin flows need explicit company selection and clear `companyId`/`groupId` boundaries when a user can manage more than one company.
- Permissions do not separate invoice creation/issue/void from payment recording, refunds, adjustments, or collections review.

## Recommended model

Keep document lifecycle and receivables/payment state separate.

### Invoice lifecycle

- Continue using `ClientInvoiceStatus` for immutable document workflow:
  - `DRAFT`: editable, not sent/posted.
  - `ISSUED`: posted invoice with assigned number and snapshot.
  - `VOID`: cancelled invoice, not collectible.

### Receivables state

- Add a derived or stored payment state such as `ClientInvoicePaymentStatus`:
  - `UNPAID`
  - `PARTIAL`
  - `PAID`
  - `OVERDUE`
  - optionally `UNCOLLECTIBLE` or `WRITE_OFF` in a later accounting phase.
- Store or derive:
  - `amountPaidMinor`
  - `balanceMinor`
  - `dueDate`
  - `paymentTermsCode` / `paymentTermsDays`
  - `lastPaymentAt`
- Prefer deriving `amountPaidMinor`, `balanceMinor`, and payment status from a payment ledger for correctness, while denormalizing summary fields only if list-performance requires it.

### Payments ledger

- Add `ClientInvoicePayment` or `Payment` plus application rows.
- Recommended minimum fields:
  - `id`, `groupId`, `companyId`, `clientInvoiceId`
  - `amountMinor`, `currencyCode`
  - `paymentDate`, `receivedAt`, `recordedByUserId`
  - `method` (`CASH`, `CHECK`, `ACH`, `CARD`, `WIRE`, `OTHER`)
  - `reference`, `notes`
  - `status` (`POSTED`, `VOIDED`), `voidedAt`, `voidedByUserId`, `voidReason`
  - timestamps and indexes by `companyId`, `clientInvoiceId`, `paymentDate`, and `status`.
- If future payments can cover multiple invoices, use `Payment` and `PaymentApplication` rather than direct one-payment-to-one-invoice rows.

### Customer billing profile

- Extend `ServiceClient` with billing fields:
  - `billingContactName`
  - `billingEmail`
  - `phone`
  - `addressLine1`, `addressLine2`, `city`, `stateRegion`, `postalCode`, `country`
  - optional `taxId`, `defaultPaymentTermsDays`, `billingNotes`.
- Keep `companyId` and `groupId` on all billing records and enforce company ownership on reads and writes.

### Invoice snapshots

- Add immutable JSON or scalar snapshot fields on `ClientInvoice` at issue time for:
  - issuer/company: legal name, display name, address, phone, billing email, contact.
  - bill-to/customer: service client name, billing contact, billing email, phone, address, tax ID if applicable.
  - payment terms and due date.
  - tax details once a tax model exists.
- PDFs and emails should render from snapshots for issued invoices, not live profile tables.

### Numbering

- Replace count-based invoice numbering with an atomic per-company sequence.
- Recommended approach: add a `CompanyInvoiceSequence` table or company-scoped counter with `(companyId, sequenceKey/year, nextValue)` and update it inside the same transaction that issues the invoice.
- Keep the current display format if desired (`INV-YYYYMMDD-####` or a yearly sequence), but generate the suffix from a locked/atomic sequence, not by counting existing rows.

## Required endpoints

Use the existing Admin BFF pattern: Admin page/component submits to `apps/admin/src/app/api/company-operations/...`; the BFF forwards to the API controller; the controller delegates to a service; the service validates scope and performs Prisma reads/writes.

### Service client billing profile

- `GET /company-operations/companies/:companyId/service-clients/:serviceClientId/billing-profile`
- `PATCH /company-operations/companies/:companyId/service-clients/:serviceClientId/billing-profile`

### Invoice terms, due dates, and snapshots

- Extend `POST /company-operations/companies/:companyId/client-invoices` to accept optional terms/due date defaults or derive them from `ServiceClient`.
- Extend `POST /company-operations/client-invoices/:clientInvoiceId/issue` to persist invoice number, issuer snapshot, customer snapshot, terms snapshot, and due date inside one transaction.
- `PATCH /company-operations/client-invoices/:clientInvoiceId` for draft-only edits to notes, terms, due date, and selected bill-to data before issue.

### Payments

- `GET /company-operations/client-invoices/:clientInvoiceId/payments`
- `POST /company-operations/client-invoices/:clientInvoiceId/payments`
- `POST /company-operations/client-invoice-payments/:paymentId/void`
- Optional summary endpoint: `GET /company-operations/companies/:companyId/receivables` with filters for service client, status, due date range, overdue only, and search.

### PDF and delivery

- Keep `GET /company-operations/client-invoices/:clientInvoiceId/pdf`, but render from snapshots when present.
- Ensure email body generation uses the same invoice snapshot and due date/payment summary as PDF.

## Required migration

Create a Prisma migration that only touches billing-related tables and preserves existing rows.

1. Extend `ServiceClient` with nullable billing contact, address, phone, email, tax ID, and default terms fields. Existing clients remain valid because fields are nullable.
2. Extend `ClientInvoice` with nullable `dueDate`, terms fields, snapshot fields, and optional denormalized payment summary fields.
3. Add payment status enum and payment method/status enums if stored in Prisma.
4. Add `ClientInvoicePayment` or `Payment`/`PaymentApplication` tables with `groupId`, `companyId`, indexes, audit metadata, and foreign keys.
5. Add `CompanyInvoiceSequence` or equivalent company-scoped numbering table.
6. Backfill existing issued invoices:
   - preserve existing invoice numbers;
   - set `amountPaidMinor = 0` and `balanceMinor = totalMinor` if denormalized fields are added;
   - infer `paymentStatus = UNPAID` for issued invoices, no payment status or `VOID`-specific state for void invoices;
   - leave `dueDate` null unless a documented default is approved;
   - create best-effort issuer snapshots from current `Company` data and bill-to snapshots from current `ServiceClient.name` only, clearly marking missing customer contact/address fields as null.
7. Do not modify Android, Field, VIN, or Telegram schema/features as part of this migration.

## Files expected to change in a future implementation

No code files were modified for this artifact. A future implementation is expected to touch only billing/Admin/API/database areas such as:

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/**`
- `apps/api/src/modules/company-operations/company-operations.controller.ts`
- `apps/api/src/modules/company-operations/company-operations.service.ts`
- `apps/api/src/modules/client-invoice-pdf/**`
- `apps/api/src/modules/client-invoice-delivery/**`
- Admin invoice BFF routes under `apps/admin/src/app/api/company-operations/**/client-invoices/**`
- Admin service client BFF routes under `apps/admin/src/app/api/company-operations/**/service-clients/**`
- Admin invoice UI under `apps/admin/src/app/(workspace)/client-invoices/**` and `apps/admin/src/components/*client-invoice*`
- Admin service client/settings UI under `apps/admin/src/app/(workspace)/service-clients/**`, `apps/admin/src/components/*service-client*`, and company settings components if company profile display is updated.
- Billing utility/tests files such as `apps/admin/src/lib/client-invoice-utils.ts`, `tests/admin/client-invoice-utils.spec.ts`, and relevant API integration specs.

Any future implementation must first inspect and preserve current uncommitted Admin/invoices/settings changes.

## Required tests

- Prisma migration validation on a database with existing issued, draft, and void invoices.
- API integration tests for tenant scope: every payment, invoice, service-client billing profile, and receivables endpoint must reject cross-company and cross-group access.
- Invoice issue tests proving atomic number generation does not duplicate numbers under concurrent issue attempts.
- Invoice creation/issue tests for due date and terms derivation from service client defaults and draft overrides.
- Payment tests for posting, partial payment, full payment, overpayment rejection or handling, voided payment reversal, and balance recalculation.
- Payment status tests for unpaid, partial, paid, overdue, and void invoice edge cases.
- PDF tests proving issued invoices render issuer and bill-to snapshots, not edited live `Company`/`ServiceClient` data.
- Email delivery tests proving due date, balance, and snapshot bill-to data match the PDF.
- Admin tests for company selector behavior, service client billing profile editing, invoice payment entry, filters by payment status/due date, and permission-gated payment actions.
- Regression tests around existing invoice states (`DRAFT`, `ISSUED`, `VOID`), work order invoice transitions, and current `taxMinor = 0` behavior until a tax model is explicitly implemented.

## Admin to Prisma flow

1. Admin UI selects the active company and service client, preserving `companyId` and `groupId` scope from session/context.
2. Admin component submits to an Admin BFF endpoint under `apps/admin/src/app/api/company-operations/...`.
3. The BFF forwards the request with the authenticated session to the API base URL.
4. `CompanyOperationsController` receives the API request and passes the principal, route params, and body to the appropriate service method.
5. The service calls `requireManagementCompany` or future billing-specific permission checks, validates that all records share the requested `companyId`/`groupId`, and normalizes inputs.
6. The service performs Prisma reads/writes inside a transaction for issue, numbering, payment posting, payment voiding, balance changes, audit events, and work order state transitions.
7. The API returns normalized invoice/payment DTOs to the BFF, and the Admin UI refreshes invoice, payment, PDF, and receivables views.
