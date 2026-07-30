---
name: prisma-migration-safety
description: Plan and verify safe Prisma/PostgreSQL migrations for LaborLedger
compatibility: opencode
metadata:
  project: laborledger
---

## Before editing the schema

1. Trace every read and write of the affected fields.
2. Classify the change as additive, backfill, constraint, rename, type change, or removal.
3. Determine table size, lock risk, null/default behavior, indexes, and rollback limitations.
4. Produce an expand → migrate/backfill → verify → contract plan.
5. Require explicit approval before migration execution.

## Prohibited

- `prisma migrate reset`
- `prisma db push --force-reset`
- modifying applied migration files
- dropping columns in the same release that stops writing them
- assuming snapshot/reference fields are unused without a repository-wide trace

## Verification

Run schema validation and focused tests. Provide SQL verification queries without executing production data changes.
