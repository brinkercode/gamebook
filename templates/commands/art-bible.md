---
description: Author the preproduction art bible (style guide + Megascans/marketplace asset strategy). Deterministic art-bible-wave, parallel draft with art-director merge.
argument-hint: [project ref, or omit for in-repo project]
---

# /art-bible — preproduction art bible pipeline (launches `art-bible-wave`)

`/art-bible $ARGUMENTS` runs the **deterministic `art-bible-wave`**
(`.claude/workflows/art-bible-wave.js`): `art-director` and `art-concept` draft in parallel —
art-director covers palettes, lighting mood, proportions, and UI look; art-concept covers
Megascans/marketplace pick lists per biome/set plus the gap list of anything needing custom
in-house work — then art-director merges both drafts into a single `docs/ART_BIBLE.md`. The wave
returns a commit message; **you never commit.**

> Scope: preproduction only. Runs only at the `preproduction` stage — the wave self-skips with the
> reason if out of stage. No repo exists yet at this stage, so this is documentation only.

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` to start a project first."
2. Clear stale handoffs: `rm -f .claude/handoffs/*.json`. Refresh INDEX (`make index`) if present.

## Phase 1 — Launch the wave

```
Workflow(name: "art-bible-wave", args: {
  project: "<project under references/, or _TEMPLATE for in-repo config>"
})
```

## Phase 2 — Report

1. Present ONE structured summary (style guide draft, asset strategy draft, merged files, commit
   message).
2. `status: "skipped"` → explain the stage reason.
3. `status: "needsRework"` → surface the failing phase + blockers and stop (no silent retry).
4. **No commit. No push.** The user commits.

## Substitutions
`$ARGUMENTS` — the project ref, if the user names one (otherwise resolves in-repo `project.config.json`).
