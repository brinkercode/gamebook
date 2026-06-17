# Gamebook — Claude Code Context

> Opinionated UE5 game-dev playbook for shipping vertical slices with Claude Code. Unreal Engine 5.4+, C++ + Blueprints, GAS, Enhanced Input, Wwise (MetaSounds fallback), Niagara, UMG + Common UI, Git LFS. Single-player default; dedicated-server multiplayer opt-in. Locked decisions are uniform across all projects; per-project framework choices are captured by the scaffolder interview.

This repository IS the playbook. **Start at [PLAYBOOK.md](PLAYBOOK.md)** for the orchestration overview, sizing rubric, and conventions.

This `CLAUDE.md` is context for editing the gamebook itself. For the per-project CLAUDE.md that gets injected into client UE5 projects, see [templates/CLAUDE.md](templates/CLAUDE.md) and the generator at [scripts/gen-claude-md.sh](scripts/gen-claude-md.sh).

---

## Three commands

| Command | When | Defined at |
|---|---|---|
| inline edit | Trivial (comment, .ini tweak, asset re-import, rename) | — |
| `/fix <change>` | Small (single C++ class OR single BP OR single widget OR single Data Asset) | [templates/commands/fix.md](templates/commands/fix.md) |
| `/ship <feature>` | Full feature (systems + content + UI + tests, multi-agent) | [templates/commands/ship.md](templates/commands/ship.md) |

`scripts/setup-claude.sh` symlinks both into `~/.claude/commands/` so they work in every UE5 project on this machine.

## How `/ship` flows

1. **Phase 0** — orchestrator: clear `.claude/handoffs/*`, refresh INDEX, optionally start headless editor daemons.
2. **Phase 1 (parallel)** — `gameplay-systems-engineer` + `playtest-architect` → write `.claude/handoffs/{systems,playtest}.json`.
3. **Gate** — orchestrator: `jq '.status == "ready"'` on `systems.json`; repair once if blocked.
4. **Phase 2 (parallel)** — `blueprint-feature-builder` (reads `systems.json`) + `code-reviewer` + `level-encounter-designer`. The optional `narrative-content-author` slots in here when the feature has dialogue/audio-log scope.
5. **Phase 3 (serial)** — `make cook-smoke` → `make automation-critical` → `make gate`.
6. **Phase 4 (conditional)** — `build-release-engineer` if `.uproject`, `Config/`, or `Plugins/` changed.
7. **Stop** at "ready to commit" with one structured summary.

The systems→content handoff is **real and file-based**. `blueprint-feature-builder` cannot proceed until `.claude/handoffs/systems.json` exists with `status: "ready"`. The handoff carries a `systems_surface[]` array (one entry per ability/attribute/effect/subsystem/component) with header path, gameplay tags, BP consumers, and replication mode. Schema in [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md).

There is **no separate security-auditor agent** — security checks are folded into `code-reviewer` against [agents/_shared/SECURITY_CHECKLIST.md](agents/_shared/SECURITY_CHECKLIST.md) (save integrity, microtransaction server-validation, RPC trust, asset/build hygiene).

---

## Locked decisions (apply uniformly across every gamebook project)

Not asked by the scaffolder. Edit these here if the entire playbook needs to shift.

- **Engine**: Unreal Engine 5.4+, C++ + Blueprints
- **Abilities**: Gameplay Ability System (GAS) — `UGameplayAbility`, `UGameplayEffect`, `UAttributeSet`, `FGameplayTag`
- **Input**: Enhanced Input plugin (`IA_*`, `IMC_*`, Modifiers, Triggers)
- **VFX**: Niagara
- **UI**: UMG + Common UI plugin
- **Asset versioning**: Git + Git LFS only (no Perforce, no Plastic)
- **Save/Load**: `USaveGame` subclasses, async serialization, encrypted slot files
- **Subsystems pattern** preferred over singletons / global state
- **Data-driven design** via Primary Data Assets + Data Tables
- **Performance baseline**: 60 FPS on GTX 1060 / PS5-equivalent for vertical slice. Nanite/Lumen OFF by default (traditional LODs + baked lighting)
- **Asset strategy**: Quixel Megascans + Marketplace first; in-house art minimal
- **Monetization philosophy**: cosmetics-first; never pay-to-win

