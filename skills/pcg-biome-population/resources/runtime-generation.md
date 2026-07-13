# Runtime PCG Generation — World Partition binding, instancing, budgets

> Read this when wiring biome PCG graphs to World Partition streaming, choosing instancing strategy, or setting per-biome performance ceilings.

---

## The procgen-world handoff contract

[[procgen-world]] owns world seed generation, heightfield authoring, and the biome map (per-cell biome ID + elevation/slope/moisture attributes) plus a region profile (POI locations, road/river network, climate bands). This skill consumes that output and never regenerates it.

Expected handoff shape (`.claude/handoffs/procgen-world.json`, `systems_surface[]` entries this skill reads):

```json
{
  "systems_surface": [
    {
      "type": "subsystem",
      "name": "UWorldGenerationSubsystem",
      "header_path": "Source/<Project>/Public/World/WorldGenerationSubsystem.h",
      "notes": "Exposes GetWorldSeed(), GetBiomeMap(), GetRegionProfile(). Biome population reads, never writes."
    },
    {
      "type": "data_asset",
      "name": "UBiomeMapData",
      "header_path": "Source/<Project>/Public/World/BiomeMapData.h",
      "notes": "Per-cell biome ID + elevation/slope/moisture, keyed by World Partition grid coordinate."
    }
  ]
}
```

`UBiomePopulationSubsystem` (this skill's output) depends on `UWorldGenerationSubsystem` (procgen-world's output) at `Initialize()` time via `GetGameInstance()->GetSubsystem<UWorldGenerationSubsystem>()`/`GetWorld()->GetSubsystem<...>()` — never cache a raw pointer across level transitions, per the subsystem pattern in `agents/_shared/PATTERNS.md#subsystem`.

If procgen-world's biome map for a cell changes (regenerated world, new seed), this skill's cached `bGenerated` state for that cell must be invalidated — treat `(WorldSeed, CellCoord)` as the cache key, not `CellCoord` alone.

---

## Binding to World Partition streaming

PCG generation must run exactly once per cell per seed, on stream-in, and must not re-roll on stream-out/stream-in cycles (that would desync client view vs. server-authoritative state and break the "same seed = same world" guarantee for returning players).

```cpp
// Source/<Project>/Private/World/BiomePopulationSubsystem.cpp
void UBiomePopulationSubsystem::OnWorldPartitionCellStateChanged(
    const UWorldPartitionRuntimeCell* Cell, EWorldPartitionRuntimeCellState NewState)
{
    if (NewState != EWorldPartitionRuntimeCellState::Activated)
    {
        return; // only generate on activation; deactivation just derefs/destroys instances, no PCG re-run
    }

    const FIntPoint CellCoord = ExtractGridCoord(Cell);
    const EBiomeType Biome = WorldGenSubsystem->GetBiomeMap()->GetBiomeAt(CellCoord);
    const int32 CellSeed = ComputeCellSeed(CellCoord, Biome);

    if (GeneratedCells.Contains(CellCoord) && GeneratedCells[CellCoord] == CellSeed)
    {
        return; // already generated this exact (cell, seed) pair — idempotent, do nothing
    }

    UPCGComponent* PCGComp = GetOrCreatePCGComponentForCell(Cell);
    PCGComp->Seed = CellSeed;
    PCGComp->SetGraph(GetGraphForBiome(Biome));
    PCGComp->GenerateLocal(/*bForce=*/false);
    GeneratedCells.Add(CellCoord, CellSeed);
}
```

- Hook `OnWorldPartitionCellStateChanged` via `UWorldPartitionSubsystem::OnRuntimeCellStreamingStateChanged` (or the cell's own load/activate delegates depending on 5.7 API surface — verify against the project's exact World Partition runtime hash grid setup).
- Server-authoritative in multiplayer: the server runs `GenerateLocal()` and the resulting static-mesh/spawn-marker actors replicate down via standard actor replication (or a lightweight replicated instance-list RPC for HISM, since HISM instances themselves are not actors — see below). Clients never independently generate gameplay-relevant instances (resource nodes, spawn points); purely cosmetic biome dressing may run client-only if it never needs to be picked up/harvested/interacted with.
- Deactivation (`NewState == Unloaded`) destroys the `UPCGComponent`'s generated data and any spawned HISM instances for that cell, but leaves `GeneratedCells[CellCoord]` intact so a later re-stream-in is recognized as already-generated and skipped (not regenerated) — unless the seed changed.

