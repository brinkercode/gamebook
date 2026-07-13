---
description: Headless performance capture vs the project's budget ceilings — violations and regressions reported and persisted to docs/perf/. Advisory, never blocks.
argument-hint: [project]
---

# /perf-budget — budget check (launches `perf-budget-wave`)

Runs the **deterministic `perf-budget-wave`**: qa-gate-verifier captures stats from the automation
suite and compares against `quality/performance-budgets.md` (honest about what headless NullRHI
can't measure), eng-gameplay persists `docs/perf/latest.json` + HISTORY and annotates suspected
causes per violation.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo).

## Phase 1 — Launch
```
Workflow(name: "perf-budget-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Metrics table (measured vs budget), violations with suspected causes, regressions since last
  capture. Advisory only — suggest `/fix` or `/feature` for breaches. Commit message provided.
