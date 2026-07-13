---
name: poi-encounters
description: Use when a seed-generated world needs curated points of interest — ruins, camps, dungeon entrances, boss arenas — placed by the region graph with spacing/biome rules, stocked with seeded encounter tables and loot, and tracked as respawn/lockout world deltas. Invoke when the user says "add a POI type", "place dungeon entrances", "wire boss arena encounters", "add a loot table for ruins/camps", or "gate a POI behind danger tier". Reachable from eng-gameplay (placement subsystem, encounter director) and design-technical (archetype/encounter DataTable tuning). Not for volume scatter (foliage, rocks, ambient resource nodes) — use [[pcg-biome-population]] for that; POIs are curated, hand-tuned, and individually significant.
version: "1.0.0"
---

# POI Encounters

> Curated points of interest — ruins, camps, dungeon entrances, boss arenas — are `UDA_POIArchetype` Data Assets placed by the [[procgen-world]] region graph via Poisson-disc + suitability mask, deterministic per seed. Each POI rolls a seeded `DT_EncounterTable` on entry, hands loot to [[resource-gathering]]/`inventory-system`, and tracks depletion/respawn as world deltas — never as baked level state.

## When to use

Invoke after `procgen-world` has produced a region graph (biome + danger tier per region) and after `pcg-biome-population` (if used) has scattered volume content — POIs sit on top of both as sparse, significant, individually-tuned locations. One archetype (e.g. `DA_POI_BanditCamp`) or one encounter table per invocation; batch a tier ladder (camp tiers 1-3) in one pass if they share a schema. Escalate to `/ship` if this is the first POI system in a project (placement subsystem + encounter director + delta-log hookup all at once — multi-surface). Use `/fix` for a single new archetype or table row in an existing system. Skip for ambient/volume content (trees, ore, wildlife density) — that's `pcg-biome-population`.

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **POI archetype data** — define `UDA_POIArchetype` (type, prefab reference, suitability rules, danger tier, spawn weight) per `resources/poi-placement.md`. Content is either a `ALevelInstance` prefab or an editor-Python-assembled composition (see `ue5-editor-python`) — never hand-placed actors.
2. **Placement** — a `UPOIPlacementSubsystem` samples Poisson-disc candidates per region, filters through a suitability mask (biome, slope, min-spacing from other POIs, region danger tier), and seeds each accepted placement from `Hash(WorldSeed, RegionID, POISlotIndex)`. Detail in `resources/poi-placement.md`.
3. **Level Instance streaming** — POI interiors load via `ULevelInstanceSubsystem` on approach and unload on exit; exterior POI markers are lightweight until then. Detail in `resources/poi-placement.md`.
4. **Encounter tables** — `DT_EncounterTable` keyed by `(POIType, DangerTier)` rolls spawn composition on entry via the POI's own `FRandomStream`, per `resources/encounter-tables.md`.
5. **Loot & the reward loop** — encounter victory rolls loot through `resource-gathering`'s yield-table pattern into `IInventoryReceiver`/`UInventoryComponent::TryAddItems`; a share of the roll also grants tech-progression currency via the project's progression subsystem. Detail in `resources/encounter-tables.md`.
6. **Respawn/lockout as world deltas** — POI state (`Cleared` / `Looted` / `Respawning`) is an `FPOIStateDelta` appended to the [[procgen-world]] delta log, replayed on load — never saved as full actor/level state.
7. **Navmesh bounds** — a runtime `ANavModifierVolume`/dynamic nav bounds volume is spawned around each POI on placement (not baked), sized to the archetype's interior footprint. Detail in `resources/poi-placement.md`.
8. **Multiplayer** — if `project.config.json` sets `networking != single-player`, placement rolls, encounter rolls, and loot/state mutation are server-only; clients receive replicated actor spawns and delta acks, never roll locally.
9. **Verify** — regenerate a seed twice, confirm identical POI placement list (position + archetype) and identical encounter roll for a fixed POI; clear a POI, save/reload, confirm it stays cleared; confirm respawn timer/event fires correctly after lockout window.

## UE5 context

- Modules affected: `Source/<Project>/Public/World/POI/` (`UPOIPlacementSubsystem`, `APOIVolume`, `UPOIEncounterComponent`), `Source/<Project>/Public/Data/` (`UDA_POIArchetype`), `Source/<Project>Tests/` (placement + respawn Functional Tests).
- Asset paths: `Content/World/POI/DA_POI_*` (archetypes), `Content/World/POI/LI_*` (Level Instances), `Content/Data/DT_EncounterTable_*`, `Content/World/POI/BP_Boss_*`.
- Config files: `Config/DefaultGameplayTags.ini` (`POI.*`, `Encounter.*` tags), `project.config.json` (`worldgen.poi_min_spacing`, danger-tier curve reference).
- Interlocks: [[procgen-world]] (region graph input + delta log), [[pcg-biome-population]] (shares exclusion-zone data so scatter never overlaps a POI footprint), [[resource-gathering]] (yield-table/loot pattern), `inventory-system` (loot destination), `ue5-editor-python` (Level Instance / composition generator scripts), `gas-ability` (boss-arena encounters that grant abilities use its conventions).

## Resources (read on demand)

- `resources/poi-placement.md` — `UDA_POIArchetype` schema, Poisson-disc + suitability mask placement algorithm, seed derivation, Level Instance streaming, runtime navmesh bounds.
- `resources/encounter-tables.md` — `DT_EncounterTable` schema, seeded encounter rolls per danger tier, loot handoff, respawn/lockout delta schema, tech-progression reward hookup.

## Output

A wave run using this skill delivers: `UDA_POIArchetype` instance(s), `UPOIPlacementSubsystem` (or confirmation an existing one is reused), `DT_EncounterTable` row(s), the `POI.*`/`Encounter.*` tag entries, and a `systems_surface[]` handoff (see below) written to `.claude/handoffs/systems.json`.

`systems_surface[]` entry types this skill produces (for `eng-gameplay`):
- `type: "subsystem"` — `UPOIPlacementSubsystem` (placement), `UPOIEncounterDirector` (roll + spawn + lockout)
- `type: "actor"` — `APOIVolume` (marker + trigger), `ALevelInstance` prefab wrappers
- `type: "component"` — `UPOIEncounterComponent` (per-POI state, cleared/respawning)
- `type: "data_asset"` — `UDA_POIArchetype` and its instances
- `type: "effect"` — reward `GameplayEffect`s if boss-arena victories grant buffs/tags directly

`design-technical` wires: `DT_EncounterTable` rows (spawn composition per tier), suitability-mask tuning (spacing, biome weights) on archetype instances, and respawn/lockout window values.

Proven by `<Project>.World.POI.PlacementDeterministic` (regenerate a fixed seed twice, assert identical POI position/archetype list) and `<Project>.World.POI.RespawnLockoutPersists` (clear a POI, save/reload, assert `Cleared` state survives and the respawn timer does not fire early), both gating `make automation-critical`.
