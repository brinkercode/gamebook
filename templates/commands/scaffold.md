---
description: Create the real UE5 project from a greenlit config — gamebook-init skeleton at repo_path, docs moved in, skeleton integrity independently verified. Runs at preproduction/vertical-slice stages.
argument-hint: <repo_path> [project]
---

# /scaffold — project creation (launches `scaffold-wave`)

Runs the **deterministic `scaffold-wave`**: project-scaffolder creates the UE skeleton (Source/,
Content/, Config/, docs/, Makefile, .claude/ wiring, Git LFS .gitattributes) at `repo_path`,
persists `repo_path` into `references/<project>/config.local.json`, copies the pre-production
docs in; an independent qa-gate-verifier checks skeleton integrity (files exist, `make index`
runs, .uproject valid — honest about what it can't check without an engine install).

## Phase 0 — Prep (you, directly)
1. Resolve the project; stage must be `preproduction` or `vertical-slice` (normally right after
   `/preproduction-exit` passes).
2. Confirm `repo_path` with the user if not passed — this creates a directory tree.

## Phase 1 — Launch
```
Workflow(name: "scaffold-wave", args: { project: "<project>", repo_path: "<absolute path>" })
```

## Phase 2 — Report
- Present created paths + verification results; note any checks skipped for missing engine.
- Suggest `/slice-criteria` as the next step at vertical-slice stage.
- **No commit. No push.** The user inits/commits the new repo.
