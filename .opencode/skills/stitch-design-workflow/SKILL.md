---
name: stitch-design-workflow
description: Use Google Stitch MCP to design LaborLedger interfaces before implementation
compatibility: opencode
metadata:
  project: laborledger
---

## Prerequisites

- `STITCH_API_KEY` exists in the local environment and is never committed.
- Stitch MCP is connected.
- Read `.stitch/DESIGN.md` and `.stitch/LABORLEDGER-DESIGN-BRIEF.md`.

## Workflow

1. Select one existing LaborLedger flow and one target device.
2. Inspect current frontend components and extract existing tokens; do not invent brand colors.
3. Create or select a Stitch project dedicated to LaborLedger.
4. Generate no more than three variants for the target screen.
5. Evaluate variants against speed, scanability, accessibility, error recovery, and workflow completeness.
6. Record selected project/screen identifiers in `.stitch/metadata.example.json` copied to a local untracked metadata file.
7. Export or retrieve design artifacts through Stitch.
8. Compare design states: default, loading, empty, validation error, permission error, success, and destructive confirmation.
9. Do not write production React code until the user explicitly requests implementation.
10. During implementation, map design tokens to the existing component system and preserve BFF/domain behavior.

## Field PWA constraints

Large touch targets, high contrast, short labels, minimal typing, clear offline/network feedback, interruption-safe progress, and no hover-only interactions.

## Admin constraints

Dense but readable tables, strong filtering, visible status hierarchy, explicit bulk-action scope, and clear exception queues.
