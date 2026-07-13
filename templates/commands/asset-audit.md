---
description: Content hygiene sweep — Git LFS coverage, naming conventions, texture budgets, redirectors, orphans, generator/asset integrity. Report only; fixes route to /fix.
argument-hint: [project]
---

# /asset-audit — content hygiene (launches `asset-audit-wave`)

Runs the **deterministic `asset-audit-wave`**: qa-lead sweeps six hygiene checks (LFS coverage,
naming vs rules/ue5-naming.md, texture budgets, redirectors, orphans, editor-Python
generator↔asset integrity) and writes a dated report under `docs/audits/`.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo; needs `content` capability).

## Phase 1 — Launch
```
Workflow(name: "asset-audit-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Check table with violation counts; worst offenders listed; note that repairs go through `/fix`.
