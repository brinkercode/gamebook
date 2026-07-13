---
description: Concept-stage project-fate gate — two independent panel seats (design-director + producer) judge the pitch strictly vs criteria. Pass advances stage to preproduction; redesign/kill are honored outcomes. Deterministic concept-greenlight-wave, never runs git.
argument-hint: <project under references/>
---

# /concept-greenlight — concept-stage go/no-go (launches `concept-greenlight-wave`)

`/concept-greenlight $ARGUMENTS` runs the **deterministic `concept-greenlight-wave`**
(`.claude/workflows/concept-greenlight-wave.js`): two independent panel seats — a
`design-director` and a `producer`, both on the greenlight-strength tier for this project-fate
gate — separately judge the concept against three pre-agreed criteria: pitch artifacts complete
(one-sheet, deck, comparables in `references/<project>/pitch/`), prototype playtest verdict
fun-or-promising, and risk articulated. If both seats pass, a producer writes the stage
transition (`concept` → `preproduction`) into `references/<project>/config.json`. A `redesign`
verdict returns merged directives to address before resubmitting. A `kill` verdict is an honored,
normal outcome — not an error. The wave returns a commit message when it edits files;
**you never commit.**

> Scope: one project, one gate. Runs only at the `concept` stage — the wave self-skips with the
> reason if the project has already moved on.

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` to start a project first."
2. **Confirm pitch artifacts exist.** `ls references/<project>/pitch/` — if empty, tell the user
   the pitch isn't ready for greenlight yet rather than launching the wave to fail.
3. **Playtest report.** If a prototype playtest report path is known, pass it as `playtest`;
   otherwise the wave will look under `references/<project>/pitch/` itself.
4. Clear stale handoffs: `rm -f .claude/handoffs/*.json`. Refresh INDEX (`make index`) if present.

## Phase 1 — Launch the wave

```
Workflow(name: "concept-greenlight-wave", args: {
  project: "<project under references/>",
  playtest: "<path to the prototype playtest report, or omit>"
})
```

## Phase 2 — Report

1. Present ONE structured summary: verdict (`pass`/`redesign`/`kill`), both panel seats'
   criteria scoring + rationale, and — on pass — the stage transition + commit message.
2. `status: "skipped"` → explain the stage reason (already past concept).
3. `verdict: "kill"` or `"redesign"` → present it plainly as the panel's decision, not a wave
   failure. On redesign, list the merged `redesign_directives` so the user knows what to fix.
4. `status: "needsRework"` → surface the failing phase + blockers and stop (no silent retry).
5. **No commit. No push.** The user commits.

## Substitutions
`$ARGUMENTS` — the project reference (directory name under `references/`).
