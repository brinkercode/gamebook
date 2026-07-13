---
description: Build the vertical slice against the LOCKED criteria — full pod (systems, tests, BP, levels, audio, VFX), non-trusting gates, cook+automation validation, playtest report.
argument-hint: [project]
---

# /slice — vertical slice build (launches `slice-wave`)

Runs the **deterministic `slice-wave`**: design-director maps the locked criteria to a build plan,
then the full pod builds it (feature-wave shape, slice scope): eng-gameplay + failing tests →
independent gate + one repair → BP/level/audio/VFX integrate → eng-director review → cook-smoke →
automation-critical → gate → qa-playtest-analyst experience report. No stage change — that's
`/slice-greenlight`.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `vertical-slice`; `docs/SLICE_CRITERIA.md` must be LOCKED
   (else run `/slice-criteria` first).
2. Clear stale handoffs; `make index` if present.

## Phase 1 — Launch
```
Workflow(name: "slice-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- ONE structured summary: plan, systems_surface, files, review, validation, playtest verdict,
  commit message. Then suggest `/slice-greenlight`.
- `needsRework` → failing phase + blockers/logs, stop. **No commit. No push.**
