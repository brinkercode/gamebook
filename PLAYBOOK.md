# Gamebook — Playbook

> Opinionated UE5 game-dev playbook for shipping vertical slices with Claude Code. Unreal Engine 5.7+, C++ + Blueprints, GAS, Enhanced Input, Wwise (MetaSounds fallback), Niagara, UMG + Common UI, Git LFS. Single source of truth for orchestration, commands, and conventions.

---

## TL;DR

```
gamebook-init.sh ─► UE5 project skeleton (Source/, Content/, Config/, Plugins/)
                  + .claude/INDEX.json + hooks + agents + skills + rules
                  + .gitattributes (LFS) + Makefile + docs/ stubs
                  │
                  ▼  every session: read .claude/INDEX.json FIRST
        ┌────────────────────────┐
        │  Pick a command         │
        └──────────┬──────────────┘
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  /ship <feature>     full feature, systems→content, 8 agents  │
   │  /fix  <change>      single-surface change                    │
   │  inline              trivial: .ini tweak / comment / rename   │
   └──────────────────────────────────────────────────────────────┘
```

After scaffold, every change goes through one of these three paths.

---

## Sizing rubric (pick the command)

| Size | Examples | Command | Agents |
|---|---|---|---|
| **Trivial** | Comment, single .ini key, asset re-import, rename | Inline edit | 0 |
| **Small** | One BP rewire, one widget visual fix, one Data Asset tune, one C++ method bug | `/fix` | 1 (code-reviewer) |
| **Full feature** | New `UGameplayAbility` + `UAttributeSet` mod + `UGameplayEffect` cost/cooldown + WB_HUD binding + Functional Test; new weapon system + UI + automation; new enemy archetype + BT + spawn rules + perf budget | `/ship` | 5–7 of the 8 agents |

Escalation triggers from `/fix` to `/ship`: cross-surface edits (C++ AND BP AND widget), any change to a GAS attribute schema, any new RPC, any new Wwise event/bank, any `.uproject`/`Config/`/`Plugins/` change.

---

## Non-Negotiables

1. **Interview first** — `project-scaffolder` runs `AskUserQuestion` for engine/audio/networking/monetization/platforms/perf; prose skill interviews for concept, art, narrative, audio, monetization detail, target platforms, reference games. Writes `project.config.json`. `/ship` and `/fix` refuse to run without it.
2. **Design source of truth** — Reference games via [interviews/reference-game-analysis.md](interviews/reference-game-analysis.md); Figma frames via [interviews/figma-integration.md](interviews/figma-integration.md) when UI mocks exist; art direction via [skills/art-direction-interview](skills/art-direction-interview/SKILL.md).
3. **Read `.claude/INDEX.json` before exploring** — Every agent's first action. Refresh with `make index` (calls [scripts/gen-index.sh](scripts/gen-index.sh)).
4. **`make gate` is the deterministic check** — lint (clang-format) → `automation-critical` (Functional Tests tagged `@critical`) → UBT build → cook-slim → index. CI mirrors the same script. No agent hands off without `gate_result: "pass"`.
5. **Git LFS for every binary** — `.uasset`, `.umap`, `.wav`, `.wem`, `.psd`, `.fbx`, `.dll`, `.pak`, etc. Full list in [rules/git-lfs.md](rules/git-lfs.md). Pre-commit hook blocks `Saved/`, `Intermediate/`, `DerivedDataCache/`, `Binaries/`.
6. **Business logic in subsystems / components** — `Actor` Blueprints stay thin. Combat math, replicated state, cooldown/cost effects, attribute clamping live in C++ ([rules/ue5-cpp.md](rules/ue5-cpp.md), [rules/ue5-blueprints.md](rules/ue5-blueprints.md)).
7. **GAS for every ability** — never hand-roll cooldowns, costs, status effects. See [rules/ue5-gas.md](rules/ue5-gas.md), [guides/gas-overview.md](guides/gas-overview.md).
8. **Enhanced Input only** — no legacy `InputComponent::BindAction(FName)`. See [rules/ue5-input.md](rules/ue5-input.md).
9. **Subsystems over singletons** — `UGameInstanceSubsystem` / `UWorldSubsystem` / `ULocalPlayerSubsystem`. Never `static` mutable state.
10. **Cosmetics-first monetization** — never pay-to-win. Server-validated receipts (Steam MicroTxn / EOS Ecom / console store). See [rules/ue5-microtransactions.md](rules/ue5-microtransactions.md), [guides/microtransactions.md](guides/microtransactions.md).
11. **`/ship` is the multi-agent entry point** for features; `/fix` is the single-surface entry point. See [templates/commands/ship.md](templates/commands/ship.md) and [templates/commands/fix.md](templates/commands/fix.md) (symlinked to `~/.claude/commands/` by `scripts/setup-claude.sh`).

