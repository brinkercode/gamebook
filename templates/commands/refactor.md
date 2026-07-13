---
description: Worktree-isolated structural refactor — behavior preserved (untouched test suite is the proof), gated and design-reviewed in the worktree; merging is the user's call.
argument-hint: <what to restructure>
---

# /refactor — safe restructuring (launches `refactor-wave`)

Runs the **deterministic `refactor-wave`**: eng-gameplay refactors in an isolated git worktree
(tests untouched — they prove behavior held), qa-gate-verifier runs the full gate + automation in
that worktree, eng-director reviews the structure. The main tree is never touched; you merge the
worktree branch if you like the result.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo).
2. Vague target? `AskUserQuestion` ONCE.

## Phase 1 — Launch
```
Workflow(name: "refactor-wave", args: { target: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Worktree path, structural decisions, gate + review verdicts, commit message; remind the user
  merging the worktree branch is their action.

## Substitutions
`$ARGUMENTS` — the refactor target.