---

## Instancing strategy — HISM budget

`UPCGStaticMeshSpawner` must target `Hierarchical Instanced Static Mesh` output mode, never per-point actor spawns, for any category with more than a handful of instances per cell (trees, rocks, ground clutter). One `UHierarchicalInstancedStaticMeshComponent` per (biome, mesh) pair per streaming cell, owned by the cell's PCG component or a pooled `ABiomePopulationVolume`.

Resource nodes (harvestable, interactable) are the exception: they need per-instance game state (harvested/respawn timer), so they spawn as lightweight actors (`ABiomeResourceNode`) rather than HISM instances — but keep their mesh rendering on a shared HISM where the actor only holds gameplay state and a HISM instance index, not its own static mesh component, if the per-cell count is large. Below ~50 interactable nodes per cell, plain actors are fine; above that, split rendering (HISM) from gameplay state (lightweight `UObject` or actor pooled from a fixed-size array).

### Per-biome budget ceilings

Ceilings are DataTable-driven (`FBiomeScatterParamsRow::PerCellInstanceCeiling`, see `resources/pcg-graph-setup.md`) and must respect the global ceilings in `quality/performance-budgets.md`:

| Budget source | Ceiling | Enforcement point |
|---|---|---|
| `performance-budgets.md` — environment static mesh triangles (visible) | ≤ 1,500,000 | Sum of `InstanceCount × TriCount` across all active-cell HISM components must stay under this; check via `stat scenerendering` |
| `performance-budgets.md` — total draw calls | ≤ 1,500 | Each distinct (biome, mesh, LOD) HISM component is ~1 draw call per LOD band visible; keep unique-mesh-per-biome count low, reuse meshes across biomes where art allows |
| This skill's addition | `PerCellInstanceCeiling` per `ScatterCategory` per biome (default 300 for trees/rocks, 50 for resource nodes, 12 for creature spawn markers) | Enforced inside the PCG graph via a `Density Filter` capping output point count before the spawner node — never rely on the spawner silently truncating |

If a biome's natural density (from `DensityPer100Sqm`) would exceed the ceiling for a cell's area, the graph must clamp — clamping happens deterministically (drop points by stable hash order, not random culling) so the same seed always drops the same points.

### Verifying the budget in CI

Add a Functional Test that streams in one cell per biome, reads `HISM->GetInstanceCount()` summed across the cell's biome population components, and asserts it is `<= PerCellInstanceCeiling` from the DataTable — fold this into `make automation-critical` alongside the determinism test described in `SKILL.md`'s Output section.

---

## Regenerating after a build-plot claim

When a player claims a build plot inside an already-generated cell, do not call `GenerateLocal(bForce=true)` on the whole cell (that reseeds everything, breaking determinism for untouched instances near the new plot). Instead:

1. Register the plot's `UPCGExclusionZoneComponent` footprint with `UBiomePopulationSubsystem`.
2. Call a scoped removal (`PCGComp->CleanupLocal` on a partitioned sub-region if the graph is spatially partitioned, or an explicit "remove HISM instances whose transform falls inside the new exclusion bounds" pass using `HISM->RemoveInstances(IndicesToRemove)`).
3. Do **not** re-run the density/spawner nodes for the freed area — it stays empty (a build plot claiming land removes scatter permanently for that claim's lifetime, it does not invite new scatter to fill the gap).

This keeps the seed → scatter mapping stable for everything except the explicitly-claimed footprint, satisfying both the determinism rule and the exclusion-zone rule from `SKILL.md`.
