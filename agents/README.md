# Gamebook Agents

Purpose-driven Claude Code agents for building Unreal Engine 5 FPS games. Each agent owns a specific phase of `/ship`, communicates via file-based handoffs (`.claude/handoffs/<agent>.json`), and emits a JSON status.

See [PLAYBOOK.md](../PLAYBOOK.md) for the orchestration overview.

---

## The agents

| Agent | Scope | Phase in `/ship` |
|---|---|---|
| `project-scaffolder` | `AskUserQuestion`-driven UE5 interview, `project.config.json`, `gamebook-init.sh` | Pre-`/ship` (once per project) |
| `gameplay-systems-engineer` | C++ subsystems, GAS abilities/effects/attributes, replication, components | 1 |
| `playtest-architect` | Functional Tests, Gauntlet automation, manual playtest scripts | 1 |
| `blueprint-feature-builder` | Blueprint logic, UMG/Common UI widgets, content wiring | 2 (blocked on `systems.json`) |
| `level-encounter-designer` | Blockout, encounter scripting, level streaming, AI placement | 2 |
| `code-reviewer` | C++/BP review, GAS pattern audit, save/asset/perf hygiene | 2 |
| `narrative-content-author` | Dialogue trees, audio logs, story beats, Wwise event hookup | 2 (optional) |
| `build-release-engineer` | Cook, package, CI, Steam upload, EOS Ecom wiring | 4 (conditional) |

---

## Handoff convention

Every subagent writes `.claude/handoffs/<agent>.json` AND emits the same JSON as its final chat message. The orchestrator polls the file; downstream agents `Read` it before starting.

```
.claude/handoffs/
├── systems.json     # gameplay-systems-engineer   (Phase 1, BLOCKS blueprint-feature-builder)
├── playtest.json    # playtest-architect          (Phase 1)
├── content.json     # blueprint-feature-builder   (Phase 2)
├── level.json       # level-encounter-designer    (Phase 2)
├── narrative.json   # narrative-content-author    (Phase 2, optional)
├── review.json      # code-reviewer               (Phase 2)
└── build.json       # build-release-engineer      (Phase 4, optional)
```

The `/ship` orchestrator clears this directory at the start of every run. Schema in [_shared/HANDOFF.md](_shared/HANDOFF.md). Brief template in [_shared/BRIEF.md](_shared/BRIEF.md).

---

## Shared context (token-efficient)

```
agents/
├── <agent>.md                  # Slim role definition, flat & natively discovered
├── README.md                   # This index
└── _shared/                    # Shared context, referenced by the agent files
    ├── PATTERNS.md             # GAS, subsystems, Enhanced Input, UMG, replication, save/load
    ├── STACK.md                # Canonical UE5 stack reference (engine, plugins, layout)
    ├── SECURITY_CHECKLIST.md   # Anti-tamper, save integrity, MicroTxn, network trust
    ├── BRIEF.md                # Orchestrator → subagent contract
    └── HANDOFF.md              # Subagent → orchestrator contract (systems_surface schema)
```

A blueprint-feature-builder wiring a UMG widget reads `_shared/PATTERNS.md#umg`; a gameplay-systems-engineer adding an ability reads `_shared/PATTERNS.md#gas`. Agents only load what's relevant.

---

## INDEX protocol (every agent's first action)

Every agent's first read is `.claude/INDEX.json`. It saves tokens vs. broad Glob/Grep on session start.

### Step 1 — Read `.claude/INDEX.json`

Contains:
- `project` — name, description, stack (engine version, plugins, framework choices)
- `entry_points` — `<Project>.uproject`, `Source/<Project>/<Project>GameModeBase.cpp`, `Config/DefaultGame.ini`
- `task_routing` — task type → exact files/dirs to load
- `inventory` — gameplay_abilities, attribute_sets, gameplay_effects, subsystems, components, blueprints, widgets, levels, data_assets, data_tables
- `tree_hash` — sha256 of `git ls-tree HEAD` for staleness detection

### Step 2 — Resolve task type

| User intent | task type |
|---|---|
| "add ability", "new gameplay ability", "GA_…" | `add_ability` |
| "new attribute", "add to AttributeSet" | `add_attribute` |
| "new effect", "GE_…" | `add_effect` |
| "new subsystem", "GameInstanceSubsystem" | `add_subsystem` |
| "new component", "ActorComponent" | `add_component` |
| "new widget", "UMG", "WB_…" | `add_widget` |
| "new level", "blockout", "encounter" | `add_level` |
| "save slot", "USaveGame" | `add_save_data` |
| "data asset", "DA_…" | `add_data_asset` |
| "data table", "DT_…" | `add_data_table` |
| "dialogue", "audio log", "story beat" | `add_narrative` |
| "automation test", "Functional Test" | `write_tests` |
| "cook", "package", "ship build" | `add_build` |
| "Steam", "EOS Ecom", "microtransaction" | `add_monetization` |
| "review", "audit perf", "check GAS" | `review_code` |

Load **only** the files/dirs in `task_routing[type]`. Do not Glob/Grep until that proves insufficient.

### Step 3 — Check staleness

If INDEX is older than 1 hour or `git status --porcelain` shows changes to inventoried directories, run `make index` first.

### Step 4 — Before handoff

Run `make gate STEP=lint && make gate STEP=test` on your slice. Include `gate_result: pass | fail` in your handoff JSON. The orchestrator runs `make gate` (full) at integration boundaries — never run that yourself.

### Refresh cadence

- Auto: `hooks/post-commit-audit.sh` regenerates INDEX after every commit
- Auto: `hooks/session-end.sh` regenerates on every Stop event
- Manual: `make index`

---

## Installation

Agents ship inside the gamebook repo. `scripts/gamebook-init.sh` **symlinks** `.claude/agents/` to the gamebook copies so updates propagate to all projects automatically.

```bash
bash ~/.claude/gamebook/scripts/gamebook-init.sh --name MyFPS --desc "..." --engine 5.4
ls .claude/agents   # 8 agent <name>.md files + _shared/ (BRIEF, HANDOFF, PATTERNS, STACK, SECURITY_CHECKLIST) + README.md
```

To update agents across all projects, just edit the files in `~/.claude/gamebook/agents/` — the symlinks pick up changes on next session.

---

## Permissions

`.claude/settings.json` enforces:

- **No git commits** — agents suggest commit messages, never commit. (Git LFS-tracked binaries make accidental commits expensive to undo.)
- **File access scoped** — `Source/`, `Content/`, `Config/`, `Plugins/`, `Tests/`
- **Secret protection** — cannot read `.env`, `*.pfx`, signing keys, Steam SDK tokens, EOS client secrets
- **Editor invocation gated** — only `build-release-engineer` runs `UnrealEditor-Cmd` cook/package commands