Full reference: [agents/_shared/STACK.md](agents/_shared/STACK.md).

## Per-project choices (asked by the scaffolder)

| Layer | Options (default first) |
|---|---|
| Engine version | **UE5.4** · UE5.5 · UE5.6+ |
| Audio middleware | **Wwise** · MetaSounds only |
| Networking | **Single-player** · Dedicated server (Replication Graph) · Listen server |
| Monetization | none · **Steam MicroTxn** · EOS Ecom · console store · combination |
| Platforms | Windows · Steam Deck · PS5 · Xbox Series · Switch 2 |
| Perf baseline | **GTX 1060 / PS5-equivalent 60 FPS** · raised baseline |
| Art direction | per-project — captured via [skills/art-direction-interview](skills/art-direction-interview/SKILL.md) |
| Narrative scope | per-project — captured via [skills/narrative-interview](skills/narrative-interview/SKILL.md) |
| Reference games | per-project — captured via [interviews/reference-game-analysis.md](interviews/reference-game-analysis.md) |

Every answer is persisted in `project.config.json`. Agents read it on every invocation and apply the matching rule files. **`/ship` and `/fix` refuse to run if `project.config.json` is missing.**

---

## Updating gamebook rules

`rules/*.md` are auto-loaded standards copied into every client project's `.claude/rules/` by `gamebook-init.sh`. Edit in place — there's no rebuild step. Changes apply on the next session for new projects. Existing projects keep the version they were scaffolded with (version-pinning is intentional). Re-run `gamebook-init.sh` inside an existing project to refresh rules in place (idempotent, never overwrites code).

---

## Repo layout

| Area | Files |
|---|---|
| Orchestration | [PLAYBOOK.md](PLAYBOOK.md), [templates/commands/](templates/commands/), [agents/_shared/BRIEF.md](agents/_shared/BRIEF.md), [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md) |
| Bootstrap | [scripts/gamebook-init.sh](scripts/gamebook-init.sh), [scripts/setup-claude.sh](scripts/setup-claude.sh), [scripts/gen-index.sh](scripts/gen-index.sh), [scripts/gen-claude-md.sh](scripts/gen-claude-md.sh), [scripts/new-agent.sh](scripts/new-agent.sh), [scripts/new-skill.sh](scripts/new-skill.sh), [scripts/brain-link.sh](scripts/brain-link.sh) |
| CI helpers | [scripts/cook-smoke.sh](scripts/cook-smoke.sh), [scripts/automation-test.sh](scripts/automation-test.sh), [scripts/gauntlet-critical.sh](scripts/gauntlet-critical.sh) |
| Hooks | [hooks/README.md](hooks/README.md), [hooks/pre-commit.sh](hooks/pre-commit.sh), [hooks/gate.sh](hooks/gate.sh), [hooks/post-commit-audit.sh](hooks/post-commit-audit.sh), [hooks/session-end.sh](hooks/session-end.sh) |
| Agents | [agents/README.md](agents/README.md) — 8 agents + shared `BRIEF.md`, `HANDOFF.md`, `STACK.md`, `PATTERNS.md`, `SECURITY_CHECKLIST.md` |
| Auto-loaded rules | [rules/README.md](rules/README.md) — standards, ue5-cpp, ue5-blueprints, ue5-gas, ue5-replication, ue5-naming, ue5-perf, ue5-input, ue5-niagara, wwise, git-lfs, ue5-microtransactions |
| Skills (invokable) | [skills/](skills/) — 6 interviews + 13 recipes. Symlinked into each project's `.claude/skills/`. Add with `scripts/new-skill.sh`. |
| Stack guides | [guides/](guides/) — gameplay-systems, ui-umg-commonui, save-load, gas-overview, replication-overview, asset-pipeline, packaging-cooking, steam-deploy, microtransactions, project-settings, ue5-project-structure |
| Interviews (misc) | [interviews/figma-integration.md](interviews/figma-integration.md), [interviews/reference-game-analysis.md](interviews/reference-game-analysis.md) — the rest live as Skills |
| Quality | [quality/cpp-blueprint-quality.md](quality/cpp-blueprint-quality.md), [quality/playtest-and-automation.md](quality/playtest-and-automation.md), [quality/performance-budgets.md](quality/performance-budgets.md), [quality/crash-and-bug-response.md](quality/crash-and-bug-response.md) |
| Per-project templates | [templates/CLAUDE.md](templates/CLAUDE.md), [templates/Makefile](templates/Makefile), [templates/AGENT.md](templates/AGENT.md), [templates/SKILL.md](templates/SKILL.md), [templates/docs/](templates/docs/) |

