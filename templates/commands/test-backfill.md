---
description: Prove @critical tests actually test — weak tests (pass-no-matter-what) identified by inspection, strengthened to fail-without/pass-with, suite independently re-gated.
argument-hint: [project]
---

# /test-backfill — test honesty pass (launches `test-backfill-wave`)

Runs the **deterministic `test-backfill-wave`**: qa-lead inspects each @critical Functional Test
(cap 10/run) for weakness — assertions that can't fail, unawaited latent actions — strengthens the
weak ones, and qa-gate-verifier independently proves the suite still passes.

## Phase 0 — Prep (you, directly)
1. Resolve the project (any stage with a repo).

## Phase 1 — Launch
```
Workflow(name: "test-backfill-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Inspected/weak/strengthened counts + files + commit message; `clean` → say so.
- If capped, suggest re-running for the remainder. **No commit. No push.**
