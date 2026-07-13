---
description: Publisher-style milestone review — independent producer judges deliverables with evidence, writes a deficiency list, allows exactly one repair round + resubmission.
argument-hint: <milestone name>
---

# /milestone — milestone acceptance (launches `milestone-wave`)

Runs the **deterministic `milestone-wave`**: producer (who built none of it) reviews the
milestone's deliverables from `docs/ROADMAP.md` (or passed explicitly), returns accepted or a
deficiency list; one parallel repair round routes each deficiency to the right department; one
resubmission review. Mirrors the real publisher 30-day-review loop with capped resubmissions.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `production`/`alpha`/`beta`.
2. If the user enumerated deliverables, pass them as `deliverables: [...]`.

## Phase 1 — Launch
```
Workflow(name: "milestone-wave", args: { milestone: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Accepted → deliverable table + evidence. Rejected after resubmission → remaining deficiencies
  and what bigger effort they need.
- **No commit. No push.**

## Substitutions
`$ARGUMENTS` — the milestone name.
