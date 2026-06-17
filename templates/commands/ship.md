---
description: Build a game feature end-to-end (C++ systems then Blueprint/content, with parallel review + tests). File-based handoffs. Single prompt, no second terminal.
argument-hint: <feature description in plain English>
---

# /ship — single-prompt full-feature game shipper

You are orchestrating a feature build using gamebook's systems→content sequential pipeline with parallel agents and **file-based handoffs** (`.claude/handoffs/<agent>.json`). The user typed `/ship $ARGUMENTS` and expects: production-grade C++ + Blueprint code, passing Functional Tests, cook validation, and a single structured summary at the end.

**Rule of thumb on agent size:** if the change is a single C++ class OR a single Blueprint with no new GAS surface → use `/fix` instead. `/ship` is for full features that span C++ systems and Blueprint/content consumers.

---

## Phase 0 — Prep (you do this directly, fast)

1. **Require `project.config.json`.** Before anything else:
   ```bash
   test -f project.config.json && \
     jq -e '.stack.engine and .stack.abilities' project.config.json >/dev/null
   ```
   If the file is missing or malformed, **STOP IMMEDIATELY** and emit only this:

   > `project.config.json` missing or incomplete.
   >
   > `/ship` needs the engine + framework choices to know which patterns to apply.
   > Run the `project-scaffolder` agent to capture them, then re-run `/ship`.
   >
   > Brownfield: tell the scaffolder "infer from existing code" — it detects engine version
   > and plugin configuration from the `.uproject` file and `Source/` module structure.

   Do **not** infer choices yourself. Do **not** spawn the scaffolder automatically.

2. **Load engine context.** Read `project.config.json` and extract:
   - `ENGINE_VER`     = `.stack.engine`            (e.g. `5.4`)
   - `ABILITY_FW`     = `.stack.abilities`         (e.g. `GAS`)
   - `AUDIO_MW`       = `.stack.audio`             (e.g. `Wwise`, `MetaSounds`)
   - `MULTIPLAYER`    = `.stack.networking.mode`   (e.g. `single-player`, `dedicated-server`)
   - `MONETIZATION`   = `.stack.monetization`       (e.g. `steam-microtxn`, `eos-ecom`, `none`)

   Pass these into every subagent BRIEF so they apply the correct rule files. **`gameplay-systems-engineer` and `blueprint-feature-builder` refuse to run without them.**

3. **Scope check.** If `$ARGUMENTS` is missing or under 5 words with no verb/noun, call `AskUserQuestion` ONCE to clarify.

4. **Detect project shape** in parallel Bash calls:
   - `test -f .claude/INDEX.json && echo HAS_INDEX`
   - `find . -maxdepth 2 -name "*.uproject" | head -1` (confirm project root)
   - `test -d Source && echo HAS_SOURCE`
   - `test -d Content && echo HAS_CONTENT`
   - `test -d Plugins && echo HAS_PLUGINS`
   - `test -f Makefile && grep -q "^gate:" Makefile && echo HAS_GATE`
   - `git rev-parse --short HEAD 2>/dev/null` (capture base SHA)

5. **Reset the handoff directory:**
   ```bash
   mkdir -p .claude/handoffs && rm -f .claude/handoffs/*.json
   ```

6. **Refresh INDEX** if `HAS_INDEX` and `make index` exists: `make index`.

7. **Read `.claude/INDEX.json`** (or `CLAUDE.md` if no index). Determine `task_type`.

8. **Generate `task_id`:** `ship-<YYYY-MM-DD>-<kebab-slug-from-args>`. Use it in every BRIEF.

---

## Phase 1 — Systems + Tests (parallel, one message, 2 agents)

Spawn `gameplay-systems-engineer` and `playtest-architect` in a **single message with two Agent tool calls**. Each gets a tight BRIEF that includes the engine context from Phase 0:

```yaml
context:
  engine_version: <ENGINE_VER>         # 5.4|5.5|...
  abilities: <ABILITY_FW>              # GAS
  audio: <AUDIO_MW>                    # Wwise|MetaSounds
  networking_mode: <MULTIPLAYER>       # single-player|dedicated-server
  monetization: <MONETIZATION>         # steam-microtxn|eos-ecom|none
```

```
Agent[gameplay-systems-engineer]: <BRIEF with engine context — systems_surface[] mandatory in handoff>
Agent[playtest-architect]:        <BRIEF: failing Functional Test specs for the systems surface FIRST>
```

`gameplay-systems-engineer` produces `.claude/handoffs/systems.json` with the `systems_surface[]` array — every new C++ class, GAS ability/effect/attribute, subsystem, or component that Blueprint authors need to consume. Schema:

```json
{
  "status": "ready",
  "gate_result": "pass",
  "systems_surface": [
    {
      "type": "ability|attribute|effect|subsystem|component",
      "name": "UGA_Sprint",
      "header_path": "Source/{{PROJECT_NAME}}/Public/Abilities/GA_Sprint.h",
      "blueprint_consumers": ["BP_PlayerCharacter", "BP_AbilityBar_Widget"],
      "gameplay_tags": ["Ability.Sprint", "Status.Sprinting"],
      "replication": "server|client|none"
    }
  ],
  "files_changed": [],
  "blockers": [],
  "decisions": []
}
```

### Gate before Phase 2

After both agents return, **verify on disk:**
```bash
test -f .claude/handoffs/systems.json && \
  jq -e '.status == "ready" and .gate_result == "pass"' .claude/handoffs/systems.json
test -f .claude/handoffs/playtest.json && \
  jq -e '.gate_result == "pass"' .claude/handoffs/playtest.json
```

