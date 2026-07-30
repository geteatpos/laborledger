---
name: code-graph-maintenance
description: Maintain LaborLedger CODE_GRAPH.md after architecture or data-flow changes
compatibility: opencode
metadata:
  project: laborledger
---

## Update when

- a module is extracted or renamed;
- a route or BFF contract changes;
- a Prisma model or ownership relationship changes;
- an external provider is added or removed;
- a critical flow or invariant changes.

## Procedure

1. Verify the new path and symbols in code.
2. Update only affected diagrams and tables.
3. Mark uncertain/runtime-dependent behavior as unverified.
4. Keep the graph architectural; do not list every helper file.
5. Confirm links and Mermaid syntax are valid.
6. Add the durable decision to `MEMORY.md` when appropriate.
