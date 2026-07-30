---
name: laborledger-safe-change
description: Execute small, production-safe LaborLedger changes with dependency tracing and focused verification
compatibility: opencode
metadata:
  project: laborledger
---

## Use this skill when

A task modifies production behavior, fixes a bug, or changes a business flow.

## Procedure

1. Read `AGENTS.md` and `MEMORY.md`.
2. Identify the user-visible outcome and affected role.
3. Trace entry point → BFF → controller → service → Prisma → external effects → tests.
4. List invariants that must remain true.
5. Check for tenant, role, location, time, money, status, and idempotency implications.
6. Write a minimal plan and a rollback note.
7. Make one coherent patch; do not mix cleanup unrelated to the outcome.
8. Add a regression test or explain why the nearest existing test is sufficient.
9. Run focused verification and review the final diff.
10. Update project memory only for durable facts or decisions.

## Stop conditions

Stop and request explicit approval before destructive data operations, production commands, a schema migration, secret handling, or a broad cross-module rewrite.
