---
description: Audio batch — Wwise events/RTPC/banks authored (WAAPI/work-unit), code-side wiring through GAS gameplay cues, independent build+automation gate.
argument-hint: <feature/area to give audio>
---

# /audio-pass — audio pipeline (launches `audio-pass-wave`)

Runs the **deterministic `audio-pass-wave`**: audio-designer authors the Wwise side (events,
RTPC, banks — the seam Wwise was designed around), audio-technical wires the game side
(gameplay cues, AkComponents, bank loading), qa-gate-verifier independently gates. One seat at
solo/indie staffing.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `vertical-slice`/`production`; profile needs `audio`.

## Phase 1 — Launch
```
Workflow(name: "audio-pass-wave", args: { scope: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- ONE summary: authored events/banks, wiring files, gate verdict, commit message.
- `needsRework` → failing phase + blockers, stop. **No commit. No push.**

## Substitutions
`$ARGUMENTS` — the audio scope.
