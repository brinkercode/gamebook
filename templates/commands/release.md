---
description: Ship prep at gold — dev+shipping packages, independent artifact + strip verification, store page/patch notes/submission checklist. The human presses publish; stage flips to live only on explicit confirmation.
argument-hint: [project] [--confirm-live]
---

# /release — ship preparation (launches `release-wave`)

Runs the **deterministic `release-wave`**: eng-build packages both configs, qa-gate-verifier
independently checks artifacts + shipping-build hygiene (no debug console, stripped symbols),
release-manager writes the store page, patch notes, and `docs/release/SUBMISSION.md` — the
human checklist. **The harness never promotes builds or presses release.**

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `gold` (pass `/rc` first).
2. `confirm_live: true` ONLY if the user explicitly says the game is already published.

## Phase 1 — Launch
```
Workflow(name: "release-wave", args: { project: "<project>", confirm_live: <bool> })
```

## Phase 2 — Report
- Artifacts + verification + the submission checklist; state plainly that publishing is the
  user's action. On confirm_live pass: announce the live stage. **No commit. No push.**
