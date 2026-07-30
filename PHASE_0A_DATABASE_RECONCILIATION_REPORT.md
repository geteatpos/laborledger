# Phase 0A Database Reconciliation Report

Date: 2026-07-20

Repository: `/home/ubuntu/apps/laborledger`

Scope: strict read-only investigation, except for creating this report file and this final readiness-state update. No tests, migrations, resets, seeds, cleanup, source edits outside this report, environment edits, Git changes, service changes, container changes, commits, or pushes were performed during this reconciliation.

Connection targets are shown only as:

```text
host:port/database/user
```

No passwords, tokens, peppers, or complete connection strings are included.

---

## 1. How `apps/api/test/integration-test-db.ts` Selects `DATABASE_URL`

`apps/api/test/integration-test-db.ts` defines the integration-test target as:

```text
INTEGRATION_DATABASE_URL = process.env.DATABASE_URL ?? embedded default
```

The embedded default target is:

```text
localhost:55432/laborledger/laborledger
```

The helper then sets:

```text
process.env.DATABASE_URL = INTEGRATION_DATABASE_URL
```

and `createIntegrationPrisma()` constructs a Prisma client with that same `INTEGRATION_DATABASE_URL`.

The reset helper is:

```text
resetIntegrationDatabase(prisma)
```

It executes one canonical `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` statement against the `PrismaClient` supplied by the spec, then re-seeds the platform superadmin test user.

Several integration specs also repeat the same pattern directly:

```text
const dbUrl = process.env.DATABASE_URL ?? embedded default
process.env.DATABASE_URL = dbUrl
const prisma = new PrismaClient({ datasourceUrl: dbUrl })
beforeEach(() => resetIntegrationDatabase(prisma))
```

Therefore, unless `DATABASE_URL` is already present before Vitest starts, the API integration tests use:

```text
localhost:55432/laborledger/laborledger
```

---

## 2. Which Database The Final Passing `pnpm test` Suite Used

The final passing `pnpm test` suite used:

```text
localhost:55432/laborledger/laborledger
```

Evidence:

- Root script: `pnpm test` runs `pnpm -r --if-present test`.
- API script: `@laborledger/api` runs `vitest run --dir test --maxWorkers=1`.
- Neither script invokes `scripts/with-db-url.mjs`.
- Neither script loads `/home/ubuntu/.config/laborledger/test-db.env`.
- During this reconciliation, the shell process had no pre-existing `DATABASE_URL`:

```text
process.env.DATABASE_URL target: (unset)
```

At reconciliation time, the local external test env file existed and pointed to:

```text
127.0.0.1:5432/servihour_test/servihour_test_app
```

but the repository `pnpm test` path did not load that file. The human operator later confirmed that `/home/ubuntu/.config/laborledger/test-db.env` was retired by manual renaming, so it is no longer an active LaborLedger test environment file. The retirement decision is complete.

Additional consistency evidence from the prior integration-test report: the first `pnpm test` run failed because `mobile_auth_rate_limits` did not exist. That failure matches the default `localhost:55432/laborledger/laborledger` target before the Phase 0A migration was applied there. The `servihour_test` target already had a successful Phase 0A migration row from earlier activity and therefore does not match that initial missing-table failure.

Conclusion:

```text
Final passing pnpm test target: localhost:55432/laborledger/laborledger
Not used by final pnpm test: 127.0.0.1:5432/servihour_test/servihour_test_app
Not used by final pnpm test: localhost:5432/servihour/servihour_app
```

---

## 3. What Service Owns Port 55432

Read-only port and cluster inspection showed:

```text
127.0.0.1:55432 - accepting connections
127.0.0.1:5432  - accepting connections
```

`pg_lsclusters` showed:

```text
16  laborledger_test 55432 online postgres /var/lib/postgresql/16/laborledger_test
16  main             5432  online postgres /var/lib/postgresql/16/main
```

Conclusion:

```text
Port 55432 is owned by local PostgreSQL 16 cluster laborledger_test.
It is not the main PostgreSQL cluster on 5432.
```

---

## 4. Which Database Contains Migration `20260720000000_phase_0a_mobile_foundation`

Migration checked:

```text
20260720000000_phase_0a_mobile_foundation
```

Read-only metadata inspection found the migration in these targets:

### 4.1 LaborLedger default integration database

Target:

```text
localhost:55432/laborledger/laborledger
```

Migration row:

```text
finished_at: 2026-07-20 16:16:53.125627+00
applied_steps_count: 1
```

