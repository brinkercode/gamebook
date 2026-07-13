---
description: Lock the vertical-slice acceptance criteria BEFORE building the slice — design drafts measurable criteria, QA maps each to a Functional Test, producer writes the LOCKED file the greenlight later judges against.
argument-hint: [project]
---

# /slice-criteria — criteria lock (launches `slice-criteria-wave`)

Runs the **deterministic `slice-criteria-wave`**: design-director drafts measurable acceptance
criteria for a 20–60 minute slice from the GDD + macro design; qa-lead annotates each criterion
with the Functional Test spec that will prove it (fails-without/passes-with); producer writes
`docs/SLICE_CRITERIA.md` marked **LOCKED**. `slice-greenlight-wave` judges strictly against this
file — criteria written after the slice is built don't count.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `vertical-slice`.
2. If GDD/macro are missing, run /gdd + /macro-design first.

## Phase 1 — Launch
```
Workflow(name: "slice-criteria-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Present the locked criteria list verbatim + the test mapping.
- Next step: `/slice` to build against them.
- **No commit. No push.**
