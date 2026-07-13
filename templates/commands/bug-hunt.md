---
description: Fan-out bug hunt through three lenses (gameplay logic, memory/lifetime, data/config), deduped; optional fixes each verified by re-driving the repro, then a full gate.
argument-hint: [area] [--fix]
---

# /bug-hunt — proactive defect sweep (launches `bug-hunt-wave`)

Runs the **deterministic `bug-hunt-wave`**: three qa-bug-hunter lenses hunt in parallel
(substantiated defects only — every one carries a deterministic repro), results dedupe, and with
`fix: true` each P0–P2 gets fixed and **accepted only when the re-driven repro no longer fails** —
never on the fixer's word. Full independent gate closes it out.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo).
2. `fix: true` if the user said fix/repair (or passed --fix); default false (hunt only).

## Phase 1 — Launch
```
Workflow(name: "bug-hunt-wave", args: { project: "<project>", area: "$ARGUMENTS", fix: <bool> })
```

## Phase 2 — Report
- Defect inventory by severity with repros; if fixing: verified-vs-open counts + commit message.
- `clean` → say so plainly. **No commit. No push.**
