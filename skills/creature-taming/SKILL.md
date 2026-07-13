---
name: creature-taming
description: Use when a survival/crafting/civilization project needs capturable creatures — species defined as Primary Data Assets, a GAS-driven weaken-then-throw-device capture ability chain with a seeded roll, a player-owned roster (party + base assignment), and loyalty/hunger vitals on tamed creatures. Invoke when the user says "add creature taming", "let players capture monsters", "wire up a capture device", "add a roster/party system", or "breed creatures". Reachable from eng-gameplay (C++ ability/roster/attribute authoring) and design-technical (species Data Asset tuning). Not limited to Palworld/Anno-shaped games — any project with capturable/tameable creatures.
version: "1.0.0"
---

# Creature Taming

> Species defined as `UDA_CreatureSpecies` Primary Data Assets (GAS attribute defaults, work aptitudes, capture difficulty, biome spawn weights). Capture is a three-step GAS ability chain (weaken → throw device → seeded roll) resolved server-side. Captured creatures move from wild AI into a server-owned `UCreatureRosterComponent` (party + base assignment), tracked by `UCreatureLoyaltyAttributeSet` (Loyalty, Hunger) alongside their combat/species attributes.

## When to use

Invoke for any project with a capture/tame mechanic — the creature can be combat-weakened and converted from wild AI into a player-controlled unit. Covers species data, the capture ability chain, the roster/ownership handoff, and loyalty/hunger vitals. For wild-creature combat/patrol behavior before capture, use `enemy-ai-behavior-tree` — this skill only owns the capture moment and everything after. For what a tamed creature *does* once assigned to a base (gathering, crafting stations), use `creature-work-assignment` (assumed sibling skill; not yet authored — this skill's roster handoff is written to be consumed by it). For general vitals patterns (hunger/thirst as GAS attributes), mirror `survival-stats` but do not reuse its AttributeSet — creature loyalty/hunger is a separate set owned by the creature actor, not the player. Escalate to `/ship` if taming requires a new base-building placement system beyond assignment bookkeeping.

## How it works

1. **Species data** — create `UDA_CreatureSpecies` Primary Data Assets per `resources/creature-data.md`: base GAS attribute defaults, `WorkAptitudes[]` (gameplay-tag-keyed float array), `CaptureDifficulty` curve, and per-biome spawn weight consumed by `pcg-biome-population`'s spawn-marker tables.
2. **Attribute sets** — add `UCreatureCombatAttributeSet` (Health, Stamina — mirrors species defaults) and `UCreatureLoyaltyAttributeSet` (Loyalty, Hunger) to every creature pawn's `UAbilitySystemComponent`. Detail in `resources/creature-data.md`.
3. **Capture ability chain** — build the three-link GAS chain (`GA_Creature_Weaken` consumer-side damage tracking → `GA_ThrowCaptureDevice` → `GA_CaptureResolve` seeded roll vs remaining Health%) per `resources/capture-flow.md`. The roll is server-only and seeded from `WorldSeed + CreatureInstanceID + AttemptCount`.
4. **Roster handoff** — on successful capture, the server despawns the wild pawn (or reparents its AI controller) and inserts a `FCreatureRosterEntry` into the capturing player's `UCreatureRosterComponent` (party slots + base-assignment slots). Detail in `resources/capture-flow.md#roster-handoff`.
5. **AI handoff** — wild creatures run `enemy-ai-behavior-tree`'s `AEnemyAIController` + `BT_Creature_<Species>`. On capture, swap to a tamed `AI Controller`/BB set understood by `creature-work-assignment`; this skill only performs the handoff, not the tamed behavior itself.
6. **Breeding (optional)** — seeded trait inheritance for two roster creatures producing an egg/offspring Data Asset instance; only build if the project's design calls for it. Detail in `resources/creature-data.md#breeding`.
7. **Verify** — Functional Tests per `resources/capture-flow.md#tests` prove: capture roll is deterministic for a fixed seed, roster insertion is server-authoritative, and loyalty/hunger drain matches `survival-stats`' periodic-effect pattern.

## Rules

- **GAS for every capture step and every vital.** No hand-rolled "capture chance" float compare in Blueprint, no `Tick()`-based hunger/loyalty drain — weaken/throw/resolve are `UGameplayAbility`s, loyalty/hunger drain via `Infinite` `UGameplayEffect`s with `Period`, same pattern as `survival-stats`.
- **Deterministic by seed.** The capture roll and any breeding trait-inheritance roll derive from `WorldSeed + CreatureInstanceID (+ AttemptCount / ParentIDs)`, never `FMath::Rand()` or wall-clock time. Re-running the same seed against the same encounter state reproduces the identical capture outcome.
- **Server-authoritative.** `GA_CaptureResolve` runs `NetExecutionPolicy::ServerInitiated`; the roll, the roster mutation, and the wild-pawn despawn all happen on the server. Clients only predict cosmetic feedback (device throw animation, capture-orb VFX) — never the pass/fail outcome.
- **Roster is server-owned state**, replicated to the owning client only (`COND_OwnerOnly` on `UCreatureRosterComponent`'s array). Party-slot and base-assignment mutations go through validated Server RPCs, never direct client writes.
- **Species data is data, not code.** Capture difficulty, work aptitudes, spawn weights all live in `UDA_CreatureSpecies` — programmers add fields, designers tune values. Never hardcode a species' capture odds in C++.

## Resources (read on demand)

- `resources/creature-data.md` — `UDA_CreatureSpecies` Primary Data Asset schema (attribute defaults, `WorkAptitudes[]`, `CaptureDifficulty`, biome spawn weights), the `UCreatureCombatAttributeSet`/`UCreatureLoyaltyAttributeSet` C++, and the optional breeding/trait-inheritance design.
- `resources/capture-flow.md` — the `GA_Creature_Weaken` → `GA_ThrowCaptureDevice` → `GA_CaptureResolve` ability chain C++, the seeded capture-roll formula, the roster handoff (`UCreatureRosterComponent`, `FCreatureRosterEntry`, party/base assignment), the wild→tamed AI controller swap, and the Functional Test specs.

## UE5 context

- Modules affected: `Source/<Project>/Public/Creatures/` (species Data Asset, attribute sets, roster component), `Source/<Project>/Public/Abilities/Creatures/` (capture ability chain), `Source/<Project>Tests/` (Functional Tests)
- Asset paths: `Content/Data/Creatures/DA_Creature_<Species>.uasset`, `Content/GAS/Abilities/Creatures/`, `Content/GAS/Effects/Creatures/` (loyalty/hunger drain), `Content/Characters/Creatures/BP_Creature_<Species>.uasset`
- Config files: `Config/DefaultGameplayTags.ini` (`Ability.Creature.*`, `State.Creature.Weakened`, `Creature.WorkAptitude.*` tags)

## Output

A wave run using this skill delivers: `UDA_CreatureSpecies` Primary Data Assets per species, `UCreatureCombatAttributeSet` + `UCreatureLoyaltyAttributeSet` (C++), the `GA_Creature_Weaken`/`GA_ThrowCaptureDevice`/`GA_CaptureResolve` ability chain, `UCreatureRosterComponent` with server-validated party/base-assignment RPCs, and the wild→tamed AI controller handoff wired to `enemy-ai-behavior-tree` on the wild side and ready for `creature-work-assignment` on the tamed side.

**`systems_surface[]` entries this skill produces** (written to `.claude/handoffs/systems.json` by `eng-gameplay`):
- `type: "data_asset"` — `UDA_CreatureSpecies` (per species instance), `blueprint_consumers: ["BP_Creature_<Species>", "PCG_Biome_<Name>"]` (spawn weight consumed by `pcg-biome-population`).
- `type: "attribute"` — `Health`, `Stamina` (combat set), `Loyalty`, `Hunger` (loyalty set), `header_path` → the two AttributeSet headers, `replication: "server"` with `COND_OwnerOnly` on Loyalty/Hunger.
- `type: "ability"` — `GA_Creature_Weaken`, `GA_ThrowCaptureDevice`, `GA_CaptureResolve`, `gameplay_tags: ["Ability.Creature.Capture", "State.Creature.Weakened"]`, `replication: "server"`.
- `type: "component"` — `UCreatureRosterComponent`, `blueprint_consumers: ["BP_PlayerState", "WB_RosterMenu"]`, `replication: "server"` (owner-conditional array).

`design-technical` owns `DA_Creature_<Species>` tuning (attribute defaults, capture difficulty curve, work aptitudes, spawn weights); `eng-gameplay` owns the C++ ability chain, attribute sets, and roster component. Proven by `Creature.Capture.SeededRoll.SameSeedSameOutcome` (deterministic roll), `Creature.Capture.ServerAuthoritative.ClientCannotForceSuccess`, and `Creature.Roster.Assignment.RejectsUnownedCreature` Functional Tests — see `resources/capture-flow.md#tests` for the full list.
