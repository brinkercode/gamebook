---
description: Graybox one mechanic in a throwaway prototype repo and get a fun/promising/flat/broken verdict. Deterministic prototype-wave, build-only gate.
argument-hint: <the one mechanic to prototype, in plain English>
---

# /prototype — concept-stage mechanic graybox (launches `prototype-wave`)

`/prototype $ARGUMENTS` runs the **deterministic `prototype-wave`**
(`.claude/workflows/prototype-wave.js`): eng-gameplay greyboxes the ONE named mechanic in a
throwaway repo — cube-world, no art, no polish, just a minimal test map that isolates the
mechanic — an **independent** qa-gate-verifier runs a build-only gate (no cook, no automation
suite; this is not a shippable slice), then qa-playtest-analyst drives an automation walkthrough
and reports experience findings. The verdict field (`fun` / `promising` / `flat` / `broken`) is
the deliverable. The wave returns a commit message; **you never commit**, and no stage transition
happens here.

> Scope: exactly one mechanic. Runs only at `concept`/`preproduction` stages — later stages
> prototype inside `/feature` or `/fix` against the real project, not a throwaway repo.

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` to start a project first."
2. **Scratch repo check.** Prototypes are throwaway — they must NOT land in the main project repo.
   If `references/<project>/config.local.json` has no `repo_path` set, STOP and tell the user to
   point `repo_path` at a scratch UE project before running `/prototype` (the wave itself also
   guards this and returns `needsInput` with the same instruction).
3. **Scope check.** If `$ARGUMENTS` doesn't name one clear mechanic, `AskUserQuestion` ONCE to
   narrow it — this wave grayboxes exactly one thing, not a slice.

## Phase 1 — Launch the wave

```
Workflow(name: "prototype-wave", args: {
  mechanic: "$ARGUMENTS",
  project: "<project under references/, or _TEMPLATE for in-repo config>"
})
```

## Phase 2 — Report

1. Present ONE structured summary: mechanic, files changed, build-only gate result, and the
   playtest report (findings + verdict). Lead with the verdict — that's what this command exists
   to answer.
2. `status: "skipped"` → explain the stage/capability reason.
3. `status: "needsInput"` → surface the reason verbatim (usually: point `repo_path` at a scratch
   project) and stop.
4. `status: "needsRework"` → surface the failing phase + blockers/logs and stop (no silent retry).
5. **No commit. No push.** If the user wants to keep the prototype, they commit it themselves —
   in the scratch repo, not this one.

## Substitutions
`$ARGUMENTS` — the mechanic description the user passed.