---

## The 8 agents

Use these exact names everywhere. See [agents/README.md](agents/README.md) for the full roster and routing.

1. **`project-scaffolder`** — interview-driven setup, writes `project.config.json`, runs `gamebook-init.sh`.
2. **`gameplay-systems-engineer`** — C++ subsystems, GAS abilities/effects/attribute sets, replication. Writes `systems.json` with mandatory `systems_surface[]`.
3. **`blueprint-feature-builder`** — Blueprint logic, UMG/Common UI widgets, content wiring. **Blocked on `systems.json`** when invoked by `/ship`.
4. **`level-encounter-designer`** — blockout, encounter scripting, level streaming, AI placement.
5. **`narrative-content-author`** — dialogue trees, audio logs, story beats, Wwise event hookup.
6. **`playtest-architect`** — Functional/Gauntlet automation specs + manual playtest scripts. Runs Phase 1 parallel writing failing tests against the surface systems will deliver.
7. **`code-reviewer`** — C++/BP review, GAS pattern audit, save/asset/perf hygiene, security checklist (no separate security-auditor agent).
8. **`build-release-engineer`** — cook, package, CI, Steam upload, EOS Ecom wiring. Phase 4 conditional.

---

## Core principles

- **Interview first** — `project-scaffolder` drives `AskUserQuestion` for engine + audio + networking + monetization + platforms + perf; prose-driven skill interviews for concept, art direction, narrative, audio direction, monetization detail, target platforms, and reference games.
- **Locked decisions never re-asked** — GAS, Enhanced Input, UMG+CommonUI, Git LFS, Niagara, subsystems-over-singletons, data-driven design, cosmetics-first monetization.
- **Living documentation** — `docs/` grows with the project; post-commit hook reports drift.
- **File-based handoffs** — `.claude/handoffs/<agent>.json` is the real, deterministic agent-to-agent channel. `systems.json` uses `systems_surface[]` (not `endpoints[]` like godbook).
- **Systems in C++, content in Blueprint** — handlers (BPs) stay thin; combat math, replicated state, attribute clamping live in C++.
- **GAS for every ability** — never hand-roll cooldowns, costs, or status effects.
- **Reference assets first** — Quixel Bridge + Marketplace; in-house art is the exception.
- **Sized commands** — `/fix` for single-surface, `/ship` for multi-surface features, inline for trivial.

---

## How the gamebook differs from godbook

| | Godbook | Gamebook |
|---|---|---|
| Agent count | 7 | 8 (added `level-encounter-designer`, `narrative-content-author`, `build-release-engineer`; dropped standalone `security-auditor` — folded into `code-reviewer`; dropped `backend-integrator`/`feature-developer`/`devops-automator`/`test-architect` in favor of `gameplay-systems-engineer`/`blueprint-feature-builder`/`build-release-engineer`/`playtest-architect`) |
| Phase 1 → Phase 2 handoff | `endpoints[]` in `backend.json` | `systems_surface[]` in `systems.json` |
| Security | standalone agent | checklist folded into `code-reviewer` |
| Microtransactions | Stripe | Steam MicroTxn / EOS Ecom / console store |
| Versioning | git plain | git + Git LFS (locked, full `.gitattributes` in [rules/git-lfs.md](rules/git-lfs.md)) |
| Gate steps | lint/typecheck/test/sec/build/index | lint/automation-critical/build/cook-slim/index |

Detail: [MODERNIZATION.md](MODERNIZATION.md).
