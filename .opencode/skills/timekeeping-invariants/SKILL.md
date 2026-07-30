---
name: timekeeping-invariants
description: Protect LaborLedger clock, break, shift review, correction, and weekly-close semantics
compatibility: opencode
metadata:
  project: laborledger
---

## Invariants

- Employee identity comes from the validated PIN/session context.
- Punch transitions follow the existing state machine.
- Duplicate/retried submissions remain idempotent.
- Company and location scope are explicit.
- Break rules and paid/unpaid semantics remain unchanged unless specified.
- Shift review and correction workflows preserve auditability.
- Closed weekly periods reject unauthorized edits; reopen permissions remain restricted.
- Time zone conversions are explicit and tested around midnight and daylight-saving boundaries.

## Test matrix

Cover normal clock in/out, break start/end, duplicate request, invalid transition, wrong company, wrong location, archived employee, closed period, correction application, and concurrent submission where relevant.
