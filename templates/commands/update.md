---
description: Live content beat — liveops-scoped content batch (data/cosmetics/events, no new systems), independent validation with one repair, patch notes + player comms.
argument-hint: <what this beat ships>
---

# /update — live beat (launches `update-wave`)

Runs the **deterministic `update-wave`**: liveops-producer scopes the beat against the season
calendar (reliable bi-weekly beats over ambitious late ones), design seats build it inside the
live regime (data/content only — new systems need a stage conversation), independent validation
with one repair round, then patch notes + community comms drafts.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `live`.

## Phase 1 — Launch
```
Workflow(name: "update-wave", args: { beat: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Beat contents, calendar fit, files, patch notes + comms paths, commit message.
- Deployment/promotion is the user's button. **No commit. No push.**

## Substitutions
`$ARGUMENTS` — the beat description.