This is the database that received the Phase 0A migration during the integration-test investigation described in `PHASE_0A_INTEGRATION_TEST_REPORT.md`.

### 4.2 Retired external `test-db.env` database target

Target:

```text
127.0.0.1:5432/servihour_test/servihour_test_app
```

Migration rows:

```text
finished_at: (empty)
applied_steps_count: 0

finished_at: 2026-07-20 03:13:45.046715+00
applied_steps_count: 1
```

This target contains the migration, but the timestamps and the test execution path show it was not the database used by the final passing `pnpm test` suite. The human operator subsequently retired the `test-db.env` file that referenced this target by manual renaming.

### 4.3 Real `servihour` database

Target inspected via local PostgreSQL owner read-only query:

```text
127.0.0.1:5432/servihour/postgres
```

Migration count for Phase 0A:

```text
0
```

Mobile table count for Phase 0A table names:

```text
0
```

Conclusion:

```text
localhost:55432/laborledger/laborledger contains the migration and is the target that received it during the Phase 0A integration-test investigation.
127.0.0.1:5432/servihour_test/servihour_test_app also contains the migration from earlier activity, but was not used by final pnpm test.
127.0.0.1:5432/servihour does not contain the Phase 0A migration.
```

---

## 5. Which Database Was Truncated Or Reset By The Test Suite

The test reset path is `resetIntegrationDatabase(prisma)` in `apps/api/test/integration-test-db.ts`.

That helper executes the canonical truncate statement against whichever `PrismaClient` the test created. Because the final passing `pnpm test` selected:

```text
localhost:55432/laborledger/laborledger
```

the database truncated/reset by the final passing test suite was:

```text
localhost:55432/laborledger/laborledger
```

Read-only row-count probe after this reconciliation showed residual final-test fixture data on that target:

```text
localhost:55432/laborledger/laborledger
groups: 3
users: 4
sessions: 1
mobile_auth_rate_limits: 0
mobile_devices: 0
mobile_sessions: 0
```

Residual data after a passing suite is expected because integration specs reset before each test and then leave the final test's fixture data behind.

At reconciliation time, the external target that was then referenced by `test-db.env` had different residual data:

```text
127.0.0.1:5432/servihour_test/servihour_test_app
groups: 1
users: 3
sessions: 12
mobile_auth_rate_limits: 0
mobile_devices: 0
mobile_sessions: 0
```

That difference is another consistency signal that final `pnpm test` did not use the external target. The `test-db.env` file that referenced it was subsequently retired by manual renaming.

---

## 6. Whether `127.0.0.1:5432/servihour` Was Modified

The repository `.env` target is:

```text
localhost:5432/servihour/servihour_app
```

The app credential in `.env` failed authentication during this reconciliation, so direct inspection with that user was not possible. A local PostgreSQL owner read-only query inspected the same database without using or displaying application secrets:

```text
127.0.0.1:5432/servihour/postgres
```

Results:

```text
Phase 0A migration count: 0
Phase 0A mobile table count: 0
groups: 1
users: 3
sessions: 12
```

Safety reasoning:

- `pnpm test` did not load `.env`.
- `pnpm test` did not invoke `scripts/with-db-url.mjs`.
- The final passing test suite used `localhost:55432/laborledger/laborledger`.
- The explicit Phase 0A migration command recorded in the prior integration-test report targeted `localhost:55432/laborledger/laborledger`.
- The real `servihour` database has no Phase 0A migration row and none of the Phase 0A mobile tables.

Conclusion:

```text
No evidence indicates that 127.0.0.1:5432/servihour was modified by Phase 0A integration testing.
The read-only database metadata is consistent with it not receiving the Phase 0A migration or Phase 0A test reset.
```

---

## 7. Why An Earlier `PHASE_0A_INTEGRATION_TEST_REPORT.md` Version Called 55432 `servihour_test`

An earlier version of `PHASE_0A_INTEGRATION_TEST_REPORT.md` referred to:

```text
localhost:55432/laborledger/laborledger
```

as `servihour_test`.

That earlier wording was incorrect and has since been corrected in the current `PHASE_0A_INTEGRATION_TEST_REPORT.md`.

Cause:

- The earlier report followed the active repository's embedded integration-test default target.
- The earlier report used the user-facing phrase `servihour_test` without reconciling it against `/home/ubuntu/.config/laborledger/test-db.env`.
- The actual `test-db.env` target named `servihour_test` is:

```text
127.0.0.1:5432/servihour_test/servihour_test_app
```