- If `systems.json` is missing, malformed, or `status: "blocked"` / `gate_result: "fail"`: re-invoke `gameplay-systems-engineer` ONCE with the failure context (`gate.logs_tail` + `blockers`). If it fails again, STOP and report — do not start Phase 2 with broken state.
- Then run `make gate` (integrated, not slice) once to catch module-level conflicts.

---

## Phase 2 — Blueprint/Content + Review + Level (parallel, one message, 3 agents)

Blueprint and content work is **blocked on the systems handoff**. Reviewers can run against the C++ work already on disk. Pass the full context to `blueprint-feature-builder`:

```yaml
context:
  engine_version: <ENGINE_VER>
  abilities: <ABILITY_FW>
  audio: <AUDIO_MW>
  networking_mode: <MULTIPLAYER>
  upstream_handoffs:
    - .claude/handoffs/systems.json
```

```
Agent[blueprint-feature-builder]:  <BRIEF with engine context — upstream_handoffs: [.claude/handoffs/systems.json]>
Agent[code-reviewer]:              <BRIEF — GAS pattern audit + save/asset/perf hygiene on systems slice>
Agent[level-encounter-designer]:   <BRIEF — blockout / encounter scripting for the feature's level surface>
```

The `blueprint-feature-builder` BRIEF must instruct it to:
1. Read `.claude/handoffs/systems.json` FIRST.
2. If `status != "ready"`, write `.claude/handoffs/content.json` with `status: "blocked"` and a blocker explaining what's missing — do not proceed.
3. Otherwise wire Blueprint logic, UMG widgets, and Data Assets against the `systems_surface[]` array, using the patterns from `.claude/rules/ue5-blueprints.md`.

After all three return, verify:
```bash
jq -e '.gate_result == "pass"' .claude/handoffs/content.json
jq -e '.gate_result == "pass"' .claude/handoffs/review.json
jq -e '.gate_result == "pass"' .claude/handoffs/level.json
```

If `review.json` lists blockers, fix them with `code-reviewer` (one focused retry) before Phase 3.

---

## Phase 3 — Functional validation (serial, fast)

1. `make cook-smoke` — cook the smoke map variant. Skip if cook environment unavailable (note in summary).
2. `make automation-critical` — Functional Tests tagged `@critical`; budget under 60s. Skip if no test map.
3. `make gate` — final integrated gate (compile + cook-smoke + automation-critical).

**Regression rule:** each step must pass. On failure, invoke the relevant agent ONCE with focused context, then re-run that step. Two failures in a row → STOP and report.

---

## Phase 4 — Build/config changes + Report (conditional, then stop)

```bash
git diff --name-only <base>..HEAD | grep -qE "^(Config/|.*\.uproject$|Plugins/)" && \
  echo "spawn build-release-engineer with .claude/handoffs/build.json as return path"
```

Spawn `build-release-engineer` if any of the following changed:
- `Config/Default*.ini` — may affect cook, packaging, or platform settings
- `*.uproject` — plugin list or engine association changed
- `Plugins/` — new plugin added or upgraded

### Then output ONE structured summary and stop.

Output ONE structured summary. No preamble.

```
✅/❌ /ship <slug>  ·  <duration>

Phase 1 (parallel systems build):
  gameplay-systems-engineer  : <pass/fail>  ·  <N files>  ·  <M surfaces>
  playtest-architect         : <pass/fail>  ·  <K test specs added>

Phase 2 (parallel — blueprint-feature-builder blocked on systems.json):
  blueprint-feature-builder  : <pass/fail>  ·  <N files>
  code-reviewer              : <pass/fail>  ·  <B blockers>
  level-encounter-designer   : <pass/fail>  ·  <N assets>

Phase 3 (validation):
  make cook-smoke            : <pass/fail/skip>
  make automation-critical   : <pass/fail/skip>
  make gate (final)          : <pass/fail>

Phase 4 (build/config — conditional):
  build-release-engineer     : <pass/skip>

Files changed: <N>
  <path1> — <one-liner>
  <path2> — <one-liner>

Handoffs at: .claude/handoffs/{systems,playtest,content,review,level,build}.json

Next: <ready to commit | list of blockers>
```

**Then stop.** Do not commit. Do not push.

---

## Hard rules

- **Parallel by default.** Phase 1 launches 2 agents in ONE message. Phase 2 launches 3 agents in ONE message.
- **Systems gate Content.** `blueprint-feature-builder` cannot start until `.claude/handoffs/systems.json` shows `status: "ready"` AND `gate_result: "pass"`.
- **`systems_surface[]` is the contract.** Blueprint authors read it — do not deviate from the declared headers, tags, or replication modes without a re-handoff.
- **Subagents never run the full gate.** Each gates only its slice (`make gate STEP=build && STEP=test`). The orchestrator runs the full gate at integration boundaries.
- **No new Plugins or module dependencies without justification.** Subagents must declare in `deps_added`.
- **No commits.** `/ship` stops at "ready to commit."
- **Token discipline.** Don't re-read files an agent already wrote a handoff for. The handoff JSON is canonical.
- **One retry max.** Each failed agent gets one focused retry. Two failures → STOP and report.

---

## Degraded modes (non-gamebook projects)

If `.claude/INDEX.json` is missing and there's no `make gate`:
- Skip `make index` and the INDEX read.
- Use `UnrealBuildTool` directly for compile checks.
- Skip `make cook-smoke` / `make automation-critical` unless the project has a configured test map.
- If the gamebook agent definitions are absent, invoke the generic `claude` subagent with a focused brief instead.
- Still write/read `.claude/handoffs/*.json` — the file convention works anywhere.

---

## Available substitutions

`$ARGUMENTS` — the feature description the user passed.
