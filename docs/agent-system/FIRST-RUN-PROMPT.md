# First OpenCode Prompt

Use the `laborledger-plan` agent.

```text
Audit this repository against AGENTS.md, MEMORY.md, CODE_GRAPH.md, and the available docs/analysis findings. Do not edit production code.

Goals:
1. Verify the actual monorepo structure, package scripts, framework versions, and active apps.
2. Confirm or correct each critical risk recorded in MEMORY.md, citing exact current files and symbols.
3. Trace the complete tenant-context path for Admin, Field PIN sessions, Telegram, and Prisma queries.
4. Verify the current timekeeping and work-order-to-invoice flows against CODE_GRAPH.md.
5. Identify any existing AGENTS.md, CLAUDE.md, rules, skills, MCP config, or memory files that conflict with this kit.
6. Detect secrets in tracked files, documentation, fixtures, logs, and history references without printing secret values.
7. Run only safe read-only commands plus repository lint/typecheck/test discovery; do not execute migrations, deploys, restarts, or production commands.
8. Produce a discrepancy report grouped as confirmed, outdated, incorrect, and not verifiable.
9. Propose exact edits to MEMORY.md and CODE_GRAPH.md, but do not apply them until reviewed.
10. Recommend the smallest Phase 0 implementation task with acceptance criteria and focused tests.
```
