---
description: Mass defect hunt — crash sweep plus four hunter lenses (gameplay, UI, save/load, cook), producer-triaged into the P0–P4 inventory the RC gate reads. No fixing.
argument-hint: [project]
---

# /bug-bash — the big sweep (launches `bug-bash-wave`)

Runs the **deterministic `bug-bash-wave`**: qa-crash-correlator parses every log, four
qa-bug-hunter lenses sweep in parallel (substantiated repros only), and producer merges the haul
into a triaged defect inventory with severity counts — the exact input `/rc` later checks against
the 100/90/85 gold gate.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `alpha`/`beta`/`gold`.

## Phase 1 — Launch
```
Workflow(name: "bug-bash-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Counts by severity + the P0/P1 list with repros; route fixes to `/hotfix` or `/bug-hunt fix:true`.
- Nothing was edited.
