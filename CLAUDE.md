# Gamebook — Claude Code Context

> A virtual game studio harness: 35 department/role agents + 39 deterministic waves that create
> NEW UE5 projects and run them through every lifecycle stage (concept → live). UE 5.7+, C++ +
> Blueprints, GAS, Enhanced Input, Wwise (MetaSounds fallback), Niagara, UMG + Common UI, Git LFS.
> This repo is NOT injected into existing projects — it births and operates its own.

This repository IS the studio. **Start at [PLAYBOOK.md](PLAYBOOK.md)** for the layer model,
lifecycle gates, and non-negotiables. This `CLAUDE.md` is context for editing the gamebook itself.

---

## Architecture in one glance

```
L1  Fable (this session)      routes → launches waves → reads verdicts → sequences campaigns
L2  .claude/workflows/*.js    39 waves; non-trusting gates; stage guards; never run git
L3  agents/*.md               35 agents; tiers via models.json (greenlight/judge/author/verifier/parser)
L4  references/<project>/     config.json: profile · stage · staffing · stage_history
```

- **Stage** gates everything: waves declare `STAGES` and self-skip out of stage; transitions only
  through greenlight/gate waves; `kill` and `redesign` are honored outcomes.
- **Staffing** (`solo|indie|studio`) collapses roles via `references/PROFILES.json` merges.
- **Non-trusting gates**: author self-reports are recorded but ignored; `qa-gate-verifier`
  re-runs; panels judge criteria locked before the build; the three fate gates (concept-greenlight,
  slice-greenlight, rc) route to the `greenlight` tier (Fable).
- **Binary assets** are never hand-authored — editor-Python generator scripts
  (`skills/ue5-editor-python`) are the reviewable artifact.

## Editing rules for this repo

- **New wave**: `scripts/new-workflow.sh <name>` → fill body → register in
  `.claude/workflows/README.md` → add `templates/commands/<name>.md` shim →
  `bash scripts/harness-check.sh` must pass. Follow the checklist in
  [templates/WORKFLOW.md](templates/WORKFLOW.md). `feature-wave.js` is the house-style exemplar.
- **New agent**: `scripts/new-agent.sh <name> [model]` → add the role to `models.json` → add merge
  entries in `references/PROFILES.json` if it collapses at small scale → row in `agents/README.md`.
- **Every `agent()` call in a wave passes `model: M['<role>']`** — omitting it silently inherits
  Fable pricing. `scripts/check-wave-mirrors.mjs` fails CI on any mirror drift.
- **Gate-set roles never get Write/Edit tools**: resolve-project, qa-gate-verifier,
  qa-playtest-analyst, qa-compliance, qa-crash-correlator.
- Schemas live in `agents/_shared/schemas/` (canonical) and are mirrored compactly inside waves —
  edit both or the mirror check bites.
- `rules/`, `guides/`, `quality/`, `skills/` are the knowledge layer; edit in place, no build step.

## The wave catalog (by stage)

concept: `pitch` `prototype` `concept-greenlight` · preprod: `gdd` `macro-design` `tech-plan`
`art-bible` `preproduction-exit` `scaffold` · slice: `slice-criteria` `slice` `slice-greenlight` ·
production: `feature` `fix` `level` `narrative` `audio-pass` `playtest` `milestone` `review`
`bug-hunt` `perf-budget` `asset-audit` `test-backfill` · alpha/beta: `alpha-gate` `content-lock`
`loc` `bug-bash` `beta-gate` · gold: `rc` `cert-preflight` `release` · live: `update` `hotfix`
`season` `postmortem` · any: `docs-currency` `refactor` `engine-upgrade`

Full table + conventions: [.claude/workflows/README.md](.claude/workflows/README.md).

## Locked decisions (uniform across every project the studio runs)

GAS for every ability · Enhanced Input only · UMG + Common UI · Niagara (no Cascade) · Git LFS ·
USaveGame encrypted saves · subsystems over singletons · data-driven via Data Assets/Tables ·
60 FPS on GTX 1060/PS5-equivalent, Nanite/Lumen OFF · Megascans/marketplace-first art ·
cosmetics-first monetization, never pay-to-win. Reference: [agents/_shared/STACK.md](agents/_shared/STACK.md).

Per-project choices (audio middleware, networking, monetization, platforms, staffing, perf
baseline) are captured once by `/pitch` + the scaffolder interview into
`references/<project>/config.json` and read by `resolve-project` on every wave.

## Harness CI

`bash scripts/harness-check.sh` — mirror/capability drift, wave parse, schema/config JSON
validity, shim coverage. Run it before committing any harness change.
