---
description: Production→alpha stage gate — crash sweep, P0–P4 triage, feature-complete audit vs the GDD. Pass = every feature implemented-or-cut AND zero P0/P1 open.
argument-hint: [project]
---

# /alpha-gate — feature-complete gate (launches `alpha-gate-wave`)

Runs the **deterministic `alpha-gate-wave`**: qa-crash-correlator sweeps logs → qa-bug-hunter
triages to P0–P4 counts → design-director audits every GDD feature (implemented, verified by
reading code — or explicitly cut). Pass requires zero Cat-A/P1 and full feature coverage; then
producer writes `stage: alpha`, freezing feature waves.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `production`.

## Phase 1 — Launch
```
Workflow(name: "alpha-gate-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Pass → stage change announced; the debug-focused alpha regime begins.
- Otherwise → defect counts + unimplemented features + directives; suggest `/bug-hunt fix:true`.
- **No commit. No push.**
