# LaborLedger OpenCode Agent Kit

This package converts the supplied static analysis into project-local OpenCode rules, agents, skills, memory, a code graph, and Google Stitch MCP/design scaffolding.

## Contents

- `AGENTS.md`: always-on repository rules.
- `MEMORY.md`: durable project facts and decisions.
- `CODE_GRAPH.md`: system, module, data, and flow map.
- `opencode.json`: OpenCode permissions, memory instruction, and Stitch MCP.
- `.opencode/agents/`: one primary agent, one planner, and specialized subagents.
- `.opencode/skills/`: reusable domain workflows loaded on demand.
- `.stitch/`: semantic design system scaffold, brief, prompts, and metadata template.
- `docs/agent-system/`: setup, operation, security, and first-run instructions.

## Recommended Usage

1. Install this package at the root of the actual LaborLedger repository.
2. Review differences if files with the same names already exist.
3. Configure `STITCH_API_KEY` locally.
4. Start OpenCode from the repository root.
5. Use `laborledger-plan` for analysis and `laborledger` for implementation.
6. Start with the first-run audit prompt before allowing changes.

## Important Limitation

The uploaded archive contained analysis documents, not the repository itself. All paths, line counts, commands, and findings must be verified against the current checkout before implementation.
