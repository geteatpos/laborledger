---
name: work-order-invoice-flow
description: Change LaborLedger vehicle intake, work orders, labor execution, and client invoices safely
compatibility: opencode
metadata:
  project: laborledger
---

## Flow to trace

Vehicle intake → VIN/manual vehicle → service client → work order → service lines → assignments → labor progress → completion → invoice lines → PDF/email.

## Invariants

- Every referenced record belongs to the same company.
- Work-order and service-line status transitions are valid.
- Assignment identity is derived from authenticated context where required.
- Progress and completion cannot bypass required inspection or approval rules.
- Invoice lines are deterministic and money rounding is stable.
- External provider failure does not silently corrupt internal state.
- Repeated completion/invoice requests do not create duplicates.

## Required tests

At minimum: happy path, tenant mismatch, invalid status transition, duplicate request, provider failure, and invoice-total assertion for changed pricing logic.
