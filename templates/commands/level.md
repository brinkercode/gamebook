---
description: Build a level or encounter — blockout + placement via editor-Python, thin-BP encounter scripting, independent cook/automation gate, design pacing review.
argument-hint: <level/encounter description>
---

# /level — level & encounter pipeline (launches `level-wave`)

Runs the **deterministic `level-wave`**: design-level (design-director at solo staffing) authors
blockout/encounters/streaming through editor-Python generator scripts, an independent
qa-gate-verifier runs cook-smoke → automation-critical → gate (one repair round), and
design-director reviews pacing against the macro design.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `vertical-slice` or `production`; profile needs `levels`.
2. Vague request (<4 words)? `AskUserQuestion` ONCE.

## Phase 1 — Launch
```
Workflow(name: "level-wave", args: { level: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- ONE summary: files, generated assets, gate + review verdicts, commit message.
- `needsRework` → failing phase + blockers, stop. **No commit. No push.**

## Substitutions
`$ARGUMENTS` — the level/encounter description.
