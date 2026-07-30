---
name: nextjs-bff-change
description: Change LaborLedger Admin or Field Next.js code while preserving the BFF boundary
compatibility: opencode
metadata:
  project: laborledger
---

## Procedure

1. Identify whether the target is Admin or Field.
2. Trace browser component → local route handler/server action → API client → NestJS endpoint.
3. Never expose internal API URLs or privileged credentials to client components.
4. Resolve session/company context server-side.
5. Keep request and response types aligned with the API contract.
6. Implement loading, empty, error, success, and confirmation states.
7. Do not display raw backend exceptions to users.
8. Verify keyboard/accessibility behavior in Admin and touch behavior in Field.
9. Add component, route, or integration tests at the most stable boundary.
