---
name: pcg-biome-population
description: Use when a wave needs to scatter deterministic, seed-reproducible content (trees, rocks, foliage, resource nodes, creature spawn points) across generated terrain — building or tuning per-biome PCG graphs, binding PCG generation to World Partition streaming, or defining spawn-free exclusion zones around POIs/build plots. Invoke when the user says "populate the biome", "scatter resources", "add creature spawn points", "tune foliage density", or "wire PCG to world streaming". Reachable from eng-gameplay (graph/subsystem authoring) and design-technical (DataTable tuning).
version: "1.0.0"
---

# PCG Biome Population

> Per-biome PCG graphs that scatter static meshes, resource nodes, and creature spawn markers deterministically from the world seed, streamed in/out with World Partition, and tuned by designers through DataTables — never by hand-editing the graph.

## When to use

Invoke after [[procgen-world]] has produced a biome map and region profile (heightfield + biome ID per cell). Use this skill to turn that map into actual scattered instances: foliage, rocks, harvestable resource nodes, and AI spawn markers. Skip when the content is hand-placed (hero POIs, quest set-dressing) — PCG is for volume population, not curated placement.

## How it works

1. **Read the handoff** — consume `procgen-world`'s biome map (per-cell biome ID, elevation, slope, moisture) and region profile from its handoff file. PCG graphs never invent biome data; they consume it.
2. **One PCG graph per biome** — build/extend `PCG_Biome_<BiomeName>` per `resources/pcg-graph-setup.md`, driven by a `UPCGSeedSource` node keyed off `WorldSeed + CellCoordinate` so every rerun with the same seed reproduces identical scatter.
3. **Density and exclusion rules** — layer `Density Filter` / `Difference` nodes against exclusion-zone data (POI radius, build-plot footprints) so nothing spawns where it shouldn't. Detail in `resources/pcg-graph-setup.md`.
4. **Bind to World Partition streaming** — attach `UPCGComponent` to World Partition grid actors (or a dedicated `ABiomePopulationVolume`) so generation runs per-cell on stream-in and is discarded (not re-rolled) on stream-out. Detail in `resources/runtime-generation.md`.
5. **Instance efficiently** — output through `UPCGStaticMeshSpawner` targeting HISM, budgeted per biome. Detail in `resources/runtime-generation.md`.
6. **Expose tuning to design** — scatter density, exclusion radii, and per-biome instance ceilings live in `DT_BiomeScatterParams`, read by the graph via `UPCGDataTableElement` / a `UBiomeScatterProfile` Data Asset. Designers never open the graph.
7. **Verify** — regenerate the same seed twice, diff instance transforms (must match exactly); regenerate with a different seed, confirm distribution differs but stays within per-biome budget.

## UE5 context

- Modules affected: `Source/<Project>/Public/World/` (biome population subsystem, exclusion component), `Source/<Project>/Public/Data/` (scatter profile Data Assets)
- Plugin: `PCG` (engine, enable in `.uproject`), requires World Partition enabled on the world
- Asset paths: `Content/World/PCG/PCG_Biome_<Name>.uasset`, `Content/Data/DT_BiomeScatterParams.uasset`, `Content/Data/DA_BiomeScatterProfile_<Name>.uasset`
- Config files: `Config/DefaultEngine.ini` (`PCG` plugin flag, World Partition runtime grid settings)

## Rules

- **Deterministic by seed** — every random node in a biome graph derives from `WorldSeed` + stable cell/region coordinate, never `FMath::Rand()` or wall-clock time. Same seed + same biome map = byte-identical scatter, always.
- **Server-authoritative in multiplayer** — if `networking = multiplayer`, PCG generation and the resulting spawn-point/resource-node actor list are authoritative on the server only; clients receive replicated actor spawns, never run their own PCG pass for gameplay-relevant instances (cosmetic foliage may run client-side).
- **Graphs stay data-driven** — density, exclusion radius, per-biome budget are DataTable/Data Asset inputs, not baked graph constants. See `resources/pcg-graph-setup.md`.
- **HISM everywhere for static scatter** — never `UInstancedStaticMeshComponent` per-actor spawns for foliage/rocks at scale; see `resources/runtime-generation.md` for the perf budget mapping.
- **Creature spawn points are markers, not creatures** — PCG outputs `FPCGPoint` data tagged with a spawn-table ID; a separate AI/encounter subsystem consumes the point list and spawns actual pawns. PCG never spawns `APawn` directly.

## Resources (read on demand)

- `resources/pcg-graph-setup.md` — per-biome graph structure, seed binding, density/exclusion node chains, DataTable-driven tuning
- `resources/runtime-generation.md` — World Partition streaming binding, HISM output, per-biome perf budgets, the `procgen-world` handoff contract

## Output

A wave using this skill delivers: one `UPCGGraphInterface` asset per biome under `Content/World/PCG/`, a `UBiomePopulationSubsystem` (or `ABiomePopulationVolume`) C++ class binding PCG generation to World Partition cell stream-in/out, an exclusion-zone component consumed by POI/build-plot placement, and `DT_BiomeScatterParams` for design tuning. The `systems_surface[]` handoff entries are `type: "subsystem"` (`UBiomePopulationSubsystem`), `type: "component"` (`UPCGExclusionZoneComponent`), and `type: "data_asset"` (`UBiomeScatterProfile`, `DT_BiomeScatterParams`) — eng-gameplay owns the C++ subsystem/component; design-technical owns the DataTable rows. Proven by a Functional Test that regenerates a fixed seed twice in the same cell and asserts identical instance transform counts and positions, plus a perf test asserting HISM instance count stays under the per-biome ceiling from `quality/performance-budgets.md`.