---

## How `/ship` works

`/ship <feature description>` is the **single-prompt full-feature pipeline** — game-dev variant. It runs everywhere on this machine and degrades gracefully in non-gamebook projects.

```
   /ship <feature>
        │
        ▼
   Phase 0 (orchestrator):
     • clear .claude/handoffs/*.json
     • make index
     • optional: launch headless editor daemons
        │
        ▼
   ╔════ Phase 1 — parallel (one message, 2 subagents) ════════╗
   ║  gameplay-systems-engineer ║  playtest-architect           ║
   ║  writes                    ║  writes failing Functional   ║
   ║  .claude/handoffs/         ║  Tests for the new surface   ║
   ║    systems.json            ║  → .claude/handoffs/         ║
   ║    (with systems_surface[])║    playtest.json             ║
   ╚════════════════════════════╤══════════════════════════════╝
                                │
                                ▼  orchestrator: jq '.status == "ready"' systems.json
                                ▼  fail → repair systems once, retry
                                ▼  ok    → continue
                                │
   ╔════ Phase 2 — parallel (one message, 3+ subagents) ═══════╗
   ║  blueprint-feature-builder ║  code-reviewer ║ level-      ║
   ║  reads systems.json,       ║  reviews C++ + ║ encounter-  ║
   ║  wires BP + UMG + Niagara  ║  tests + tags  ║ designer    ║
   ║  + Wwise events            ║  + security    ║ (if level   ║
   ║  → content.json            ║  → review.json ║  in scope)  ║
   ║  (narrative-content-author slots in here if dialogue/    ║
   ║   audio-log scope)                                        ║
   ╚════════════════════════════╤══════════════════════════════╝
                                │
                                ▼
   ┌── Phase 3 — validation (serial, fast) ──────────────────┐
   │  make cook-smoke         (cook one map headlessly)       │
   │  make automation-critical (Functional Tests @critical)   │
   │  make gate                (final integrated)             │
   └────────────────────────┬─────────────────────────────────┘
                            │
                            ▼  Phase 4 (conditional): build-release-engineer
                            ▼  if .uproject/Config/Plugins changed
                            ▼
                    One structured summary. STOP.
```

**Systems→Content coordination is real.** `gameplay-systems-engineer` writes `.claude/handoffs/systems.json` with `systems_surface[]`, `status: "ready"`, `gate_result: "pass"`. `blueprint-feature-builder` cannot start until that file exists with `status: "ready"` — it reads the JSON via `Read` before doing any work. If the file is missing or blocked, `blueprint-feature-builder` refuses to proceed.

### `systems_surface[]` schema (excerpt)

```jsonc
{
  "status": "ready",
  "gate_result": "pass",
  "systems_surface": [
    {
      "type": "ability",                       // ability|attribute|effect|subsystem|component
      "name": "UGA_Dash",
      "header_path": "Source/MyGame/Abilities/GA_Dash.h",
      "blueprint_consumers": ["BP_PlayerCharacter", "WB_HUD"],
      "gameplay_tags": ["Ability.Movement.Dash", "State.Invincible"],
      "replication": "server"                  // client|server|none
    },
    {
      "type": "effect",
      "name": "UGE_DashCooldown",
      "header_path": "Source/MyGame/Effects/GE_DashCooldown.h",
      "blueprint_consumers": ["BP_PlayerCharacter"],
      "gameplay_tags": ["Cooldown.Dash"],
      "replication": "server"
    }
  ]
}
```

Full schema: [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md).
Brief template: [agents/_shared/BRIEF.md](agents/_shared/BRIEF.md).

---

## How `/fix` works

