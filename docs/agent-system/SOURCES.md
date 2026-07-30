# Configuration Sources

The kit follows these upstream conventions as of 2026-07-16:

- OpenCode project rules: `AGENTS.md`.
- OpenCode project agents: `.opencode/agents/*.md`.
- OpenCode project skills: `.opencode/skills/<name>/SKILL.md`.
- OpenCode MCP servers: `opencode.json` under `mcp`.
- Google Stitch remote MCP endpoint: `https://stitch.googleapis.com/mcp`.
- Stitch API-key header: `X-Goog-Api-Key`.
- Stitch semantic design context: `DESIGN.md`.

Review current upstream documentation before changing configuration because agent and MCP schemas evolve.
