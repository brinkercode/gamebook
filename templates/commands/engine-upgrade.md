---
description: Worktree-isolated engine/plugin bump — EngineAssociation + deprecation fixes with every API change inventoried, gated AND cook-verified in the worktree, risk-reviewed.
argument-hint: <engine version or plugin list>
---

# /engine-upgrade — isolated bump (launches `engine-upgrade-wave`)

Runs the **deterministic `engine-upgrade-wave`**: eng-build bumps the engine/plugins in an
isolated worktree, fixing exactly what the upgrade forces and inventorying every API change;
qa-gate-verifier runs the gate **and cook-smoke** in the worktree (compiles-but-won't-cook is not
done); eng-director reviews the API-change surface for behavioral risk. You merge if it holds.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo; warns loudly at beta/gold).

## Phase 1 — Launch
```
Workflow(name: "engine-upgrade-wave", args: { to: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Worktree path, API-change inventory, gate/cook + review verdicts, commit message; merging and
  the config engine_version bump are the user's actions.

## Substitutions
`$ARGUMENTS` — the target engine version or plugin list.
