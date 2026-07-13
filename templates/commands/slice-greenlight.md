---
description: Vertical-slice greenlight — fresh independent validation, then a Fable-tier panel judges strictly against the LOCKED criteria. Pass advances the project to production; redesign and kill are honored outcomes.
argument-hint: [project]
---

# /slice-greenlight — stage gate (launches `slice-greenlight-wave`)

Runs the **deterministic `slice-greenlight-wave`**: qa-gate-verifier re-validates the slice from
scratch (cook-smoke → automation-critical → gate — stale results don't count), then a single
panel seat at the **greenlight tier (Fable)** judges criterion-by-criterion against
`docs/SLICE_CRITERIA.md`. Pass → producer writes `stage: production`.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `vertical-slice`; the slice should have been built (`/slice`).

## Phase 1 — Launch
```
Workflow(name: "slice-greenlight-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- `verdict: pass` → announce production stage; `/feature` is unlocked.
- `verdict: redesign` → present the directives; suggest re-running `/slice` after.
- `verdict: kill` → present the rationale plainly — killing at the slice is a normal studio outcome.
- **No commit. No push.**
