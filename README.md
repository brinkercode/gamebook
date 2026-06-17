# Gamebook

> Opinionated UE5 game dev playbook for shipping vertical slices with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Unreal Engine 5.4+, C++ + Blueprints, Gameplay Ability System (GAS), Enhanced Input, Wwise (MetaSounds fallback), Niagara, UMG + Common UI, Git LFS, single-player default with opt-in dedicated server. Multi-agent orchestration with real, file-based handoffs.

The gamebook is the game-dev twin of [godbook](../godbook/) — same orchestration shape, same hooks, same `/ship` + `/fix` shape — but the agents, rules, skills, and guides are rewritten for UE5. Where godbook coordinates a backend API and a React frontend, the gamebook coordinates a C++ systems layer (GAS abilities, attribute sets, subsystems) and a Blueprint/content layer (UMG widgets, Niagara, Wwise hookup, level scripting). The systems→content boundary is the same shape as godbook's backend→frontend boundary — a real `.claude/handoffs/systems.json` file gates the content pass.

What you get out of the box:

- A project scaffolder that **interviews you** for every UE5 choice (engine version, audio middleware, networking stance, monetization, target platforms, perf baseline, art/narrative direction) via `AskUserQuestion` and persists them in `project.config.json`. Required — `/ship` and `/fix` refuse to run without it.
- Two slash commands: **`/ship`** (full feature, multi-agent — systems → content → review → tests → build) and **`/fix`** (single-surface change). Both read `project.config.json` and pass UE5 context to every subagent.
- A systems agent that hands off a real `.claude/handoffs/systems.json` (with `systems_surface[]` describing every new `UGameplayAbility`, `UAttributeSet`, `UGameplayEffect`, subsystem, and component) before the Blueprint/content agent is allowed to start. No drift between "what the C++ exposes" and "what the BP wires up."
- Auto-loaded rule files for UE5 C++, Blueprints, GAS, replication, naming, perf, Enhanced Input, Niagara, Wwise, Git LFS, microtransactions.
- Pre-commit + post-commit + session-end + gate hooks. Deterministic `make gate` that CI mirrors job-for-job (lint → automation tests → UBT build → cook-slim → index).
- A skill catalog for every recurring UE5 recipe: GAS ability, weapon class, enemy AI behavior tree, HUD widget, dialogue tree, save system, main menu, pause menu, level streaming, interaction system, pickup system, microtransaction store.

---

## When to use the gamebook

```
Need to ship game code on UE5?
├── Yes → use the gamebook
│   ├── Single C++ class / single BP / single widget / single Data Asset?
│   │     → /fix
│   ├── New gameplay feature spanning systems + content + UI + tests?
│   │     → /ship
│   └── New UE5 project, no scaffold yet?
│         → run project-scaffolder first
└── No (web/full-stack app) → use ../godbook/ instead
```

If you need both (a game with a companion web service), run the gamebook for the UE5 client and godbook for the service in a sibling directory.

---

## Install (once per machine)

```bash
# 1. Clone wherever you keep playbooks
git clone <your-fork-url> ~/Documents/repos/opal/gamebook

# 2. Make it discoverable to Claude Code globally
ln -s ~/Documents/repos/opal/gamebook ~/.claude/gamebook

# 3. Install dev permissions + symlink /ship and /fix into ~/.claude/commands/
bash ~/.claude/gamebook/scripts/setup-claude.sh
```

Restart Claude Code after step 3. `setup-claude.sh` is idempotent — re-run any time the gamebook updates its global settings or commands.

Point your global `~/.claude/CLAUDE.md` at the gamebook for UE5 work:

```markdown
## Project Playbooks
For full-stack web apps, see: `~/.claude/godbook/PLAYBOOK.md`
For UE5 games,            see: `~/.claude/gamebook/PLAYBOOK.md`
```

---

## Create a project

### Step 1 — Interview (required)

Ask Claude to act as the `project-scaffolder` agent:

```
Run the project-scaffolder agent. <new UE5 project | existing .uproject at ~/path>
```

