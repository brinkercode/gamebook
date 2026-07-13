# {{PROJECT_NAME}} — Claude Playbook

> Unreal Engine {{ENGINE_VERSION}} FPS — indie vertical slice. {{ABILITY_FRAMEWORK}} abilities · {{AUDIO_MIDDLEWARE}} audio · {{MULTIPLAYER}} networking.

## First read every session

1. `.claude/INDEX.json` — machine-generated project map (entry points, task routing, C++ class / Blueprint / Data Asset inventory). Always read FIRST. Refresh with `make index`.
2. `.claude/agents/README.md` — agent index + INDEX protocol + handoff convention.
3. The `docs/*.md` listed in `task_routing` for the current task type.

## Commands (waves)

| Size | Command | Notes |
|---|---|---|
| Trivial | inline edit | rename, comment, INI tweak, data table row |
| Small | `/fix <change>` | single-surface fix-wave: one author → independent review → independent gate |
| Full feature | `/feature <feature>` | pod feature-wave: brief → C++ systems + tests → gate → BP/level/audio → review → validate |
| Everything else | see the catalog | `/playtest` `/level` `/narrative` `/audio-pass` `/review` `/bug-hunt` `/milestone` `/perf-budget` … plus the stage gates (`/alpha-gate` → `/beta-gate` → `/rc` → `/release`) |

All commands are wave shims symlinked into `~/.claude/commands/` by the gamebook's
`scripts/setup-claude.sh`. This project's lifecycle **stage** lives in the gamebook's
`references/<project>/config.json` — out-of-stage waves self-skip (features freeze at alpha;
beta+ is debug-only).

## Project Docs

- [Architecture](docs/ARCHITECTURE.md), [Design](docs/DESIGN.md), [Gameplay Systems](docs/GAMEPLAY_SYSTEMS.md)
- [Level Design](docs/LEVEL_DESIGN.md), [Narrative](docs/NARRATIVE.md), [Art Direction](docs/ART_DIRECTION.md)
- [Audio](docs/AUDIO.md), [Input Map](docs/INPUT_MAP.md), [Performance Budgets](docs/PERFORMANCE_BUDGETS.md)
- [Build Pipeline](docs/BUILD_PIPELINE.md), [Playtest](docs/PLAYTEST.md), [Store Design](docs/STORE_DESIGN.md)
- [Roadmap](docs/ROADMAP.md), [Project Setup](docs/PROJECT_SETUP.md)
- `project.config.json` — canonical record of every framework choice from the scaffolder interview

## Stack

Engine: Unreal Engine {{ENGINE_VERSION}} · C++ + Blueprints
Abilities: {{ABILITY_FRAMEWORK}} (GameplayAbilities, GameplayEffects, AttributeSets, GameplayTags)
Input: Enhanced Input plugin (Input Actions, Input Mapping Contexts)
Audio: {{AUDIO_MIDDLEWARE}}
VFX: Niagara
UI: UMG + Common UI
Networking: {{MULTIPLAYER}}
Monetization: {{MONETIZATION_MODEL}}
Target platforms: {{TARGET_PLATFORMS}}
Asset versioning: Git + Git LFS

See `.claude/rules/ue5-cpp.md` and `.claude/rules/ue5-blueprints.md` for the patterns each agent enforces.

## Commands

```bash
make build                     # Compile editor + game modules (UnrealBuildTool)
make cook-smoke                # Cook a minimal map variant for smoke validation
make automation-critical       # Run Functional Tests tagged @critical
make gauntlet-critical         # Run Gauntlet stress tests tagged @critical
make gate                      # Full deterministic check — compile + cook-smoke + automation-critical
make gate STEP=lint            # Slice check — agents only
make gate STEP=test            # Slice check — agents only
make index                     # Refresh .claude/INDEX.json
make package-dev               # Package Development config (no shipping optimizations)
make package-shipping          # Package Shipping config (final, optimized)
make clean                     # Remove Binaries/, Intermediate/, Saved/Cooked/
```

## Key Paths

- C++ sources: `Source/{{PROJECT_NAME}}/` · Editor module: `Source/{{PROJECT_NAME}}Editor/` · Tests module: `Source/{{PROJECT_NAME}}Tests/`
- Blueprints: `Content/Core/Blueprints/` · Characters: `Content/Characters/` · Weapons: `Content/Weapons/`
- UI Widgets: `Content/UI/` · VFX: `Content/VFX/` · Audio: `Content/Audio/`
- Data Assets: `Content/Data/` · Data Tables: `Content/Data/Tables/`
- Levels: `Content/Levels/` · Streaming levels: `Content/Levels/Streaming/`
- Config: `Config/Default*.ini`
- Agent handoffs: `.claude/handoffs/{systems,playtest,content,review,build}.json`

## Non-Negotiables

1. Read `.claude/INDEX.json` before any Glob/Grep.
2. Run `make gate` before any handoff. Block on non-zero exit.
3. All GAS abilities through `UAbilitySystemComponent` — never activate effects directly from character code.
4. All Input handled via Enhanced Input `UInputAction` + `UInputMappingContext` — never raw `GetInputAxisValue`.
5. Gameplay state in subsystems (`UGameInstanceSubsystem`, `UWorldSubsystem`, `ULocalPlayerSubsystem`) — never in global variables or singletons.
6. Designer-facing values in Primary Data Assets or Data Tables — never hardcoded in C++.
7. Save/Load only via async `USaveGame` subclasses — never synchronous file I/O from game thread.
8. Audio events only through the designated audio subsystem — never raw `UAudioComponent::Play` from gameplay code.
9. Update relevant `docs/*.md` when behavior changes.

## How `/feature` flows (the flagship wave)

```
Design:     design-director → brief + testable acceptance criteria
Build ∥:    eng-gameplay (C++ systems, systems_surface[] mandatory) ‖ qa-lead (failing tests)
Verify:     qa-gate-verifier re-runs the gate independently (self-reports ignored; one repair)
Integrate ∥: design-technical (BP vs systems_surface ONLY) ‖ design-level ‖ audio-designer
Review:     eng-director (GAS/BP/replication/perf/security dimensions)
Validate:   make cook-smoke → make automation-critical → make gate (independent)
```

The wave returns a commit message — **you commit, waves never run git**. Binary assets are
authored via editor-Python generator scripts (`skills/ue5-editor-python`), never by hand.
Every agent reads INDEX.json first; handoff schemas live in `.claude/agents/_shared/schemas/`.
