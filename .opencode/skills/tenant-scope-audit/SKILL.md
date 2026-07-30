---
name: tenant-scope-audit
description: Audit LaborLedger code for company, group, employee, and location isolation
compatibility: opencode
metadata:
  project: laborledger
---

## Goal

Prove that every operation can access only the intended tenant and location data.

## Audit steps

1. Identify the source of `companyId`, `groupId`, employee identity, and location scope.
2. Prefer server-derived scope from session/PIN context; distrust request-body or query-string tenant IDs.
3. Enumerate every Prisma read, write, aggregate, raw SQL query, and external export in scope.
4. Verify the scope exists on the primary query and nested connects/updates/deletes.
5. Verify referenced IDs belong to the same company before use.
6. For supervisors, verify assigned-location restrictions.
7. Test two companies with colliding-looking identifiers and confirm isolation.
8. Check logs, files, PDFs, email, Telegram, and caches for cross-tenant exposure.

## Required output

- Scope source.
- Query-by-query result.
- Confirmed leaks.
- Unverified risks.
- Regression tests required.
