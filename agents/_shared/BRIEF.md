# Brief Template — Orchestrator → Subagent

> The slim, scoped task description `/ship` and `/fix` hand each subagent. Keep terse — every extra word costs tokens on every invocation.

---

## Schema (YAML-flavored Markdown, passed as the Agent `prompt`)

```yaml
task_id: ship-<YYYY-MM-DD>-<kebab-slug>     # shared across the whole run
agent:   <eng-gameplay | design-technical | design-level | narrative-designer | qa-lead | eng-director | eng-build>
phase:   1 | 2 | 4
scope: |
  <2 sentences max. What this agent builds/reviews, scoped to its surface only.>
must_read:
  - .claude/INDEX.json                       # task_routing[<task_type>] only
  - <up to 2 doc/header references>
upstream_handoffs:                           # Phase 2+ agents: files to read before starting
  - .claude/handoffs/systems.json            # (only when applicable)
context:
  task_type: <e.g. add_ability>
  base_sha:  <git sha at run start>
  related_agents:
    - design-technical (Phase 2)
    - qa-lead (Phase 1)
acceptance:                                  # observable success conditions
  - <e.g. "GA_Dash activates on Enhanced Input IA_Dash; consumes 25 Stamina via GE_DashCost">
  - <e.g. "make gate STEP=lint && STEP=test passes for changed source files">
do_not:
  - touch <other agent's surface>
  - introduce new top-level Plugins without naming them in HANDOFF.decisions
  - enable Nanite/Lumen (locked off for vertical slice)
  - run `make gate` STEP=all (orchestrator owns integrated gate)
return:
  - write JSON to .claude/handoffs/<agent>.json
  - emit the same JSON as the final chat message
```

---

## Rules

1. **One brief per invocation.** Never send the conversation history. The subagent reads `must_read` and `upstream_handoffs` itself.
2. **Acceptance is observable.** "Ability works" is not acceptance. "GA_Dash consumes 25 Stamina and replicates ability activation to clients" is.
3. **`do_not` lists surfaces, not techniques.** Don't tell the agent how to code; tell it what files/systems to keep its hands off.
4. **No nested briefs.** A subagent does not spawn another subagent. Escalate via `blockers` in the handoff JSON.
5. **Token budget.** Briefs fit on one screen. Over 30 lines = scope too big; split into two `/ship` runs.
6. **Always include `upstream_handoffs` for Phase 2+ agents.** They must read the prior phase's JSON before doing any work.
7. **`systems.json` is the gate.** `design-technical` MUST refuse to start if `.claude/handoffs/systems.json` is missing or `status != "ready"`.

---

## Example — Phase 1, eng-gameplay

```yaml
task_id: ship-2026-06-16-dash-ability
agent:   eng-gameplay
phase:   1
scope: |
  Add GA_Dash gameplay ability: 6m forward burst, 0.2s duration, 25 Stamina cost,
  3s cooldown. Wire to UAbilitySystemComponent on BP_PlayerCharacter. Replicated.
must_read:
  - .claude/INDEX.json
  - Source/MyFPS/Public/Abilities/MyAttributeSet.h
  - docs/GAMEPLAY_SYSTEMS.md#stamina-economy
upstream_handoffs: []                        # Phase 1 — no upstream
context:
  task_type: add_ability
  base_sha:  a3f2c91
  related_agents:
    - qa-lead (Phase 1, writing failing Functional Tests in parallel)
    - design-technical (Phase 2, BLOCKED on your handoff)
acceptance:
  - GA_Dash class compiles; UPROPERTY exposes CooldownDuration + StaminaCost
  - Ability activates on IA_Dash trigger; consumes 25 Stamina via GE_DashCost
  - GE_DashCooldown applies for 3s; cannot reactivate during cooldown
  - Activation replicates server → clients; cosmetic Niagara fires locally
  - make gate STEP=lint && STEP=test passes for changed C++
do_not:
  - touch Content/ (design-technical owns the BP_GA_Dash wrapper and VFX wiring)
  - add a new AttributeSet (extend MyAttributeSet)
  - enable replication graph (single-player default)
  - run make gate STEP=all
return:
  - write JSON to .claude/handoffs/systems.json
  - emit the same JSON as the final chat message
  - systems_surface[] array MUST be populated — design-technical needs it
```

## Example — Phase 2, design-technical (systems handoff consumer)

```yaml
task_id: ship-2026-06-16-dash-ability
agent:   design-technical
phase:   2
scope: |
  Build BP_GA_Dash (Blueprint subclass of GA_Dash) wiring Niagara NS_DashTrail and
  Wwise event Play_Dash_Whoosh. Add stamina pip drain to WB_HUD. Wire IA_Dash to
  the IMC_PlayerDefault Input Mapping Context.
must_read:
  - .claude/INDEX.json
  - docs/DESIGN.md#hud
upstream_handoffs:
  - .claude/handoffs/systems.json            # MUST be status: ready
context:
  task_type: add_widget
  base_sha:  a3f2c91
acceptance:
  - BP_GA_Dash plays NS_DashTrail on ActivateAbility, posts Wwise event Play_Dash_Whoosh
  - WB_HUD Stamina pip drains in real time using GameplayAttribute delegate
  - IA_Dash bound in IMC_PlayerDefault with double-tap modifier
  - PIE: dash works in editor; no log warnings/errors
  - make gate STEP=lint && STEP=test passes for changed BPs
do_not:
  - touch Source/ (eng-gameplay owns C++ ability changes)
  - introduce a new IMC (extend IMC_PlayerDefault)
  - run make gate STEP=all
return:
  - write JSON to .claude/handoffs/content.json
  - emit the same JSON as the final chat message
```
