---
description: Build a game feature end-to-end (design brief → C++ systems + tests → BP/level/audio → review → cook/automation validate). Deterministic feature-wave, non-trusting gates.
argument-hint: <feature in plain English>
---

# /feature — pod feature pipeline (launches `feature-wave`)

`/feature $ARGUMENTS` assembles a feature pod through the **deterministic `feature-wave`**
(`.claude/workflows/feature-wave.js`): design-director writes the brief + acceptance criteria,
eng-gameplay builds C++ systems (with mandatory `systems_surface[]`) while qa-lead writes failing
tests, an **independent** qa-gate-verifier gates the build, then design-technical/design-level/
audio-designer integrate content, eng-director reviews, and a final independent validation runs
cook-smoke → automation-critical → gate. The wave returns a commit message; **you never commit.**

> Scope: one feature. Runs only at `vertical-slice`/`production` stages — features are frozen at
> alpha (the wave self-skips with the reason if out of stage).

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` to start a project first."
2. **Scope check.** If `$ARGUMENTS` is under 4 words or ambiguous, `AskUserQuestion` ONCE.
3. **Scope flags.** `levels: true` if the feature needs level/encounter work; `audio: true` if it
   needs Wwise/MetaSounds hookup.
4. Clear stale handoffs: `rm -f .claude/handoffs/*.json`. Refresh INDEX (`make index`) if present.

## Phase 1 — Launch the wave

```
Workflow(name: "feature-wave", args: {
  feature: "$ARGUMENTS",
  project: "<project under references/, or _TEMPLATE for in-repo config>",
  levels: <true|false>,
  audio: <true|false>
})
```

## Phase 2 — Report

1. Present ONE structured summary (brief, acceptance criteria, systems_surface, files, review,
   validation, commit message).
2. `status: "skipped"` → explain the stage/capability reason.
3. `status: "needsRework"` → surface the failing phase + blockers/logs and stop (no silent retry).
4. **No commit. No push.** The user commits.

## Substitutions
`$ARGUMENTS` — the feature description the user passed.