For changes that fit on **one surface**: one C++ class OR one Blueprint OR one widget OR one Data Asset. No GAS attribute schema change. No new RPC. No new Wwise event/bank. No `.uproject`/`Config/`/`Plugins/` change.

```
   /fix <change>
        │
        ▼  Phase 1: you do the change directly (no subagent)
        ▼          make gate STEP=lint && STEP=test
        ▼
   ╔═══ Phase 2 — review (1 agent) ═════════════════════╗
   ║  code-reviewer                                     ║
   ║  (security checklist folded in — no separate agent)║
   ╚════════════════════╤═══════════════════════════════╝
                        ▼
                  make gate (full)
                        ▼
                  Structured summary. STOP.
```

**Escalation triggers** ([templates/commands/fix.md](templates/commands/fix.md)): cross-surface edits, GAS attribute schema change, new RPC, new replicated property, new Wwise event/bank, new gameplay tag taxonomy node, any `Plugins/` add. Hit any of those → stop, re-run as `/ship`.

---

## Daily workflow

```bash
/ship "<feature description>"     # or /fix for small changes
# review summary, optionally iterate
git commit -m "..."               # pre-commit + post-commit hooks fire
```

Between iterations: `make automation-critical` runs only the `@critical`-tagged Functional Tests; `make cook-smoke` cooks a slim variant to catch packaging regressions early.

---

## Creating a new project

### Step 1 — Interview

Run `project-scaffolder`. It drives `AskUserQuestion` for every per-project choice (engine version, audio middleware, networking stance, monetization, platforms, perf baseline), then runs the prose skill interviews (concept, art direction, narrative, audio direction, monetization detail, target platforms, reference games). Locked decisions (GAS, Enhanced Input, UMG+CommonUI, Git LFS, Niagara, subsystems, data-driven) are not asked.

Output: `project.config.json` capturing every decision.

See [agents/project-scaffolder.md](agents/project-scaffolder.md) for the full interview structure.

### Step 2 — Scaffold

```bash
mkdir my-game && cd my-game
bash ~/.claude/gamebook/scripts/gamebook-init.sh \
  --name "MyGame" --desc "One-line description" --engine 5.7
```

Result:
- `Source/MyGame/`, `Source/MyGameEditor/`, `Source/MyGameTests/` with `.Build.cs` / `.Target.cs`
- `Content/{Core,Characters,Weapons,Levels,UI,VFX,Audio,Data}/`
- `Config/Default{Engine,Game,Input,EditorPerProjectUserSettings,DeviceProfiles,CryptographySettings,GameplayTags}.ini`
- `Plugins/` (with Wwise scaffolding if Wwise selected)
- `MyGame.uproject` with locked plugin list
- `.gitattributes` (full UE LFS list from [rules/git-lfs.md](rules/git-lfs.md))
- `.gitignore` (`Saved/`, `Intermediate/`, `DerivedDataCache/`, `Binaries/`)
- `CLAUDE.md`, `Makefile`, `docs/` stubs
- `.claude/settings.json` + hooks symlinked back to gamebook
- `.claude/agents/` symlinked; `.claude/skills/` symlinked; `.claude/rules/` copied (version-pinned per project)
- `.claude/INDEX.json` (project manifest agents read FIRST)
- `deploy/steam/` scaffold if Steam selected

### Step 3 — Verify

```bash
git lfs install
ls .claude/agents     # 8 agent <name>.md files + _shared/ (BRIEF, HANDOFF, STACK, PATTERNS, SECURITY_CHECKLIST) + README
make build
make automation-critical
make gate
```

### Step 4 — Build features

Use `/ship <feature>` for full features, `/fix <change>` for single-surface. See guides as needed:

