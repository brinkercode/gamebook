---
description: Alpha content lock — art-director placeholder sweep + QA hygiene must both be clean; lock recorded, localization kit opened. Additions after lock are defects.
argument-hint: [project]
---

# /content-lock — content freeze (launches `content-lock-wave`)

Runs the **deterministic `content-lock-wave`**: art-director sweeps for placeholders (gray meshes,
TEMP assets, default materials) while qa-lead checks hygiene; both clean → producer records the
`content-locked` event and release-manager opens `docs/loc/LOC_KIT.md`.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `alpha`.

## Phase 1 — Launch
```
Workflow(name: "content-lock-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Locked → announce; `/loc` unlocked, `/beta-gate` next.
- Blockers → the placeholder list, routed to `/fix`//`/level`. **No commit. No push.**
