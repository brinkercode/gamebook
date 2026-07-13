---
description: Pre-production exit gate — verifies GDD/macro/tech-plan/art-bible are locked, then a two-seat panel (design + engineering) votes pass/redesign/kill. Pass advances the project to vertical-slice and unlocks /scaffold.
argument-hint: [project]
---

# /preproduction-exit — stage gate (launches `preproduction-exit-wave`)

Runs the **deterministic `preproduction-exit-wave`**: qa-lead read-only inventory of the four
locked artifacts (GDD.md, MACRO_DESIGN.md, TECH_PLAN.md, ART_BIBLE.md — non-stub), then two
independent judge-tier panel seats (design-director: design coherence; eng-director: feasibility)
each return a greenlight verdict. Both pass → producer writes `stage: vertical-slice`.

## Phase 0 — Prep (you, directly)
1. Resolve the project (`ls references/*/config.json`); confirm stage is `preproduction`.
2. If any of the four docs are obviously missing, say so and suggest the authoring wave (/gdd,
   /macro-design, /tech-plan, /art-bible) instead of burning a panel run.

## Phase 1 — Launch
```
Workflow(name: "preproduction-exit-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- `verdict: pass` → announce the stage change; next step is `/scaffold` to create the UE project.
- `verdict: redesign` → present the directives per artifact; stop.
- `verdict: kill` → an honored outcome; present the rationale plainly.
- **No commit. No push.**