- [guides/gameplay-systems.md](guides/gameplay-systems.md) — C++ subsystems, components, character shell, Enhanced Input → GameplayTag binding
- [guides/ui-umg-commonui.md](guides/ui-umg-commonui.md) — UMG + Common UI, three-layer widget stack, MVVM/ViewModel pattern, input mode routing
- [guides/gas-overview.md](guides/gas-overview.md) — GAS conceptual model, the five core objects (ASC, Ability, Effect, AttributeSet, Tag), CombatAttributeSet pattern
- [guides/replication-overview.md](guides/replication-overview.md) — SP vs dedicated server, ASC migration to PlayerState, Replication Graph opt-in
- [guides/save-load.md](guides/save-load.md) — USaveGame subclasses, async-only save/load, schema versioning, AES-256 wrapper
- [guides/asset-pipeline.md](guides/asset-pipeline.md) — Quixel Bridge + Marketplace, LFS .gitattributes, naming, texture compression
- [guides/packaging-cooking.md](guides/packaging-cooking.md) — UAT cook/package, Makefile targets, shader compilation, automation tagging
- [guides/steam-deploy.md](guides/steam-deploy.md) — SteamCMD, app_build.vdf, branch promotion (CI → dev → beta → default)
- [guides/microtransactions.md](guides/microtransactions.md) — Steam MicroTxn InitTxn/FinalizeTxn flow, EOS Ecom QueryOwnership, server-side receipt validation
- [guides/project-settings.md](guides/project-settings.md) — canonical `.uproject` + `Config/Default*.ini`
- [guides/ue5-project-structure.md](guides/ue5-project-structure.md) — Source/Content/Config/Plugins layout, module dependency rules

---

## Skills (invokable)

Slim always-loaded `SKILL.md` files in [skills/](skills/), symlinked into each project's `.claude/skills/`. They fire on intent (or invoke by name). Each pushes depth into `resources/` (progressive disclosure). Add one with `scripts/new-skill.sh <name>`.

**Interviews** (write `docs/*.md`):
- [concept-interview](skills/concept-interview/SKILL.md) — genre subtype, player fantasy, design pillars, multiplayer stance, vertical slice scope
- [art-direction-interview](skills/art-direction-interview/SKILL.md) — visual style, palette, references, material tier, lighting strategy
- [narrative-interview](skills/narrative-interview/SKILL.md) — setting, protagonist, antagonist, act structure, content rating, audio log scope
- [audio-direction-interview](skills/audio-direction-interview/SKILL.md) — tone, music, SFX, ambience, Wwise vs MetaSounds choice, RTPC names
- [monetization-interview](skills/monetization-interview/SKILL.md) — cosmetics-only contract, currency, catalogue, cadence, FTC/COPPA/GDPR
- [target-platform-interview](skills/target-platform-interview/SKILL.md) — platforms, min spec, controller-first vs KBM, accessibility, Steam Deck checklist

**Recipes** (scaffold a feature against project conventions):
- [gas-ability](skills/gas-ability/SKILL.md) · [weapon-class](skills/weapon-class/SKILL.md) · [enemy-ai-behavior-tree](skills/enemy-ai-behavior-tree/SKILL.md) · [hud-widget](skills/hud-widget/SKILL.md) · [dialogue-tree](skills/dialogue-tree/SKILL.md) · [save-system](skills/save-system/SKILL.md) · [main-menu](skills/main-menu/SKILL.md) · [pause-menu](skills/pause-menu/SKILL.md) · [input-binding](skills/input-binding/SKILL.md) · [level-streaming](skills/level-streaming/SKILL.md) · [interaction-system](skills/interaction-system/SKILL.md) · [pickup-system](skills/pickup-system/SKILL.md) · [microtransaction-store](skills/microtransaction-store/SKILL.md)

---

## The 8 agents

Flat `agents/<name>.md` (natively discovered; each honors its `model:` routing). Each is ~100 lines and points at shared context in `agents/_shared/` (`BRIEF.md`, `HANDOFF.md`, `STACK.md`, `PATTERNS.md`, `SECURITY_CHECKLIST.md`). Add one with `scripts/new-agent.sh <name> [model]`.

