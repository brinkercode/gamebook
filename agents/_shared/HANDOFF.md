# Handoff Convention — `.claude/handoffs/<agent>.json`

> Every subagent writes a single JSON file to `.claude/handoffs/<agent>.json` on completion AND emits the same JSON as its final message. The file is the deterministic source of truth — the next phase reads it from disk, not from chat.

---

## Why file-based

Parallel subagents cannot read each other's chat output reliably. The orchestrator spawns them concurrently in one message; their replies arrive after. To chain phases (`systems → content`), the downstream agent has to read a real artifact on disk. That artifact is `.claude/handoffs/<agent>.json`.

The orchestrator polls / `jq`s the file. Subagents read prior phase files via `Read` before starting.

---

## File layout

```
.claude/handoffs/
├── systems.json     # written by gameplay-systems-engineer  (Phase 1, gates Phase 2)
├── playtest.json    # written by playtest-architect         (Phase 1)
├── content.json     # written by blueprint-feature-builder  (Phase 2)
├── level.json       # written by level-encounter-designer   (Phase 2)
├── narrative.json   # written by narrative-content-author   (Phase 2, optional)
├── review.json      # written by code-reviewer              (Phase 2)
└── build.json       # written by build-release-engineer     (Phase 4, optional)
```

The orchestrator clears `.claude/handoffs/*` at the start of every `/ship` run.

---

## Schema (single object per file)

```json
{
  "schema_version": "2",
  "task_id":   "ship-2026-06-16-dash-ability",
  "agent":     "gameplay-systems-engineer",
  "phase":     1,
  "status":    "ready",
  "gate_result": "pass",
  "gate": {
    "step": "lint+test (slice)",
    "duration_ms": 18420,
    "failed_step": null,
    "logs_tail": null
  },
  "files_changed": [
    { "path": "Source/MyFPS/Public/Abilities/GA_Dash.h",    "op": "add", "summary": "Dash ability header" },
    { "path": "Source/MyFPS/Private/Abilities/GA_Dash.cpp", "op": "add", "summary": "ActivateAbility + Stamina cost wiring" }
  ],
  "tests_added": [
    { "path": "Source/MyFPSTests/Private/GA_DashTest.cpp", "covers": ["Activation consumes Stamina", "Cooldown blocks reactivation"] }
  ],
  "systems_surface": [
    {
      "type": "ability",
      "name": "GA_Dash",
      "header_path": "Source/MyFPS/Public/Abilities/GA_Dash.h",
      "blueprint_consumers": ["BP_GA_Dash", "BP_PlayerCharacter"],
      "gameplay_tags": ["Ability.Movement.Dash", "State.Cooldown.Dash"],
      "replication": "server"
    },
    {
      "type": "effect",
      "name": "GE_DashCost",
      "header_path": "Source/MyFPS/Public/Effects/GE_DashCost.h",
      "blueprint_consumers": ["BP_GE_DashCost"],
      "gameplay_tags": ["Cost.Stamina"],
      "replication": "server"
    },
    {
      "type": "attribute",
      "name": "Stamina",
      "header_path": "Source/MyFPS/Public/Abilities/MyAttributeSet.h",
      "blueprint_consumers": ["WB_HUD", "BP_PlayerCharacter"],
      "gameplay_tags": ["Attribute.Stamina"],
      "replication": "server"
    }
  ],
  "decisions": [
    "Stamina cost via GE_DashCost (not hardcoded in ability) so designers can tune in DT_AbilityCosts."
  ],
  "deps_added": [],
  "downstream_needs": {
    "blueprint-feature-builder": "Wrap GA_Dash in BP_GA_Dash; bind Niagara + Wwise on ActivateAbility; HUD listens to OnStaminaChange delegate.",
    "playtest-architect": "Functional Test: dash twice in 2s — second must be blocked by GE_DashCooldown."
  },
  "blockers": []
}
```

### Failure variant

```json
{
  "schema_version": "2",
  "task_id":   "ship-2026-06-16-dash-ability",
  "agent":     "gameplay-systems-engineer",
  "phase":     1,
  "status":    "blocked",
  "gate_result": "fail",
  "gate": {
    "step": "test",
    "duration_ms": 9100,
    "failed_step": "automation:GA_DashTest",
    "logs_tail": "LogAutomationController: Test Failed. GA_DashTest.Cooldown\n  Expected: ability blocked\n  Actual: ability re-activated at t=1.4s\n"
  },
  "files_changed": [],
  "tests_added": [],
  "systems_surface": [],
  "decisions": [],
  "deps_added": [],
  "downstream_needs": {},
  "blockers": [
    "GE_DashCooldown duration not applied — ApplyGameplayEffectToSelf called with 0s magnitude. Fix: bind DurationMagnitude to FScalableFloat from CurveTable."
  ]
}
```