The agent drives `AskUserQuestion` for every choice (locked decisions are not asked — see [CLAUDE.md](CLAUDE.md)):

- **Engine version**: UE5.4 · 5.5 · 5.6+
- **Audio**: Wwise (default) · MetaSounds only
- **Networking**: single-player (default) · dedicated server · listen server
- **Monetization**: none · Steam MicroTxn · EOS Ecom · console store · combination
- **Target platforms**: Windows · Steam Deck · PS5 · Xbox Series · Switch 2
- **Perf baseline**: GTX 1060 / PS5-equivalent 60 FPS (default — Nanite/Lumen off) · raised baseline (Nanite/Lumen on)

Then prose interviews via skills: [skills/concept-interview](skills/concept-interview/SKILL.md), [skills/art-direction-interview](skills/art-direction-interview/SKILL.md), [skills/narrative-interview](skills/narrative-interview/SKILL.md), [skills/audio-direction-interview](skills/audio-direction-interview/SKILL.md), [skills/monetization-interview](skills/monetization-interview/SKILL.md), [skills/target-platform-interview](skills/target-platform-interview/SKILL.md).

Output: `project.config.json` at the project root.

### Step 2 — Scaffold

The scaffolder runs `gamebook-init.sh` for you. Or run it yourself:

```bash
mkdir my-game && cd my-game
git init
bash ~/.claude/gamebook/scripts/gamebook-init.sh \
  --name "MyGame" --desc "What it is" --engine 5.4
```

That creates `Source/{MyGame,MyGameEditor,MyGameTests}/`, `Content/{Core,Characters,Weapons,Levels,UI,VFX,Audio,Data}/`, `Config/Default*.ini`, `Plugins/`, `.gitattributes` (full UE LFS list), `.gitignore`, `Makefile`, `CLAUDE.md`, `docs/` stubs, and `.claude/` with hooks + agents + skills + rules wired back to the gamebook.

### Step 3 — Verify

```bash
git lfs install
make build         # UBT compile
make automation-critical
make gate          # full deterministic check
```

---

## Daily workflow

```bash
/ship "Implement the dash ability with iframes, HUD cooldown, and a critical test"
# ↑ multi-agent: gameplay-systems-engineer + playtest-architect (Phase 1) →
#   blueprint-feature-builder + code-reviewer + level-encounter-designer (Phase 2) →
#   cook-smoke + automation-critical + gate (Phase 3) →
#   build-release-engineer if .uproject/Config/Plugins changed (Phase 4).

/fix "WB_HealthBar damage flash plays on heal too"
# ↑ single-surface: inline edit + slice gate + code-reviewer.

git commit -m "..."   # pre-commit + post-commit hooks fire
```

### Sizing

| Size | Examples | Command |
|---|---|---|
| Trivial | Comment, rename, .ini tweak, asset re-import | Inline edit |
| Small | One BP rewire, one widget, one data asset tune, one C++ method fix | `/fix <change>` |
| Full feature | New ability + attribute + cost/cooldown effect + HUD + test | `/ship <feature>` |

If `/fix` starts touching multiple surfaces or changes a GAS attribute schema, **stop and re-run as `/ship`**. See [templates/commands/fix.md](templates/commands/fix.md) for the escalation triggers.

---

## How `/ship` actually works

1. **Phase 0** — orchestrator clears `.claude/handoffs/*`, refreshes `.claude/INDEX.json`, optionally launches headless editor daemons.
2. **Phase 1 (parallel)** — [`gameplay-systems-engineer`](agents/gameplay-systems-engineer.md) + [`playtest-architect`](agents/playtest-architect.md). Systems writes `.claude/handoffs/systems.json` with `systems_surface[]`, `status: "ready"`, `gate_result: "pass"`. Playtest writes failing Functional Tests for the new surface.
3. **Gate** — `jq '.status == "ready"' .claude/handoffs/systems.json`. Repair once if blocked.
4. **Phase 2 (parallel)** — [`blueprint-feature-builder`](agents/blueprint-feature-builder.md) (reads `systems.json` first; refuses to start otherwise) + [`code-reviewer`](agents/code-reviewer.md) + [`level-encounter-designer`](agents/level-encounter-designer.md).
5. **Phase 3 (serial)** — `make cook-smoke` → `make automation-critical` → `make gate`.
6. **Phase 4 (conditional)** — [`build-release-engineer`](agents/build-release-engineer.md) if `.uproject`, `Config/`, or `Plugins/` changed.
7. **Stop** — one structured summary. You commit.

