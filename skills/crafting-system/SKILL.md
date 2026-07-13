---
name: crafting-system
description: Use when a wave needs recipe-driven crafting — DataTable recipes, a crafting component that consumes inventory, station actors that gate recipe sets by GameplayTags, and timed craft completion (ability or timer). Invoke when the design brief says "crafting", "recipes", "workbench/forge/station", "smelting", or when a staffed-station/creature-work differentiator is in scope. Reach for it from a feature wave's design-technical or eng-gameplay role; skip for pure inventory-only features (use `interaction-system`/`pickup-system` instead) and for pure economy/currency sinks (use design-economy's balancing docs, not this skill).
version: "1.0.0"
---

# Crafting System

> Recipes as data, a crafting component that turns inventory + a recipe into a timed craft, station actors that gate which recipes are available and optionally staff themselves via creature-work slots, and server-authoritative completion with seeded quality/byproduct rolls.

## When to use

Invoke when the feature needs any of: a recipe browser/crafting UI, a station actor (forge, workbench, smelter) that restricts recipes, timed craft queues, or autonomous crafting driven by assigned NPCs/creatures. One crafting domain per invocation (e.g. "smithing" vs "cooking" are separate `DT_Recipes_*` tables, same component). Escalate to `/ship` (feature wave) when the recipe unlock is driven by a new tech-progression tree or the craft output feeds a new economy sink — those are systems-surface changes beyond this skill's scope.

## How it works

1. **Recipe data** — author `DT_Recipes_<Domain>` rows per `resources/recipe-tables.md`: inputs, outputs, station tag, craft time, unlock tag.
2. **Crafting component** — add `UCraftingComponent` to the actor that crafts (player or station); it reads the recipe row, validates inventory, and starts the craft.
3. **Station gating** — `AStation` actors expose `StationTag` (`Station.Forge`, `Station.Smelter`) and filter `DT_Recipes_*` rows whose `RequiredStationTag` matches.
4. **Completion path** — pick ability vs timer per the decision rule in `resources/stations-queues.md` (interruptible/boostable → `UGA_Craft`; fire-and-forget → `FTimerHandle` on the component).
5. **Creature-work hook** — stations expose `TArray<FWorkSlot>` that a `creature-work-assignment`-style system fills; a staffed slot ticks the craft queue without a player present (see `resources/stations-queues.md#creature-work`).
6. **Quality/byproducts** — resolve on completion via `FRandomStream` seeded from the world seed + station instance ID, never `FMath::Rand()`. See `resources/recipe-tables.md#quality-rolls`.
7. **Server authority** — craft start/tick/completion are server-only; client only requests and predicts UI state.

## UE5 context

- Modules affected: `Source/<Project>/Public/Crafting/` (`UCraftingComponent`, `AStation`, `UGA_Craft`), `Source/<Project>/Public/Data/` (`UDA_Recipe` row struct)
- Asset paths: `Content/Data/Crafting/DT_Recipes_<Domain>.uasset`, `Content/Crafting/BP_Station_<Name>.uasset`, `Content/UI/WB_RecipeBrowser.uasset`
- Config files: `Config/DefaultGameplayTags.ini` (`Station.*`, `Recipe.Unlocked.*`)

## Resources (read on demand)

- `resources/recipe-tables.md` — `FRecipeRow` struct, DataTable-from-CSV generation via `ue5-editor-python`, unlock-tag wiring to tech-progression, seeded quality/byproduct rolls.
- `resources/stations-queues.md` — `UCraftingComponent` / `AStation` implementation, ability-vs-timer decision rule, craft queue replication, the creature-work staffed-slot hook, recipe-browser UI wiring.

## Output

A wave using this skill delivers: `DT_Recipes_<Domain>` (+ generator script per `ue5-editor-python`), `UCraftingComponent` (C++), `AStation` subclass with `StationTag` and `WorkSlots[]`, either `UGA_Craft` or timer-based completion in the component, and `WB_RecipeBrowser` reading `Recipe.Unlocked.*` tags. `systems_surface[]` entries: `type: "component"` for `UCraftingComponent`, `type: "actor"` for `AStation`, `type: "ability"` for `UGA_Craft` (if used), `type: "data"` for the `DT_Recipes_*` table — `eng-gameplay` exposes the C++ classes and the row struct; `design-technical` wires the DataTable rows, station BP instances, and unlock-tag mapping into `Config/DefaultGameplayTags.ini`. Proven by a Functional Test named `<Project>.Crafting.<Domain>.CompletesAndConsumesInputs` that spawns a station, grants a recipe unlock tag, starts a craft, advances time, and asserts inputs were deducted and outputs (with deterministic quality for a fixed seed) were granted. Cross-reference [[procgen-world]] for the seed/delta-log convention crafting's quality rolls must follow, and the creature-work staffing system (once authored) for `FWorkSlot` fill/vacate events.
