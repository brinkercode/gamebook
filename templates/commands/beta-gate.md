---
description: Alpha→beta stage gate — art/audio/narrative content-complete audits + zero P0 crashes. Pass starts the debug-only regime.
argument-hint: [project]
---

# /beta-gate — content-complete gate (launches `beta-gate-wave`)

Runs the **deterministic `beta-gate-wave`**: three parallel completeness audits (art placeholders,
audio events, narrative text/VO — capability-gated) plus a fresh crash sweep; producer panel
passes only when all four criteria hold, then writes `stage: beta`. From beta on, the stage guards
in feature/level/narrative waves enforce debugging-only.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `alpha` (content-lock should already be recorded).

## Phase 1 — Launch
```
Workflow(name: "beta-gate-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Pass → stage change + the debug-only rule stated plainly.
- Otherwise → gap list per department. **No commit. No push.**
