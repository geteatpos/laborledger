# Archived pre-baseline Prisma migrations

This directory preserves the 40 original Prisma migration directories that were active before the controlled baseline adopted on 2026-08-02. Their contents must remain unchanged for audit and rollback reference.

## Why a baseline exists

Fresh `prisma migrate deploy` failed with `MIGRATION_ORDERING_ERROR`: migration `20260728040908_add_invoice_payment_model` references `employees.photoUpdatedAt` before migration `20260728150000_add_employee_profile_fields` creates that column. No migration is missing; the historical ordering is invalid for a fresh database.

The active migration history is now squashed into `../migrations/0_laborledger_baseline_20260802/migration.sql` so new empty databases can be initialized from the current schema in one ordered baseline.

## New database initialization

For a new empty database, run the normal Prisma deployment command against that database. Prisma should apply only `0_laborledger_baseline_20260802` from the active migrations directory.

## Existing database adoption

For an existing database that already matches `schema.prisma`, do **not** run the baseline SQL. After a verified backup and an empty Prisma diff, mark the baseline as applied with `prisma migrate resolve --applied 0_laborledger_baseline_20260802` against that existing database only. This records adoption in `_prisma_migrations` without executing the baseline SQL.

## Rollback reference

If baseline adoption must be rolled back before release, move these archived migration directories back into `../migrations/`, remove `../migrations/0_laborledger_baseline_20260802/`, and keep `../migrations/migration_lock.toml` in the active migrations directory.

## Production safety

Never run the baseline SQL on an existing production database. Production adoption requires an approved maintenance window, a verified backup, a confirmed empty diff, historical migration checks, and `prisma migrate resolve --applied 0_laborledger_baseline_20260802` only after approval.

`migration_lock.toml` remains in `../migrations/` because Prisma expects it in the active migrations directory.
