#!/usr/bin/env bash
set -euo pipefail

required=(
  AGENTS.md
  MEMORY.md
  CODE_GRAPH.md
  opencode.json
  .opencode/agents/laborledger.md
  .opencode/agents/laborledger-plan.md
  .opencode/skills/laborledger-safe-change/SKILL.md
  .opencode/skills/tenant-scope-audit/SKILL.md
  .stitch/DESIGN.md
)

for path in "${required[@]}"; do
  [[ -f "$path" ]] || { echo "Missing: $path" >&2; exit 1; }
done

python3 -m json.tool opencode.json >/dev/null

while IFS= read -r skill; do
  dir="$(basename "$(dirname "$skill")")"
  name="$(awk '/^name: /{print $2; exit}' "$skill")"
  [[ "$name" == "$dir" ]] || { echo "Skill name mismatch: $skill ($name != $dir)" >&2; exit 1; }
done < <(find .opencode/skills -name SKILL.md -type f | sort)

echo "LaborLedger agent kit structure is valid."