The systems→content handoff is **a real file on disk**, not prose in chat. Schema in [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md). Full diagram in [PLAYBOOK.md](PLAYBOOK.md).

---

## What's in here

| Area | Files |
|---|---|
| **Orchestration** | [PLAYBOOK.md](PLAYBOOK.md), [templates/commands/ship.md](templates/commands/ship.md), [templates/commands/fix.md](templates/commands/fix.md), [agents/_shared/BRIEF.md](agents/_shared/BRIEF.md), [agents/_shared/HANDOFF.md](agents/_shared/HANDOFF.md) |
| **Bootstrap** | [scripts/gamebook-init.sh](scripts/gamebook-init.sh), [scripts/setup-claude.sh](scripts/setup-claude.sh), [scripts/gen-index.sh](scripts/gen-index.sh), [scripts/gen-claude-md.sh](scripts/gen-claude-md.sh), [scripts/new-agent.sh](scripts/new-agent.sh), [scripts/new-skill.sh](scripts/new-skill.sh), [scripts/brain-link.sh](scripts/brain-link.sh), [templates/](templates/) |
| **CI helpers** | [scripts/cook-smoke.sh](scripts/cook-smoke.sh), [scripts/automation-test.sh](scripts/automation-test.sh), [scripts/gauntlet-critical.sh](scripts/gauntlet-critical.sh) |
| **Hooks** | [hooks/README.md](hooks/README.md), [hooks/gate.sh](hooks/gate.sh), [hooks/pre-commit.sh](hooks/pre-commit.sh), [hooks/post-commit-audit.sh](hooks/post-commit-audit.sh), [hooks/session-end.sh](hooks/session-end.sh) |
| **Agents** | [agents/README.md](agents/README.md) — 8 agents + `_shared/` (BRIEF, HANDOFF, STACK, PATTERNS, SECURITY_CHECKLIST) |
| **Auto-loaded rules** | [rules/README.md](rules/README.md), [rules/standards.md](rules/standards.md), [rules/ue5-cpp.md](rules/ue5-cpp.md), [rules/ue5-blueprints.md](rules/ue5-blueprints.md), [rules/ue5-gas.md](rules/ue5-gas.md), [rules/ue5-replication.md](rules/ue5-replication.md), [rules/ue5-naming.md](rules/ue5-naming.md), [rules/ue5-perf.md](rules/ue5-perf.md), [rules/ue5-input.md](rules/ue5-input.md), [rules/ue5-niagara.md](rules/ue5-niagara.md), [rules/wwise.md](rules/wwise.md), [rules/git-lfs.md](rules/git-lfs.md), [rules/ue5-microtransactions.md](rules/ue5-microtransactions.md) |
| **Skills (invokable)** | Interviews: [concept-interview](skills/concept-interview/SKILL.md), [art-direction-interview](skills/art-direction-interview/SKILL.md), [narrative-interview](skills/narrative-interview/SKILL.md), [audio-direction-interview](skills/audio-direction-interview/SKILL.md), [monetization-interview](skills/monetization-interview/SKILL.md), [target-platform-interview](skills/target-platform-interview/SKILL.md). Recipes: [gas-ability](skills/gas-ability/SKILL.md), [weapon-class](skills/weapon-class/SKILL.md), [enemy-ai-behavior-tree](skills/enemy-ai-behavior-tree/SKILL.md), [hud-widget](skills/hud-widget/SKILL.md), [dialogue-tree](skills/dialogue-tree/SKILL.md), [save-system](skills/save-system/SKILL.md), [main-menu](skills/main-menu/SKILL.md), [pause-menu](skills/pause-menu/SKILL.md), [input-binding](skills/input-binding/SKILL.md), [level-streaming](skills/level-streaming/SKILL.md), [interaction-system](skills/interaction-system/SKILL.md), [pickup-system](skills/pickup-system/SKILL.md), [microtransaction-store](skills/microtransaction-store/SKILL.md) |
| **Stack guides** | [guides/gameplay-systems.md](guides/gameplay-systems.md), [guides/ui-umg-commonui.md](guides/ui-umg-commonui.md), [guides/save-load.md](guides/save-load.md), [guides/gas-overview.md](guides/gas-overview.md), [guides/replication-overview.md](guides/replication-overview.md), [guides/asset-pipeline.md](guides/asset-pipeline.md), [guides/packaging-cooking.md](guides/packaging-cooking.md), [guides/steam-deploy.md](guides/steam-deploy.md), [guides/microtransactions.md](guides/microtransactions.md), [guides/project-settings.md](guides/project-settings.md), [guides/ue5-project-structure.md](guides/ue5-project-structure.md) |
| **Interviews (legacy form)** | [interviews/figma-integration.md](interviews/figma-integration.md), [interviews/reference-game-analysis.md](interviews/reference-game-analysis.md) |
| **Quality** | [quality/cpp-blueprint-quality.md](quality/cpp-blueprint-quality.md), [quality/playtest-and-automation.md](quality/playtest-and-automation.md), [quality/performance-budgets.md](quality/performance-budgets.md), [quality/crash-and-bug-response.md](quality/crash-and-bug-response.md) |
| **Per-project templates** | [templates/AGENT.md](templates/AGENT.md), [templates/SKILL.md](templates/SKILL.md), [templates/CLAUDE.md](templates/CLAUDE.md), [templates/Makefile](templates/Makefile), [templates/docs/](templates/docs/) (ARCHITECTURE, DESIGN, GAMEPLAY_SYSTEMS, LEVEL_DESIGN, NARRATIVE, ART_DIRECTION, AUDIO, INPUT_MAP, PERFORMANCE_BUDGETS, BUILD_PIPELINE, PLAYTEST, STORE_DESIGN, ROADMAP, PROJECT_SETUP) |