Corrected naming:

```text
localhost:55432/laborledger/laborledger = LaborLedger default integration-test database.
127.0.0.1:5432/servihour_test/servihour_test_app = external test-db.env database.
localhost:5432/servihour/servihour_app = real servihour database target from repository .env.
```

---

## 8. Whether `/home/ubuntu/.config/laborledger/test-db.env` Was Loaded During `pnpm test`

No.

Evidence at reconciliation time:

- `/home/ubuntu/.config/laborledger/test-db.env` existed during the database reconciliation.
- Its `DATABASE_URL` target was:

```text
127.0.0.1:5432/servihour_test/servihour_test_app
```

- Current reconciliation shell had `process.env.DATABASE_URL` unset.
- Root `pnpm test` script does not load `test-db.env`.
- API `pnpm test` script does not load `test-db.env`.
- Repository search found no `test-db.env` load path in the `pnpm test` execution chain.
- `scripts/with-db-url.mjs` loads `.env` / `.env.production` and has its own default, but it is used by database/dev scripts, not by root or API `test` scripts.

Conclusion:

```text
/home/ubuntu/.config/laborledger/test-db.env was not loaded during pnpm test.
```

Subsequent human confirmation:

```text
/home/ubuntu/.config/laborledger/test-db.env was retired by manual renaming after the reconciliation.
```

Final state: `/home/ubuntu/.config/laborledger/test-db.env` must not be treated as an active file. Its retirement by manual renaming is complete.

---

## 9. Recommended Authoritative Integration-Test Database Going Forward

Recommended authoritative target for this repository:

```text
localhost:55432/laborledger/laborledger
```

Rationale:

- It is the embedded default in `apps/api/test/integration-test-db.ts`.
- It is also the default in `scripts/with-db-url.mjs`.
- It is served by a dedicated local PostgreSQL cluster named `laborledger_test`.
- It avoids the legacy ServiHour naming collision.
- It was the database actually used by the final passing `pnpm test` suite.

Required policy correction:

```text
Stop referring to localhost:55432/laborledger/laborledger as servihour_test.
Retirement of /home/ubuntu/.config/laborledger/test-db.env is complete by manual renaming; do not reference it for LaborLedger integration tests.
```

No file or environment changes were made as part of the reconciliation itself. The later retirement of `/home/ubuntu/.config/laborledger/test-db.env` was confirmed by the human operator.

---

## Final Required Answers

### Database used by the final passing test suite

```text
localhost:55432/laborledger/laborledger
```

### Database that received the Phase 0A migration

```text
localhost:55432/laborledger/laborledger
```

Note: `127.0.0.1:5432/servihour_test/servihour_test_app` also contains the migration from earlier activity, but it was not the final `pnpm test` target and was not the database described by the explicit Phase 0A migration command in the prior report.

### Database that was truncated/reset

```text
localhost:55432/laborledger/laborledger
```

### Real database safety result

```text
No evidence indicates that 127.0.0.1:5432/servihour was modified by Phase 0A integration testing.
It has no Phase 0A migration row and none of the Phase 0A mobile tables.
```

### Required corrections to prior reports

```text
Completed in PHASE_0A_INTEGRATION_TEST_REPORT.md:
- localhost:55432/laborledger/laborledger is no longer called "servihour_test".
- The report explicitly states final pnpm test used localhost:55432/laborledger/laborledger.
- The report explicitly states 127.0.0.1:5432/servihour_test/servihour_test_app is a separate manual sandbox and was not loaded by pnpm test.
- This reconciliation report identifies /home/ubuntu/.config/laborledger/test-db.env as the source of that separate manual sandbox target.
```

### Final result: CONSISTENT or INCONSISTENT

```text
CONSISTENT
```

The test execution path is consistent: final tests used `localhost:55432/laborledger/laborledger`. The prior reporting/naming inconsistency has been corrected in `PHASE_0A_INTEGRATION_TEST_REPORT.md`; that report no longer calls the 55432 target `servihour_test` and explicitly distinguishes the separate manual sandbox `127.0.0.1:5432/servihour_test/servihour_test_app`.

### Exact next action

```text
Retirement decision is complete: /home/ubuntu/.config/laborledger/test-db.env was manually renamed and must not be used for LaborLedger integration tests. Use localhost:55432/laborledger/laborledger as the authoritative integration-test target going forward. The next approved operational action is the four selective commits described in PHASE_0A_COMMIT_PREPARATION_REPORT.md.
```