| Agent | Scope | Phase in `/ship` |
|---|---|---|
| [`project-scaffolder`](agents/project-scaffolder.md) | UE5 framework interview, `project.config.json`, `gamebook-init.sh` | Pre-`/ship` (once) |
| [`gameplay-systems-engineer`](agents/gameplay-systems-engineer.md) | C++ subsystems, GAS abilities/effects/attribute sets, replication | 1 |
| [`playtest-architect`](agents/playtest-architect.md) | Functional Tests, Gauntlet matrix, manual playtest scripts, `@critical` suite | 1 |
| [`blueprint-feature-builder`](agents/blueprint-feature-builder.md) | BPs, UMG/CommonUI, Niagara/Wwise wiring, Data Assets | 2 (blocked on systems) |
| [`code-reviewer`](agents/code-reviewer.md) | C++/BP/GAS pattern audit, save/asset/perf hygiene, security checklist | 2 |
| [`level-encounter-designer`](agents/level-encounter-designer.md) | Blockouts, streaming sublevels, NavMesh, AI placement, baked lighting | 2 |
| [`narrative-content-author`](agents/narrative-content-author.md) | Dialogue Data Tables, audio log Primary Data Assets, Wwise VO hookup | 2 (when in scope) |
| [`build-release-engineer`](agents/build-release-engineer.md) | Cook, package, CI, Steam upload, EOS Ecom wiring, console SDKs | 4 (conditional) |

---

## Handoff convention (file-based, real)

Every subagent writes `.claude/handoffs/<agent>.json` and emits the same JSON as its final chat message. The orchestrator polls / `jq`s the file. Downstream agents read it via `Read` before starting work.

```
.claude/handoffs/
├── systems.json    # gameplay-systems-engineer   (Phase 1, gates Phase 2 content)
├── playtest.json   # playtest-architect          (Phase 1)
├── content.json    # blueprint-feature-builder   (Phase 2, blocked on systems.json)
├── review.json     # code-reviewer               (Phase 2)
├── level.json      # level-encounter-designer    (Phase 2, when in scope)
├── narrative.json  # narrative-content-author    (Phase 2, when in scope)
└── build.json      # build-release-engineer      (Phase 4, conditional)
```

The orchestrator clears `.claude/handoffs/*` at the start of every `/ship` run. Schema in [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md). The key difference from godbook: `systems.json` carries a `systems_surface[]` array (one entry per `UGameplayAbility` / `UAttributeSet` / `UGameplayEffect` / `USubsystem` / `UActorComponent`) instead of an `endpoints[]` array.

---

## Lifecycle hooks (deterministic plumbing)

| Hook | Fires on | Purpose |
|---|---|---|
| [`hooks/pre-commit.sh`](hooks/pre-commit.sh) | `git commit` | Block bad commits: LFS enforcement, `Saved/`/`Intermediate/` block, UE5 naming check, `.uproject`↔`DefaultEngine.ini` version check, clang-format |
| [`hooks/post-commit-audit.sh`](hooks/post-commit-audit.sh) | Bash PostToolUse after commit | Warn on `Content/` without Data Assets, `Source/` without tests, `Config/` changes without docs |
| [`hooks/gate.sh`](hooks/gate.sh) | `make gate` and CI | Full deterministic check: lint → automation-critical → UBT build → cook-slim → index |
| [`hooks/session-end.sh`](hooks/session-end.sh) | Claude Code `Stop` event | Refresh INDEX, sync brain links, safe-clean `DerivedDataCache/Intermediate`, log activity |

See [hooks/README.md](hooks/README.md) for setup and customization markers.

---

## Quality gates

| Doc | Purpose |
|---|---|
| [quality/cpp-blueprint-quality.md](quality/cpp-blueprint-quality.md) | UE5 naming, UPROPERTY/UFUNCTION hygiene, GAS pattern rules, security hygiene |
| [quality/playtest-and-automation.md](quality/playtest-and-automation.md) | Three layers — Functional Tests, Gauntlet, manual playtest checklists |
| [quality/performance-budgets.md](quality/performance-budgets.md) | 60 FPS / 16.6ms budgets for GTX 1060 / PS5-equivalent, draw call caps, triangle/VRAM/audio budgets |
| [quality/crash-and-bug-response.md](quality/crash-and-bug-response.md) | P0–P3 severity, callstack reading, hotfix branch process, post-mortem template |

---

## Rule files (auto-loaded)

