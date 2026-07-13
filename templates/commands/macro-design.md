---
description: Author the preproduction macro design doc (level x story x systems flow matrix, difficulty curve, player-verb inventory) with producer scope review. Deterministic macro-design-wave.
argument-hint: [project ref, or omit for in-repo project]
---

# /macro-design — preproduction macro doc pipeline (launches `macro-design-wave`)

`/macro-design $ARGUMENTS` runs the **deterministic `macro-design-wave`**
(`.claude/workflows/macro-design-wave.js`): design-director authors `docs/MACRO_DESIGN.md` — a
tight ~5-page macro covering the level x story x systems flow matrix, the difficulty curve across
the arc, and the player-verb inventory — then an independent `producer` review checks it for scope
against the project's staffing and stack. The wave returns a commit message; **you never commit.**

> Scope: preproduction only. Runs only at the `preproduction` stage — the wave self-skips with the
> reason if out of stage. The macro **locks at preproduction-exit**: once `preproduction-exit-wave`
> advances the project to `vertical-slice`, further edits require a `/milestone` deficiency finding
> or explicit design-director sign-off, not a rerun of this wave.

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` to start a project first."
2. Clear stale handoffs: `rm -f .claude/handoffs/*.json`. Refresh INDEX (`make index`) if present.

## Phase 1 — Launch the wave

```
Workflow(name: "macro-design-wave", args: {
  project: "<project under references/, or _TEMPLATE for in-repo config>"
})
```

## Phase 2 — Report

1. Present ONE structured summary (files, producer review result + blockers/advisories, commit
   message, lock note).
2. `status: "skipped"` → explain the stage reason.
3. `status: "needsRework"` → surface the failing phase + blockers and stop (no silent retry).
4. **No commit. No push.** The user commits.

## Substitutions
`$ARGUMENTS` — the project ref, if the user names one (otherwise resolves in-repo `project.config.json`).
