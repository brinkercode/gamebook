---
description: Expedited crash fix — logs correlated to a top signature, root-caused and fixed, accepted only when the re-driven repro proves the error gone, full gate.
argument-hint: <error description or log path>
---

# /hotfix — live crash response (launches `hotfix-wave`)

Runs the **deterministic `hotfix-wave`**: qa-crash-correlator parses the report + logs to the top
crash signature, qa-bug-hunter root-causes and applies the smallest correct fix, and the fix is
accepted **only when qa-gate-verifier re-drives the scenario and the signature is gone** — never
on the fixer's word. Full gate closes it.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `beta`/`gold`/`live` (earlier: use `/fix`).

## Phase 1 — Launch
```
Workflow(name: "hotfix-wave", args: { error: "$ARGUMENTS", project: "<project>" })
```

## Phase 2 — Report
- Signature, root cause, files, verification evidence, hotfix commit message.
- `escalate` → the fix is structural; present the choice (/feature vs mitigation).
- **No commit. No push.** Deployment is the user's patch flow.

## Substitutions
`$ARGUMENTS` — the error description or log path.