---

## Supported stack

The interview captures every choice in `project.config.json`. Locked decisions (see [CLAUDE.md](CLAUDE.md)) are not asked. Full reference: [agents/_shared/STACK.md](agents/_shared/STACK.md).

| Layer | Options (default first) |
|---|---|
| Engine | **UE5.4** · UE5.5 · UE5.6+ |
| Language | C++ + Blueprints (both required) |
| Ability framework | **GAS** (locked) |
| Input | **Enhanced Input** (locked) |
| UI | **UMG + Common UI** (locked) |
| Audio | **Wwise** · MetaSounds only |
| VFX | **Niagara** (locked) |
| Networking | **Single-player** · Dedicated server (Replication Graph) · Listen server |
| Save | **USaveGame + async + XOR/checksum** (locked; AES-256 wrapper available) |
| Versioning | **Git + Git LFS** (locked; no Perforce/Plastic) |
| Subsystems | **GameInstance / World / LocalPlayer** preferred over singletons |
| Data | **Primary Data Assets + Data Tables** (locked) |
| Monetization | none · **Steam MicroTxn** · EOS Ecom · console store · combination |
| Perf baseline | **GTX 1060 / PS5-equivalent 60 FPS, Nanite/Lumen off** · raised |
| Platforms | Windows · Steam Deck · PS5 · Xbox Series · Switch 2 |

---

## Updating the gamebook

```bash
cd ~/.claude/gamebook && git pull
bash scripts/setup-claude.sh
```

Existing projects auto-pick-up changes to **hooks** and **agents** (symlinks). They **don't** auto-update `rules/*.md` — those are version-pinned per project. Re-run `gamebook-init.sh` inside a project to refresh rules in place (idempotent; never overwrites your code).

---

## License

MIT.
