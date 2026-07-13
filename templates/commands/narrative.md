---
description: Narrative content batch — designer structures the branching/quests, writer fills the prose (CUE/CONTEXT/INFLECTION/EFFECT), director reviews voice, optional Wwise VO stubs.
argument-hint: <quest/arc/character scope> [--vo]
---

# /narrative — narrative pipeline (launches `narrative-wave`)

Runs the **deterministic `narrative-wave`**: narrative-designer builds structure (branching
topology, flags — the player's side), narrative-writer fills prose (the characters' side),
design-director reviews voice + pillars, optional VO event stubs, light build/index gate.
At solo/indie staffing designer+writer are one seat.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `vertical-slice`/`production`; profile needs `narrative`.
2. Set `vo: true` if the user mentioned VO/voice lines or passed --vo.

## Phase 1 — Launch
```
Workflow(name: "narrative-wave", args: { scope: "$ARGUMENTS", project: "<project>", vo: <bool> })
```

## Phase 2 — Report
- ONE summary: structure files, prose files, review verdict, commit message.
- `needsRework` → failing phase + blockers, stop. **No commit. No push.**

## Substitutions
`$ARGUMENTS` — the narrative scope.