---

## Field reference

| Field | Required | Notes |
|---|---|---|
| `schema_version` | yes | `"2"`. Bump on breaking changes. |
| `task_id` | yes | Echoes the brief's `task_id`. |
| `agent` | yes | Echoes the brief's `agent`. |
| `phase` | yes | 1 \| 2 \| 4. |
| `status` | yes | `"ready"` (downstream can start) \| `"blocked"` (orchestrator must repair before Phase 2). |
| `gate_result` | yes | `"pass"` \| `"fail"`. Slice-scoped — your changed files only. |
| `gate.step` | yes | Which gate steps ran (e.g. `"lint+test (slice)"`). |
| `gate.duration_ms` | yes | Integer ms. |
| `gate.failed_step` | if fail | First step that failed. |
| `gate.logs_tail` | if fail | Last ~50 lines of failing output. |
| `files_changed` | yes | `[{path, op, summary}]`. `op` ∈ `add` \| `modify` \| `delete` \| `rename`. |
| `tests_added` | yes | `[{path, covers}]`. Empty array if none. |
| `systems_surface` | gameplay-systems-engineer only | New/changed C++ gameplay surfaces. **This is what `blueprint-feature-builder` reads to wire BPs/UMG.** See schema below. |
| `decisions` | yes | One-line trade-offs. Skip the obvious. |
| `deps_added` | yes | New top-level Plugins (engine/marketplace) or third-party SDKs. Format: `"<plugin>@<ver>: <one-sentence reason>"`. |
| `downstream_needs` | yes | `{<agent>: <what they need from your work>}`. |
| `blockers` | yes | Unresolved items. If non-empty, `status: "blocked"`. |

### `systems_surface[]` element schema

| Field | Type | Notes |
|---|---|---|
| `type` | string | `"ability"` \| `"attribute"` \| `"effect"` \| `"subsystem"` \| `"component"` |
| `name` | string | C++ class name (e.g. `GA_Dash`, `UStaminaComponent`). |
| `header_path` | string | Path to the `.h` so BP authors can read UPROPERTY/UFUNCTION signatures. |
| `blueprint_consumers` | string[] | BPs/widgets expected to wrap or read this surface. Hint, not enforcement. |
| `gameplay_tags` | string[] | FGameplayTags this surface grants, requires, or blocks. |
| `replication` | string | `"client"` \| `"server"` \| `"none"`. Single-player projects use `"none"` everywhere. |

---

## Rules

1. **Two writes, one truth.** Use `Write` to put the JSON at `.claude/handoffs/<agent>.json` AND emit the same JSON as your final chat message. The file is canonical.
2. **Last chat message = JSON only.** No prose, no markdown fences, no commentary.
3. **`status: "blocked"` is not a failure of `/ship`.** It's a clean signal to repair. Include enough in `logs_tail` and `blockers` for a focused retry.
4. **Slice gate, not full gate.** Run `make gate STEP=lint && STEP=test` on your changed files. The orchestrator runs `STEP=all` at integration boundaries.
5. **`systems_surface` is mandatory for gameplay-systems-engineer.** If `blueprint-feature-builder` can't read accurate UPROPERTY/UFUNCTION signatures from `.claude/handoffs/systems.json`, the systems→content handoff is broken.
6. **No new top-level Plugins without `deps_added`.** The orchestrator diffs `<Project>.uproject` `Plugins[]` against this list.
7. **Cooked assets are not handoff artifacts.** Never commit cooked content or write paths under `Saved/`, `Intermediate/`, `DerivedDataCache/`.

---

## Reading upstream handoffs

Phase 2 agents start by reading their upstream dependencies:

| Agent | Reads | Why |
|---|---|---|
| `blueprint-feature-builder` | `.claude/handoffs/systems.json` | UPROPERTY/UFUNCTION signatures, gameplay tags, replication mode — needed to wrap C++ in BP, bind delegates, wire UMG |
| `level-encounter-designer` | `.claude/handoffs/systems.json` | Ability/component classes to place on AI pawns and encounter actors |
| `narrative-content-author` | `.claude/handoffs/{systems,content}.json` | Trigger volumes and BP event hooks for story beats and audio logs |
| `code-reviewer` | `.claude/handoffs/{systems,playtest,content,level}.json` + git diff | Knows what to review, who decided what |
| `build-release-engineer` | `.claude/handoffs/{systems,content,level}.json` + git diff | Knows whether `.uproject`/`Config/`/`Plugins/` changed enough to recook |

If a required handoff is missing or `status != "ready"`, the downstream agent must refuse to proceed and emit its own `status: "blocked"` with a clear blocker explaining what's missing.