| Rule | When it applies |
|---|---|
| [rules/standards.md](rules/standards.md) | Universal — every task |
| [rules/ue5-cpp.md](rules/ue5-cpp.md) | C++ edits — UPROPERTY/UFUNCTION specifiers, header/cpp split, smart pointer ownership |
| [rules/ue5-blueprints.md](rules/ue5-blueprints.md) | Blueprint edits — when-to-use-BP table, four communication patterns, performance rules |
| [rules/ue5-gas.md](rules/ue5-gas.md) | GAS code — ASC setup, ability lifecycle, attribute sets, gameplay tags |
| [rules/ue5-replication.md](rules/ue5-replication.md) | Replication / RPCs — HasAuthority patterns, DOREPLIFETIME conditions, RPC matrix |
| [rules/ue5-naming.md](rules/ue5-naming.md) | All asset and class naming (BP_/ABP_/WB_/M_/T_/SM_/SK_/S_/Cue_/A_/DA_/DT_/E_/NS_/LT_/GA_/GE_/GAS_/BPI_/BT_/BB_) |
| [rules/ue5-perf.md](rules/ue5-perf.md) | Performance — 16.67ms budget, draw calls, LODs, tick rules, GC mitigation |
| [rules/ue5-input.md](rules/ue5-input.md) | Enhanced Input — IA/IMC design, binding patterns, modifiers/triggers |
| [rules/ue5-niagara.md](rules/ue5-niagara.md) | Niagara — NS/NE structure, CPU vs GPU, pooling, scalability LODs |
| [rules/wwise.md](rules/wwise.md) | Audio — PostEvent patterns, Switch vs State, RTPC normalization, bank loading |
| [rules/git-lfs.md](rules/git-lfs.md) | Versioning — `.gitattributes`, `.gitignore`, LFS lock workflow |
| [rules/ue5-microtransactions.md](rules/ue5-microtransactions.md) | Monetization — cosmetics-first, hard/soft currency, server-side validation, FTC/COPPA/GDPR |

---

## What goes where

| If you want to… | Edit this |
|---|---|
| Change the `/ship` phases | [templates/commands/ship.md](templates/commands/ship.md) |
| Change the `/fix` flow | [templates/commands/fix.md](templates/commands/fix.md) |
| Change the handoff schema | [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md) |
| Change the brief format | [agents/_shared/BRIEF.md](agents/_shared/BRIEF.md) |
| Change a universal standard | [rules/standards.md](rules/standards.md) (or path-scoped rule file) |
| Add a gate check | [hooks/gate.sh](hooks/gate.sh) |
| Add a cook-smoke check | [scripts/cook-smoke.sh](scripts/cook-smoke.sh) |
| Add an automation test runner change | [scripts/automation-test.sh](scripts/automation-test.sh) |
| Add a Gauntlet runner change | [scripts/gauntlet-critical.sh](scripts/gauntlet-critical.sh) |
| Block a commit-time mistake | [hooks/pre-commit.sh](hooks/pre-commit.sh) |
| Surface a post-commit finding | [hooks/post-commit-audit.sh](hooks/post-commit-audit.sh) |
| Auto-refresh state at session end | [hooks/session-end.sh](hooks/session-end.sh) |
| Change cold-start agent context | [scripts/gen-index.sh](scripts/gen-index.sh) |
| Change project skeleton | [templates/](templates/) ([scripts/gamebook-init.sh](scripts/gamebook-init.sh) picks it up) |
| Change the injected CLAUDE.md | [scripts/gen-claude-md.sh](scripts/gen-claude-md.sh) (slim, stack-tailored from `project.config.json`) |
| Add a new agent | `scripts/new-agent.sh <name> [model]` → `agents/<name>.md`; wire into ship/fix |
| Add a new skill | `scripts/new-skill.sh <name>` → `skills/<name>/SKILL.md` (+ `resources/`) |
| Change scaffolder interview options | [agents/project-scaffolder.md](agents/project-scaffolder.md) |

---

## Why this shape

- **Real systems→content handoff.** `blueprint-feature-builder` reads `.claude/handoffs/systems.json` from disk. The content agent literally cannot start until the systems agent has written `status: "ready"` with a fully-populated `systems_surface[]`. Two agents that "speak" via a real file, not via prose.
- **Parallel where it's safe.** Phase 1 (systems + tests) is parallel because they don't conflict — tests write *against* the surface that systems will deliver, and `playtest-architect` reads the brief to know what to scaffold. Phase 2 (content + review + level + optional narrative) is parallel — reviewers work on the already-landed C++/test work; content wires BP against the contract.
- **Token-cheap context.** INDEX.json + slim BRIEFs + JSON HANDOFFs keep subagent cold-starts low. Subagents don't replay the conversation.
- **Slice gate + integrated gate.** Subagents gate their slice cheap; the orchestrator runs the full gate once at the integration boundary.
- **No second terminal.** Optional headless editor daemons run inside the same conversation.
- **Deterministic at every boundary.** Every transition (commit, handoff, session-end, CI) has a hook that either updates state or blocks bad state.
- **Degrades gracefully.** Commands work in non-gamebook projects — they skip what isn't there.

