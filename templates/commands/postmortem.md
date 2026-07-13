---
description: Blameless postmortem — factual timeline from logs, player-impact assessment, root causes (systems not people), action items each mapped to a wave.
argument-hint: <what happened>
---

# /postmortem — incident retro (launches `postmortem-wave`)

Runs the **deterministic `postmortem-wave`**: qa-crash-correlator assembles the factual timeline,
liveops-producer assesses player impact and comms, producer writes the blameless report to
`docs/postmortems/` with action items that each name an owner role and the wave to run.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `gold`/`live`.

## Phase 1 — Launch
```
Workflow(name: "postmortem-wave", args: { incident: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Timeline highlights, root causes, and the action-item list with their waves.
- **No commit. No push.**

## Substitutions
`$ARGUMENTS` — the incident description.
