---
description: Draft the Game Design Document (7 department sections in parallel → design-director synthesis → producer scope-realism review). Deterministic gdd-wave. Preproduction only.
argument-hint: [project name under references/, or blank for in-repo project.config.json]
---

# /gdd — GDD authoring pipeline (launches `gdd-wave`)

`/gdd $ARGUMENTS` drafts the Game Design Document through the **deterministic `gdd-wave`**
(`.claude/workflows/gdd-wave.js`): design-systems, design-combat, design-level,
narrative-designer, art-director, audio-designer, and eng-director each draft a section in
parallel (`docs/gdd/<section>.md`), design-director synthesizes them into `docs/GDD.md` with a
contents map, and producer runs a **scope-realism** review — blockers are scope that cannot fit
the project's staffing/runway, not craft notes. The wave returns a commit message; **you never
commit.**

> Scope: docs only, runs once per project at `preproduction` (the wave self-skips with the reason
> at any other stage). At `solo` staffing, design-systems/design-combat/design-level collapse onto
> design-director — the wave dedupes those into one call automatically.

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` to start a project first."
2. **Stage check.** If the resolved project isn't at `preproduction`, tell the user before
   launching (the wave will self-skip anyway, but save the round trip).

## Phase 1 — Launch the wave

```
Workflow(name: "gdd-wave", args: {
  project: "<project under references/, or _TEMPLATE for in-repo config>"
})
```

## Phase 2 — Report

1. Present ONE structured summary (sections drafted, `docs/GDD.md` contents map, files, producer
   review verdict, commit message).
2. `status: "skipped"` → explain the stage reason.
3. `status: "needsRework"` → surface the failing phase + blockers and stop (no silent retry).
4. **No commit. No push.** The user commits.

## Substitutions
`$ARGUMENTS` — the project name (under `references/`), if given.