---

## Failure modes (and where they're caught)

| Failure | Caught by |
|---|---|
| Agent skips INDEX.json, wastes tokens | [agents/README.md](agents/README.md) INDEX protocol is the first instruction in every agent file |
| Agent hands off broken state | `make gate STEP=lint,test` returns non-zero; HANDOFF requires `gate_result: "pass"` |
| BP invents an attribute / ability not in systems.json | content agent refuses to start if `.claude/handoffs/systems.json` is missing or `status != "ready"` |
| Phase 1 systems and tests conflict | Non-overlapping surfaces by design; integrated `make gate` after Phase 1 catches residual issues |
| Ability compiles but doesn't activate in-editor | `make cook-smoke` cooks one map headlessly; `make automation-critical` runs Functional Tests with `-NullRHI` |
| Save file corrupts on schema change | [rules/standards.md](rules/standards.md) requires schema version + `Migrate()` on every USaveGame |
| Secret in source | [hooks/pre-commit.sh](hooks/pre-commit.sh) blocks committed `Saved/`, `Intermediate/`; `code-reviewer` checks for hardcoded API keys |
| `Saved/` or `Intermediate/` committed | [hooks/pre-commit.sh](hooks/pre-commit.sh) blocks |
| `.uasset` outside LFS | [hooks/pre-commit.sh](hooks/pre-commit.sh) verifies LFS pointer header |
| Naming convention drift | [hooks/pre-commit.sh](hooks/pre-commit.sh) checks staged files against [rules/ue5-naming.md](rules/ue5-naming.md) |
| `.uproject` engine version drifts from `Config/DefaultEngine.ini` | [hooks/pre-commit.sh](hooks/pre-commit.sh) compares both |
| Microtransaction grant happens client-side | [rules/ue5-microtransactions.md](rules/ue5-microtransactions.md) requires server-validated receipts; `code-reviewer` enforces |
| Background daemons leaked across sessions | [hooks/session-end.sh](hooks/session-end.sh) cleans `DerivedDataCache`/`Intermediate` |

---

## Review checklist (before committing a `/ship` result)

- [ ] All `.claude/handoffs/*.json` show `gate_result: "pass"` and `status: "ready"`
- [ ] `systems.json` `systems_surface[]` matches every new C++ symbol
- [ ] `make automation-critical` passes; new `@critical` tests added for new surface
- [ ] `make cook-smoke` passes
- [ ] `make gate` passes
- [ ] [docs/GAMEPLAY_SYSTEMS.md](templates/docs/GAMEPLAY_SYSTEMS.md) updated with new GA_*/GE_*/AttributeSet
- [ ] [docs/INPUT_MAP.md](templates/docs/INPUT_MAP.md) updated if new IA/IMC added
- [ ] [docs/PERFORMANCE_BUDGETS.md](templates/docs/PERFORMANCE_BUDGETS.md) reviewed if new Niagara/AI/render load
- [ ] CommonUI for menus (not raw UMG controls); MVVM bindings, not Tick
- [ ] Naming follows [rules/ue5-naming.md](rules/ue5-naming.md) (BP_/WB_/DA_/GA_/GE_/etc.)
- [ ] All new binaries in LFS (`git lfs ls-files` shows them)
- [ ] No `Saved/`/`Intermediate/`/`DerivedDataCache/`/`Binaries/` staged
- [ ] If `Config/`/`Plugins/`/`.uproject` changed → `build-release-engineer` ran and `build.json` is green
- [ ] Microtransaction changes: server-side validation path verified, never grant client-side
- [ ] [docs/PLAYTEST.md](templates/docs/PLAYTEST.md) updated if a new manual playtest beat was added
