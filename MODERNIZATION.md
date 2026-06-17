# Gamebook — Modernization Notes

> Port of [godbook](../godbook/) for UE5 game development. June 2026.

The gamebook keeps godbook's orchestration shape, file-based agent handoffs, hook plumbing, `/fix` + `/ship` sizing model, and brain-link memory pattern. The agents, rules, skills, and guides are rewritten end-to-end for Unreal Engine 5.4+ with C++ + Blueprints, GAS, Enhanced Input, Wwise, Niagara, UMG + Common UI, and Git LFS.

---

## What is the same as godbook

- **Two slash commands**: `/fix` (single-surface) and `/ship` (multi-agent feature). See [templates/commands/fix.md](templates/commands/fix.md), [templates/commands/ship.md](templates/commands/ship.md).
- **Four lifecycle hooks**: `pre-commit.sh`, `gate.sh`, `post-commit-audit.sh`, `session-end.sh`. See [hooks/README.md](hooks/README.md).
- **File-based handoffs** at `.claude/handoffs/<agent>.json`, cleared by the orchestrator at the start of every `/ship` run. Schema in [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md).
- **`make gate`** as the single deterministic check both locally and in CI. See [hooks/gate.sh](hooks/gate.sh).
- **`project.config.json`** as the canonical record of every per-project choice. `/ship` and `/fix` refuse to run without it.
- **INDEX-first agent protocol** — every agent reads `.claude/INDEX.json` before any Glob/Grep. See [scripts/gen-index.sh](scripts/gen-index.sh).
- **Slim agents** (~100 lines) pointing at shared context in `agents/_shared/` (BRIEF, HANDOFF, STACK, PATTERNS, SECURITY_CHECKLIST).
- **Skills with progressive disclosure** — always-loaded `SKILL.md` + on-demand `resources/`. See [skills/](skills/).
- **Auto-loaded `rules/`** copied per project (version-pinned). See [rules/README.md](rules/README.md).
- **Brain link memory pattern** — [scripts/brain-link.sh](scripts/brain-link.sh) wires `brain/` into the project's Claude memory dir, same as godbook.
- **`gen-claude-md.sh`** — slim per-project `CLAUDE.md` injected from `project.config.json`. See [scripts/gen-claude-md.sh](scripts/gen-claude-md.sh) and [templates/CLAUDE.md](templates/CLAUDE.md).
- **`setup-claude.sh`** — installs global permissions + slash command symlinks. See [scripts/setup-claude.sh](scripts/setup-claude.sh).

---

## What is different from godbook

### Agents (8, not 7)

| Godbook agent | Gamebook agent | Notes |
|---|---|---|
| `project-scaffolder` | [`project-scaffolder`](agents/project-scaffolder.md) | Same role; UE5 interview groups |
| `backend-integrator` | [`gameplay-systems-engineer`](agents/gameplay-systems-engineer.md) | C++ subsystems + GAS instead of HTTP handlers + sqlc |
| `feature-developer` | [`blueprint-feature-builder`](agents/blueprint-feature-builder.md) | BP/UMG/content instead of React routes |
| `test-architect` | [`playtest-architect`](agents/playtest-architect.md) | Functional Tests + Gauntlet + manual scripts instead of Vitest + Playwright |
| `code-reviewer` | [`code-reviewer`](agents/code-reviewer.md) | Same role; **security checks folded in** (no separate security-auditor) |
| `security-auditor` | — | Removed as standalone; checks folded into `code-reviewer` per [agents/_shared/SECURITY_CHECKLIST.md](agents/_shared/SECURITY_CHECKLIST.md) |
| `devops-automator` | [`build-release-engineer`](agents/build-release-engineer.md) | Cook/package/Steam/EOS instead of Terraform/Docker |
| — | [`level-encounter-designer`](agents/level-encounter-designer.md) | NEW — blockouts, streaming sublevels, NavMesh, AI placement |
| — | [`narrative-content-author`](agents/narrative-content-author.md) | NEW — dialogue trees, audio logs, Wwise VO hookup (optional in `/ship`) |

### Handoff schema

| Godbook | Gamebook |
|---|---|
| `endpoints[]` in `backend.json` (HTTP methods, paths, request/response shapes) | `systems_surface[]` in `systems.json` (type: ability/attribute/effect/subsystem/component, header path, BP consumers, gameplay tags, replication mode) |
| `backend.json` gates `feature-developer` | `systems.json` gates `blueprint-feature-builder` |

Same gating mechanism (`jq '.status == "ready"'`, repair-once-if-blocked); different payload shape. Full schema in [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md).

### Rules (UE5-specific)

Godbook's `rules/go-backend.md`, `rules/react-frontend.md`, `rules/electron-desktop.md`, etc. are replaced with UE5 rules:

- [rules/ue5-cpp.md](rules/ue5-cpp.md), [rules/ue5-blueprints.md](rules/ue5-blueprints.md), [rules/ue5-gas.md](rules/ue5-gas.md), [rules/ue5-replication.md](rules/ue5-replication.md), [rules/ue5-naming.md](rules/ue5-naming.md), [rules/ue5-perf.md](rules/ue5-perf.md), [rules/ue5-input.md](rules/ue5-input.md), [rules/ue5-niagara.md](rules/ue5-niagara.md), [rules/wwise.md](rules/wwise.md), [rules/git-lfs.md](rules/git-lfs.md), [rules/ue5-microtransactions.md](rules/ue5-microtransactions.md)

