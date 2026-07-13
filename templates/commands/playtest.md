---
description: Playtest the current build — automation-driven walkthrough judged against design pillars; experience findings and a fun/promising/flat/broken verdict. Read-only.
argument-hint: [focus area]
---

# /playtest — experience check (launches `playtest-wave`)

Runs the **deterministic `playtest-wave`**: qa-playtest-analyst drives the build headlessly and
reports EXPERIENCE findings (pacing, clarity, friction) versus the design pillars — the Valve-style
weekly playtest. Fun ≠ correctness: bugs encountered are listed separately for routing, not judged.

## Phase 0 — Prep (you, directly)
1. Resolve the project; any stage from vertical-slice through beta.

## Phase 1 — Launch
```
Workflow(name: "playtest-wave", args: { project: "<project>", focus: "$ARGUMENTS" })
```

## Phase 2 — Report
- Lead with the one-word verdict, then findings by impact; incidental defects last with a
  suggestion to run `/bug-hunt` if any are serious.
- Nothing was edited; nothing to commit.
