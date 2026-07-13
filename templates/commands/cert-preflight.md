---
description: Per-platform compliance preflight — Steam review, Deck Verified, TRC/XR/Lotcheck-shaped checklists in parallel; go/no-go aggregate with hardware-only checks honestly surfaced.
argument-hint: [project]
---

# /cert-preflight — platform compliance (launches `cert-preflight-wave`)

Runs the **deterministic `cert-preflight-wave`**: one qa-compliance seat per target platform
(from the project's `platforms[]`), each working its platform's checklist read-only. Items that
need a devkit or real hardware are reported as `manual_checks_needed`, never faked as pass.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `beta`/`gold`; profile needs `build`.

## Phase 1 — Launch
```
Workflow(name: "cert-preflight-wave", args: { project: "<project>" })
```

## Phase 2 — Report
- Lead with the aggregate go/no-go; blocking failures per platform; then the manual-hardware
  checklist the user still owns. Nothing was edited.
