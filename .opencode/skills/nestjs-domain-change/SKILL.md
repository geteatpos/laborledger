---
name: nestjs-domain-change
description: Implement a bounded NestJS domain change in LaborLedger without breaking contracts
compatibility: opencode
metadata:
  project: laborledger
---

## Procedure

1. Locate controller, DTO/schema validation, service, Prisma calls, exceptions, and integration tests.
2. Preserve API/BFF response contracts unless the task explicitly changes them.
3. Resolve authorization and tenant scope before loading domain records.
4. Put business rules in services, not controllers.
5. Use a Prisma transaction for multi-write atomic operations.
6. Translate expected domain failures into stable client-safe errors.
7. Log unexpected failures with operation context but without secrets or sensitive payloads.
8. Add focused tests for success, authorization failure, tenant mismatch, invalid state, and persistence failure when meaningful.

## Company operations constraint

When touching `company-operations.service.ts`, do not reorganize unrelated methods. A refactor task must extract exactly one bounded domain with characterization tests and compatibility delegation.
