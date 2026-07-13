---
name: production-chains
description: Use when a wave needs Anno-style production buildings and multi-step goods chains — producer-node buildings that turn input goods into output goods over a process time, chains composed by data (ore → ingot → tools), throughput/ratio balancing, and cross-region transport driven by procgen fertility scarcity. Invoke when the design brief says "production chain", "factory building", "economy layer", "trade route", "supply chain", or when a civ/economy-shaped project needs settlement-level goods flow beyond a single player's crafting station. Reach for it from a feature wave's design-economy or eng-gameplay role. Skip for single-actor player crafting (use `crafting-system`) and for raw node harvesting (use `resource-gathering`) — this skill is what consumes their output at settlement scale.
version: "1.0.0"
---

# Production Chains

> Production buildings are data-defined producer nodes: input goods + process time → output goods, one `DT_ProductionRecipes` row per recipe. Chains emerge from composing rows (ore → ingot → tools), not from bespoke per-building code. Buffers are `UInventoryComponent` instances; transport moves goods between buildings; region fertility from procgen-world gates which chains a region can run locally, forcing trade. Ticks run coarse and server-side — never per-frame, never per-actor `Tick()`.

## When to use

Invoke when a feature needs settlement/civ-scale goods production: a chain of two or more building types where one's output is another's input, throughput balancing across a chain, or transport routes moving goods between producers. One chain *family* per invocation (e.g. "ore→ingot→tools" is one pass; "grain→flour→bread" is a separate pass reusing the same building/recipe classes). Escalate to `/ship` (feature wave) when this is the first production pass on a project — new `UProductionComponent` + recipe schema + settlement tick subsystem is multi-surface. Use `/fix` for adding one recipe row or one building instance to an existing chain. Skip entirely for single-player-only crafting with no building network (`crafting-system` covers that) and for pure resource extraction with no processing step (`resource-gathering` covers that).

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Recipe & building data** — author `DT_ProductionRecipes` rows (inputs, outputs, process time, required building tag) and `UDA_ProductionBuilding` (buffer sizes, worker slots, base cycle rate) per `resources/chain-graphs.md#data`. Chains are composed by pointing recipe outputs at the next recipe's inputs — never hardcoded in C++.
2. **Producer component** — `UProductionComponent` on the building actor owns input/output `UInventoryComponent` buffers, reads its assigned recipe, and advances a cycle timer on a coarse settlement tick (see `resources/logistics.md#tick`) — not `Tick()`.
3. **Throughput balancing** — validate chain ratios against the classic 2:1:1 cycle-time pattern before greenlighting content per `resources/chain-graphs.md#throughput-math`.
4. **Fertility gating** — query the region's fertility/resource profile from `UWorldGenSubsystem` (`[[procgen-world]]`) before allowing a building's recipe to be assigned; a region without the fertility tag cannot run that chain locally, which is the designed scarcity that forces trade. See `resources/chain-graphs.md#fertility-gating`.
5. **Transport** — pick creature carriers (`Work.Transport` slot via `[[creature-work-assignment]]`) or player-built logistics (paths/carts via `[[building-system]]`) per project; both move `FInventoryEntry` batches between two buildings' buffers on the same coarse tick. See `resources/logistics.md#transport`.
6. **Efficiency modifiers** — worker aptitude, weather/season, and settlement happiness scale cycle time or output count as multipliers applied at tick time, never baked into the recipe row. See `resources/logistics.md#efficiency-modifiers`.
7. **Server authority & determinism** — all buffer mutation and cycle advancement happens server-side; any randomness (byproduct rolls, aptitude variance) draws from an `FRandomStream` seeded `(WorldSeed, BuildingInstanceID, TickIndex)`, never `FMath::Rand()`. See `resources/logistics.md#determinism`.
8. **Verify** — assign a two-step chain (ore→ingot→tools) across three buildings, advance the settlement tick, confirm buffers fill/drain at the balanced ratio, confirm a fertility-gated region rejects an unsupported recipe, confirm a save/reload round-trips in-flight buffer state and transport-in-progress batches.

## UE5 context

- Modules affected: `Source/<Project>/Public/Economy/` (`UProductionComponent`, `USettlementTickSubsystem`, transport actors), `Source/<Project>/Public/Data/` (`UDA_ProductionBuilding`, `FProductionRecipeRow`), `Source/<Project>Tests/` (throughput + fertility-gating Functional Tests).
- Asset paths: `Content/Data/Economy/DT_ProductionRecipes_<Domain>.uasset`, `Content/Economy/BP_Building_<Name>.uasset`, `Content/Economy/BP_Transport_<Cart|Carrier>.uasset`.
- Config files: `Config/DefaultGameplayTags.ini` (`Building.<Type>`, `Fertility.<Resource>`, `Work.Transport`).

## Resources (read on demand)

- `resources/chain-graphs.md` — `FProductionRecipeRow`/`UDA_ProductionBuilding` schemas, `ue5-editor-python` DataTable-from-CSV generation, throughput/ratio math (2:1:1 pattern), fertility-gating query against `UWorldGenSubsystem`.
- `resources/logistics.md` — `UProductionComponent` and `USettlementTickSubsystem` C++ templates (coarse server tick, never per-frame), buffer wiring to `UInventoryComponent`, creature-carrier vs player-built transport decision + implementation, efficiency-modifier stacking (aptitude/weather/happiness), determinism and save/replication notes.

## Output

A wave using this skill delivers: `DT_ProductionRecipes_<Domain>` (+ generator script per `ue5-editor-python`), `UDA_ProductionBuilding` (Primary Data Asset), `UProductionComponent` (C++, attached to building actors), `USettlementTickSubsystem` (or equivalent coarse-tick driver) advancing all producers on a shared cadence, and at least one transport implementation (creature-carrier work slot or player-built cart/path). `systems_surface[]` entries: `type: "data"` for the recipe table and building Data Asset, `type: "component"` for `UProductionComponent`, `type: "subsystem"` for the settlement tick driver — `eng-gameplay` exposes the C++ classes and row struct; `design-economy`/`design-technical` wire recipe rows, building BP instances, fertility tags, and chain ratios. Proven by a Functional Test named `<Project>.Economy.ProductionChain.<Domain>.BalancesThroughput` that assigns a multi-step chain across linked buildings, advances the settlement tick a fixed number of cycles, and asserts output counts match the expected ratio while a fertility-ungated region's assignment attempt is rejected server-side. Cross-reference [[procgen-world]] for the seed/delta-log and region-fertility convention this skill's placement and randomness build on, [[inventory-system]] for the buffer container this skill wraps, and [[crafting-system]] for the single-actor recipe pattern this skill scales to settlement level.
