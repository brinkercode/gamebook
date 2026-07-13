---
description: The gold gate — deterministic 100% P0-P1 / 90% P2 / 85% P3 math, full validation (gate+cook+gauntlet), then a Fable-tier panel. Pass advances to gold.
argument-hint: [project] [inventory path]
---

# /rc — release-candidate gate (launches `rc-wave`)

Runs the **deterministic `rc-wave`**: the industry gold rule is computed in plain code (zero P0/P1
open, >90% P2 fixed, >85% P3 fixed — fail means no panel is even convened), then full validation,
then the **greenlight-tier (Fable)** panel judges shippability. Pass → producer writes
`stage: gold`. Any critical bug found in a gold candidate afterward means a new RC.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `beta`; a fresh `/bug-bash` inventory should exist.

## Phase 1 — Launch
```
Workflow(name: "rc-wave", args: { project: "<project>", inventory: "<path if known>" })
```

## Phase 2 — Report
- Lead with the math (counts/rates), then the panel verdict + conditions.
- Fail → exactly which severity bucket failed and the open list. **No commit. No push.**
