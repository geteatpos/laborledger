# Operating Workflow

## Choose the Agent

- Planning, architecture, migration design, or incident analysis: `laborledger-plan`.
- Normal implementation: `laborledger`.
- Read-only dependency trace: `@laborledger-explorer`.
- Security review: `@security-auditor`.
- Tenant isolation review: `@tenant-auditor`.
- NestJS implementation: `@laborledger-backend`.
- Admin/Field implementation: `@laborledger-frontend`.
- Prisma/PostgreSQL work: `@laborledger-database`.
- Release review: `@qa-reviewer`.
- Stitch design: `@laborledger-design`.

## Recommended Task Sequence

1. Run a read-only trace.
2. Approve a narrowly scoped plan.
3. Implement one outcome.
4. Run focused tests.
5. Invoke security/tenant review for sensitive changes.
6. Invoke QA review.
7. Update memory/code graph only when durable information changed.

## Prompt Pattern

```text
Outcome:
Affected user/flow:
In scope:
Out of scope:
Acceptance criteria:
Verification required:
```

## Refactor Pattern

For `company-operations.service.ts`:

1. Characterize existing behavior.
2. Select one domain only.
3. Create the new service/module boundary.
4. Delegate old public methods to the new service.
5. Keep controllers and response contracts stable.
6. Run focused and integration tests.
7. Stop before extracting the next domain.

## Design-to-Code Pattern

1. Extract existing design tokens.
2. Generate/select Stitch design.
3. Review workflow and all states.
4. Record Stitch metadata locally.
5. Create a separate implementation task.
6. Implement using current components and BFF contracts.
7. Compare the result visually and functionally.
