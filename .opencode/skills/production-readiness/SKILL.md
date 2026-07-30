---
name: production-readiness
description: Review LaborLedger changes for backup, storage, deployment, logging, and operational safety
compatibility: opencode
metadata:
  project: laborledger
---

## Checklist

- Database backup schedule exists and restore has been tested.
- Upload storage is included in backups.
- Capacity checks and alert thresholds are defined.
- Health checks cover database and critical dependencies without exposing secrets.
- Logs include operation, tenant-safe identifiers, and correlation context.
- Deployment and rollback steps are explicit.
- Environment changes are documented by variable name only.
- PM2, Nginx, DNS, migrations, and restart actions require approval.
- No seed, docs, logs, fixtures, or shell history contain credentials.

## Output

Separate release blockers, pre-scale requirements, and later improvements.
