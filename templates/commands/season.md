---
description: Plan the next live season — design arc + production capacity merged into a tiered-confidence calendar of bi-weekly beats (6–8 weeks concrete, rest directional).
argument-hint: [theme]
---

# /season — season planning (launches `season-wave`)

Runs the **deterministic `season-wave`**: design-director shapes the arc (pillars, marquee drops,
cadence hooks), producer sizes capacity and the cut order, liveops-producer writes
`docs/seasons/SEASON_<n>.md` with dated bi-weekly beats — each sized to a `/update` run.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `live`.

## Phase 1 — Launch
```
Workflow(name: "season-wave", args: { theme: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Arc summary, marquee drops, capacity fit + risks, the calendar path, commit message.
- **No commit. No push.**
