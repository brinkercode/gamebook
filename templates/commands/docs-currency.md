---
description: Docs drift check — claims in docs/ compared against the actual code/config/stage reality, drifted docs repaired (docs only, never code).
argument-hint: [project]
---

# /docs-currency — living-docs pass (launches `docs-currency-wave`)

Runs the **deterministic `docs-currency-wave`**: producer scans docs claims against reality
(systems surface, input maps, roadmap vs stage history), design-technical repairs the drifted
docs. Where reality looks wrong instead, it's flagged — not "fixed" in code.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo).

## Phase 1 — Launch
```
Workflow(name: "docs-currency-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Drift list → what was fixed; `clean` → say so. Code-suspect items surfaced separately.
- **No commit. No push.**
