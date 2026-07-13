---
description: Localization pass — hardcoded text moved to stringtables, per-language loc kit updated, build/index gate proves references resolve.
argument-hint: [languages, comma-separated]
---

# /loc — localization pipeline (launches `loc-wave`)

Runs the **deterministic `loc-wave`**: narrative-writer sweeps hardcoded player-facing text into
stringtables (with VO CUE/CONTEXT fields), release-manager updates `docs/loc/LOC_KIT.md` per
language, qa-gate-verifier proves the build still resolves.

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage `alpha`/`beta` (normally after `/content-lock`).
2. Parse languages from `$ARGUMENTS` (default `en`).

## Phase 1 — Launch
```
Workflow(name: "loc-wave", args: { project: "<project>", languages: ["en", ...] })
```

## Phase 2 — Report
- Coverage per category + per-language status + commit message. **No commit. No push.**
