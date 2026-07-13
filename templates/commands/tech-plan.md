---
description: Preproduction tech plan (architecture draft + person-day risk register → docs/TECH_PLAN.md). Deterministic tech-plan-wave.
argument-hint: [project name under references/, or blank for in-repo config]
---

# /tech-plan — preproduction architecture + risk register (launches `tech-plan-wave`)

`/tech-plan $ARGUMENTS` runs the **deterministic `tech-plan-wave`**
(`.claude/workflows/tech-plan-wave.js`): eng-director drafts the technical architecture (module
layout, GAS surface strategy, networking implications of the project's networking mode, plugin
baseline, build/CI shape) while producer independently quantifies the risk register — the top 5
risks with mitigations, each costed in person-days. eng-director then merges both drafts into
`docs/TECH_PLAN.md`. The wave returns a commit message; **you never commit.**

> Scope: runs only at the `preproduction` stage — the tech plan is locked when
> `preproduction-exit-wave` advances the project to `vertical-slice` (the wave self-skips with the
> reason if out of stage).

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` to start a project first."
2. Clear stale handoffs: `rm -f .claude/handoffs/*.json`. Refresh INDEX (`make index`) if present.

## Phase 1 — Launch the wave

```
Workflow(name: "tech-plan-wave", args: {
  project: "<project under references/, or _TEMPLATE for in-repo config>"
})
```

## Phase 2 — Report

1. Present ONE structured summary (architecture summary, risk count + top risks with person-day
   estimates, files changed, commit message).
2. `status: "skipped"` → explain the stage reason (tech plan is preproduction-only).
3. `status: "needsRework"` → surface the failing phase + blockers and stop (no silent retry).
4. **No commit. No push.** The user commits.

## Substitutions
`$ARGUMENTS` — the project reference the user passed (optional; defaults to in-repo config).
