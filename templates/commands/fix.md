---
description: Small, scoped change (bug fix, tuning, one-surface tweak). Deterministic fix-wave: one author → independent review → independent gate. Escalates to /feature if it grows.
argument-hint: <what to change in plain English>
---

# /fix — small-change pipeline (launches `fix-wave`)

`/fix $ARGUMENTS` runs a single-surface change through the **deterministic `fix-wave`**
(`.claude/workflows/fix-wave.js`): one author (eng-gameplay for C++, design-technical for
BP/content — chosen by the wave) makes the edit, then an **independent** eng-director review and an
**independent** qa-gate-verifier check it — the author gets no vote. The wave returns a commit
message; **you never commit.**

> Scope: ONE surface (C++ OR Blueprint OR widget OR data asset), no GAS AttributeSet schema
> change, no C++↔BP contract change. If it grows, the wave hands back `status: "escalate"` →
> run `/feature`. Past alpha the wave enforces the debug-only regime automatically.

## Phase 0 — Prep (you, directly)

1. **Resolve the project.** `ls references/*/config.json` (or in-repo `project.config.json`).
   If none, STOP: "Run `/pitch` first."
2. **Scope check.** If `$ARGUMENTS` is under 4 words or vague, `AskUserQuestion` ONCE.

## Phase 1 — Launch the wave

```
Workflow(name: "fix-wave", args: {
  change: "$ARGUMENTS",
  project: "<project under references/, or _TEMPLATE for in-repo config>"
})
```

## Phase 2 — Report

1. Present ONE structured summary (change, files, review verdict, gate verdict, commit message).
2. `status: "escalate"` → tell the user "bigger than a fix — re-run as `/feature $ARGUMENTS`."
3. `status: "needsRework"` → surface the failing phase + blockers/logs and stop.
4. **No commit. No push.** The user commits.

## Substitutions
`$ARGUMENTS` — the change description the user passed.
