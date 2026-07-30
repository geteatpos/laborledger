# Installation

## 1. Copy into the repository root

Copy the contents of `laborledger-opencode-kit/` into the real LaborLedger checkout. Do not overwrite an existing `AGENTS.md`, `MEMORY.md`, or `opencode.json` without merging deliberately.

## 2. Keep secrets local

Set the Stitch key in your shell or a local ignored environment file:

```bash
export STITCH_API_KEY="..."
```

Do not put the real value into `opencode.json`, Markdown, Git, shell scripts, screenshots, or agent prompts.

## 3. Verify OpenCode discovery

From the repository root:

```bash
opencode
```

Check that these agents appear:

- `laborledger`
- `laborledger-plan`
- `laborledger-explorer`
- `laborledger-backend`
- `laborledger-frontend`
- `laborledger-database`
- `security-auditor`
- `tenant-auditor`
- `qa-reviewer`
- `laborledger-design`

OpenCode discovers project agents from `.opencode/agents/` and project skills from `.opencode/skills/<name>/SKILL.md`.

## 4. Verify Stitch MCP

```bash
opencode mcp list
```

The server name is `stitch`. The configuration uses the remote endpoint and an `X-Goog-Api-Key` header sourced from `STITCH_API_KEY`.

## 5. Run the first audit

Use `docs/agent-system/FIRST-RUN-PROMPT.md`. The first run must verify the supplied analysis against the current code and update `MEMORY.md`/`CODE_GRAPH.md` only where confirmed.

## 6. Git hygiene

Recommended tracked files:

- `AGENTS.md`
- `MEMORY.md`
- `CODE_GRAPH.md`
- `opencode.json`
- `.opencode/agents/**`
- `.opencode/skills/**`
- `.stitch/DESIGN.md`
- `.stitch/LABORLEDGER-DESIGN-BRIEF.md`
- `.stitch/prompts/**`

Recommended ignored files:

```gitignore
.env.opencode
.stitch/metadata.json
.stitch/designs/
.stitch/downloads/
```
