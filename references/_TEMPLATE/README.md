# references/<project>/ — the project binding

One directory per game project the studio runs. `pitch-wave` creates it (copy of `_TEMPLATE/`);
`resolve-project` reads it at the start of every wave; greenlight/gate waves are the only writers
of `stage` + `stage_history`.

| File | Purpose |
|---|---|
| `config.json` | Canonical binding: profile, stage, staffing, stack, platforms, design/business intent. Committed. |
| `config.local.json` | Machine-local overrides (e.g. `repo_path`). Shallow-merged over config.json. Git-ignored. |
| `pitch/` | Stage-0 artifacts: one-sheet, pitch deck outline, comparables analysis, greenlight verdicts. |
| `docs/` | Pre-production artifacts before a repo exists: GDD, macro design, tech plan, art bible. Moved into the project repo by scaffold-wave. |

The concept and pre-production stages run **docs-only** — the UE project does not exist until
`preproduction-exit-wave` passes and triggers `scaffold-wave`, which creates the repo at
`repo_path` and moves `docs/` into it.
