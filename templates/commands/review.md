---
description: Multi-dimension review (GAS/perf, replication, BP hygiene, save/security) with adversarial verification — only findings that survive a REFUTE attempt are reported. Read-only.
argument-hint: [scope — path or feature]
---

# /review — studio craft review (launches `review-wave`)

Runs the **deterministic `review-wave`**: four dimension reviewers hunt in parallel, then every
finding is re-fed to qa-bug-hunter as an adversarial skeptic ("try to REFUTE it; default REFUTED")
— only CONFIRMED findings reach you. The replication dimension self-skips on single-player
profiles.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo).

## Phase 1 — Launch
```
Workflow(name: "review-wave", args: { scope: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Confirmed findings ranked blocker→minor with file:line and the concrete failure; note fixes go
  through `/fix` or `/feature`. Nothing was edited.