[rules/standards.md](rules/standards.md) is the universal rules file (mirrors godbook's `standards.md` but rewritten for UE5).

### Monetization (Steam/EOS/console, not Stripe)

Godbook's `guides/stripe-payments.md` is replaced by [guides/microtransactions.md](guides/microtransactions.md), [rules/ue5-microtransactions.md](rules/ue5-microtransactions.md), and the [skills/microtransaction-store](skills/microtransaction-store/SKILL.md) recipe. End-to-end Steam MicroTxn flow (InitTxn/FinalizeTxn webhook), EOS Ecom QueryOwnership, console store stubs. Cosmetics-first, never pay-to-win, server-side receipt validation.

### Asset versioning (Git LFS, not plain Git)

Locked decision. [rules/git-lfs.md](rules/git-lfs.md) ships the canonical `.gitattributes` covering every UE binary format (`.uasset`, `.umap`, `.wav`, `.wem`, `.psd`, `.fbx`, `.dll`, `.pak`, etc.). [hooks/pre-commit.sh](hooks/pre-commit.sh) blocks `Saved/`, `Intermediate/`, `DerivedDataCache/`, `Binaries/` and verifies binaries have LFS pointers. No Perforce, no Plastic.

### Gate steps

| Godbook `make gate` | Gamebook `make gate` |
|---|---|
| lint → typecheck → test → sec → build → index | lint (clang-format) → automation-critical (Functional Tests `@critical`) → UBT build → cook-slim → index |

Both use the same `STEP=<name>` slice mechanism. See [hooks/gate.sh](hooks/gate.sh).

### Validation scripts

| Godbook | Gamebook |
|---|---|
| `scripts/smoke.sh` (curl new endpoints) | [scripts/cook-smoke.sh](scripts/cook-smoke.sh) (cook one map headlessly) |
| `make e2e-critical` (Playwright `@critical`) | [scripts/automation-test.sh](scripts/automation-test.sh) (Functional Tests `@critical` via `UnrealEditor-Cmd -Unattended -NullRHI`) + [scripts/gauntlet-critical.sh](scripts/gauntlet-critical.sh) (Gauntlet scripted scenarios) |

---

## Where godbook concepts moved

| Godbook concept / file | Gamebook equivalent |
|---|---|
| `guides/backend.md` (Go + Gin + sqlc) | [guides/gameplay-systems.md](guides/gameplay-systems.md) (C++ subsystems + GAS + Actor Components) |
| `guides/frontend.md` (React + Vite + RR7) | [guides/ui-umg-commonui.md](guides/ui-umg-commonui.md) (UMG + Common UI + MVVM/ViewModel) |
| `guides/auth.md` (Custom JWT) | [guides/save-load.md](guides/save-load.md) (USaveGame + encryption — closest analog: "session state that persists between runs") |
| `guides/stripe-payments.md` | [guides/microtransactions.md](guides/microtransactions.md) (Steam MicroTxn + EOS Ecom + console store) |
| `guides/infrastructure.md` (Terraform/Terragrunt) | [guides/packaging-cooking.md](guides/packaging-cooking.md) (UAT cook/package/Makefile) |
| `guides/deployment.md` (CI/CD) | [guides/steam-deploy.md](guides/steam-deploy.md) (SteamCMD, app_build.vdf, branch promotion) |
| `guides/electron.md` | [guides/asset-pipeline.md](guides/asset-pipeline.md) (Quixel Bridge + Marketplace + LFS + texture compression) |
| `guides/env-template.md` | [guides/project-settings.md](guides/project-settings.md) (`.uproject` + `Config/Default*.ini`) |
| `guides/project-structure.md` | [guides/ue5-project-structure.md](guides/ue5-project-structure.md) (Source/Content/Config/Plugins/deploy/steam) |
| — | NEW: [guides/gas-overview.md](guides/gas-overview.md) (no godbook equivalent) |
| — | NEW: [guides/replication-overview.md](guides/replication-overview.md) (no godbook equivalent) |
| `quality/code-quality.md` | [quality/cpp-blueprint-quality.md](quality/cpp-blueprint-quality.md) (folds in security-scanning + security-testing) |
| `quality/testing-guidelines.md` | [quality/playtest-and-automation.md](quality/playtest-and-automation.md) (three layers: Functional Tests, Gauntlet, manual checklists) |
| `quality/security-scanning.md` + `quality/security-testing.md` | Folded into [quality/cpp-blueprint-quality.md](quality/cpp-blueprint-quality.md) Security Hygiene section |
| `quality/incident-response.md` | [quality/crash-and-bug-response.md](quality/crash-and-bug-response.md) (P0–P3 severity, callstack reading, hotfix branch process) |
| — | NEW: [quality/performance-budgets.md](quality/performance-budgets.md) (60 FPS / 16.6ms hard budgets) |
| `interviews/business-interview.md` | [skills/concept-interview](skills/concept-interview/SKILL.md) (genre, pillars, slice scope) + [skills/monetization-interview](skills/monetization-interview/SKILL.md) |
| `interviews/brand-interview.md` | [skills/art-direction-interview](skills/art-direction-interview/SKILL.md) |
| `interviews/market-validation.md` | [interviews/reference-game-analysis.md](interviews/reference-game-analysis.md) (reference-game-driven validation instead of PMF metrics) |
| `interviews/infrastructure-interview.md` | [skills/target-platform-interview](skills/target-platform-interview/SKILL.md) (platforms, min spec, Steam Deck checklist) |
| `interviews/figma-integration.md` | [interviews/figma-integration.md](interviews/figma-integration.md) (kept; UMG-specific examples) |
| `recipes/settings-page.md` etc. | [skills/](skills/) — 13 invokable recipes (gas-ability, weapon-class, enemy-ai-behavior-tree, hud-widget, dialogue-tree, save-system, main-menu, pause-menu, input-binding, level-streaming, interaction-system, pickup-system, microtransaction-store) |
| `templates/docs/SCHEMA.md`, `BUSINESS_RULES.md`, `API_CONTRACTS.md` | [templates/docs/GAMEPLAY_SYSTEMS.md](templates/docs/GAMEPLAY_SYSTEMS.md) (GAS surface), [templates/docs/INPUT_MAP.md](templates/docs/INPUT_MAP.md), [templates/docs/STORE_DESIGN.md](templates/docs/STORE_DESIGN.md), [templates/docs/NARRATIVE.md](templates/docs/NARRATIVE.md), [templates/docs/LEVEL_DESIGN.md](templates/docs/LEVEL_DESIGN.md), [templates/docs/PERFORMANCE_BUDGETS.md](templates/docs/PERFORMANCE_BUDGETS.md), [templates/docs/BUILD_PIPELINE.md](templates/docs/BUILD_PIPELINE.md), [templates/docs/PLAYTEST.md](templates/docs/PLAYTEST.md), [templates/docs/AUDIO.md](templates/docs/AUDIO.md), [templates/docs/ART_DIRECTION.md](templates/docs/ART_DIRECTION.md) |

---

## What's new with no godbook equivalent

- **Locked-vs-asked split.** Godbook asks everything in the interview. Gamebook locks UE5-specific decisions (GAS, Enhanced Input, UMG+CommonUI, Git LFS, Niagara, subsystems pattern, data-driven design, cosmetics-first monetization, GTX 1060 perf baseline, Nanite/Lumen off) at the playbook level and only asks per-project choices (engine version, audio middleware, networking stance, monetization specifics, platforms, perf baseline override). See [CLAUDE.md](CLAUDE.md).
- **`systems_surface[]` typed entries** — five enum values (ability/attribute/effect/subsystem/component) constrain what the systems agent can hand off, and the content agent's reader knows exactly how to map each one to BP/UMG consumers.
- **Reference-game analysis** ([interviews/reference-game-analysis.md](interviews/reference-game-analysis.md)) — game-dev-specific interview with no web-app analog: extract mechanic targets from existing games, map each candidate to GAS objects, define anti-pattern guard rails with Functional Test gates.
- **Performance budgets as a first-class document** ([quality/performance-budgets.md](quality/performance-budgets.md), [templates/docs/PERFORMANCE_BUDGETS.md](templates/docs/PERFORMANCE_BUDGETS.md)) — godbook doesn't ship hard frame-time / draw-call / triangle budgets.
- **Crash report client integration** ([quality/crash-and-bug-response.md](quality/crash-and-bug-response.md)) — callstack reading guide, ensure-vs-check semantics, common UE5/GAS crash patterns with root causes.
- **Cook-smoke and automation-critical scripts** ([scripts/cook-smoke.sh](scripts/cook-smoke.sh), [scripts/automation-test.sh](scripts/automation-test.sh), [scripts/gauntlet-critical.sh](scripts/gauntlet-critical.sh)) — headless UE5 validation with `-Unattended -NullRHI`, structured JSON results, timeouts (300s automation, 600s cook/gauntlet).

---

## Migration notes for godbook users

If you already know godbook:

- Read [CLAUDE.md](CLAUDE.md) and [PLAYBOOK.md](PLAYBOOK.md) — the orchestration shape is identical, only the surface changes.
- Read [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md) for the `systems_surface[]` schema. That's the one boundary that differs structurally.
- Skim [rules/standards.md](rules/standards.md) and at least one rule file per surface you'll touch ([rules/ue5-cpp.md](rules/ue5-cpp.md), [rules/ue5-gas.md](rules/ue5-gas.md), [rules/ue5-blueprints.md](rules/ue5-blueprints.md) cover ~80% of feature work).
- Locked decisions in [CLAUDE.md](CLAUDE.md) are non-negotiable across all gamebook projects — they're not interview questions. If a project legitimately needs to diverge (no GAS, Perforce instead of Git LFS), it shouldn't be using the gamebook.
