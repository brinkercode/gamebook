# PCG Graph Setup — per-biome scatter graphs

> Read this when authoring or editing a `PCG_Biome_<Name>` graph: seed binding, density/exclusion node chains, and how design tunes scatter via DataTable without touching the graph.

---

## Graph naming and ownership

One `UPCGGraphInterface` asset per biome: `PCG_Biome_Forest`, `PCG_Biome_Tundra`, `PCG_Biome_Wetland`, etc., under `Content/World/PCG/`. A shared `PCG_Biome_Base` subgraph holds the common node chain (seed binding → surface sample → exclusion filter → DataTable lookup → spawner); per-biome graphs are thin subgraph instances that swap the mesh/spawn-table inputs. This mirrors the "systems in C++, content thin" rule — the base subgraph is the reviewed system, per-biome variants are content.

Never hand-tune density/exclusion values inside a graph node. Every numeric knob a designer might touch is a DataTable row or Data Asset field feeding into the graph as an input pin.

---

## Seed binding — deterministic by construction

Every biome graph's entry point is a `UPCGSeedSource` (or a custom `PCGSettings` wrapping one) that derives its seed from:

```
CellSeed = HashCombine(WorldSeed, CellCoordinate.X, CellCoordinate.Y, BiomeID)
```

- `WorldSeed` comes from the world's save/session state — the same value [[procgen-world]] used to generate the biome map. Read it from the `UWorldGenerationSubsystem` (or equivalent exposed by procgen-world's handoff), never regenerate or reseed it locally.
- `CellCoordinate` is the World Partition grid cell (or PCG partition actor) coordinate, so adjacent cells get different but stable seeds.
- `BiomeID` is folded in so overlapping biome graphs sampling the same cell edge don't correlate.
- Every `Random Point` / jitter / density-noise node inside the graph reads `Seed` from the graph's `ExecutionSource`/`PCGComponent` seed, propagated from `CellSeed` above — never from `FMath::Rand()`, `FMath::RandRange()`, or system time. A graph with an unseeded random node is a bug: two runs on the same seed must produce byte-identical output.

```cpp
// Source/<Project>/Public/World/BiomePopulationSubsystem.h
UCLASS()
class MYGAME_API UBiomePopulationSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    // Called on World Partition cell stream-in (see runtime-generation.md)
    void GenerateCell(const FIntPoint& CellCoord, EBiomeType BiomeType);

protected:
    int32 ComputeCellSeed(const FIntPoint& CellCoord, EBiomeType BiomeType) const
    {
        const int32 WorldSeed = GetWorldGenerationSubsystem()->GetWorldSeed();
        return HashCombine(HashCombine(GetTypeHash(WorldSeed), GetTypeHash(CellCoord)),
                            GetTypeHash(static_cast<uint8>(BiomeType)));
    }
};
```

Set the computed seed on the `UPCGComponent` (`PCGComponent->Seed = ComputeCellSeed(...)`) before calling `Generate()` / `GenerateLocal()`. `bGenerated` must key off `(CellCoord, CellSeed)` so a re-stream of the same cell with the same seed is a no-op regenerate, not a re-roll.

---

## Density and exclusion node chain

Standard chain inside `PCG_Biome_Base`:

1. **Surface sample** — `UPCGSurfaceSamplerSettings` against the landscape/heightfield, filtered by biome mask input (from procgen-world's biome map, sampled as a `PCGVolumeSampler` or landscape layer weight).
2. **Attribute filter** — slope/elevation/moisture thresholds per biome (e.g. no trees above 60° slope) read from `DT_BiomeScatterParams` row fields, applied via `Attribute Filter` / `Density Filter` nodes.
3. **Exclusion difference** — a `Difference` node subtracts geometry supplied by exclusion-zone data:
   - POI exclusion: every placed POI actor carries a `UPCGExclusionZoneComponent` (radius + falloff) that registers its footprint with the biome population subsystem before generation runs on the containing cell.
   - Build-plot exclusion: player-claimed build plots register the same way at claim-time; the subsystem must be able to regenerate a cell's scatter after a plot is claimed (see runtime-generation.md for the "remove instances in region" path — never a full cell regenerate against a *different* seed, or you break determinism for the untouched area).
4. **Density noise** — `Density Noise` / `Transform Points` nodes for jitter, scale variance, rotation — seeded per point index from `CellSeed`, so per-instance variance is also reproducible.
5. **DataTable lookup** — a `Get Data Table Row` (or custom `PCGSettings` subclass wrapping `UDataTableFunctionLibrary`) resolves the biome's `FBiomeScatterParamsRow` for density-per-100m², min/max spacing, and mesh/spawn-table selection weights.
6. **Spawner** — `UPCGStaticMeshSpawner` (static scatter: trees, rocks, resource nodes) or a custom `UPCGSpawnMarkerSettings` element (creature spawn points — emits `FPCGPoint` data tagged with a spawn-table ID, does **not** spawn a pawn).

```cpp
// Source/<Project>/Public/Data/BiomeScatterParamsRow.h
USTRUCT(BlueprintType)
struct FBiomeScatterParamsRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere) FName BiomeID;
    UPROPERTY(EditAnywhere) FName ScatterCategory;      // "Tree", "Rock", "ResourceNode", "CreatureSpawn"
    UPROPERTY(EditAnywhere) float DensityPer100Sqm = 4.f;
    UPROPERTY(EditAnywhere) float MinSpacingCm = 250.f;
    UPROPERTY(EditAnywhere) float MaxSlopeDegrees = 45.f;
    UPROPERTY(EditAnywhere) TSoftObjectPtr<UStaticMesh> Mesh;   // unused for CreatureSpawn rows
    UPROPERTY(EditAnywhere) FName SpawnTableID;                  // used only for CreatureSpawn rows
    UPROPERTY(EditAnywhere) int32 PerCellInstanceCeiling = 300;  // ties to performance-budgets.md
};
```

## Design tuning without touching the graph

Design-technical edits `DT_BiomeScatterParams` rows (density, spacing, slope limits, per-cell ceilings) and swaps mesh soft references — no graph reopen, no recompile. The graph re-evaluates the DataTable lookup on every regenerate, so a CSV edit + `make asset-gen` (or a live PIE regenerate) is the entire tuning loop. Never expose graph-internal constants as the tuning surface; if a designer needs a new tunable, add a `FBiomeScatterParamsRow` field and wire it into the graph once — after that it's data.

## Creature spawn points

`ScatterCategory == "CreatureSpawn"` rows produce `FPCGPoint` data with `SpawnTableID` set as a point attribute, not a mesh instance. A separate encounter/AI subsystem (outside this skill's scope — see the AI/encounter skill for the project) reads the point list from `UBiomePopulationSubsystem::GetSpawnPointsForCell()` and performs the actual `SpawnActor<APawn>` server-side. This keeps PCG's job purely "where," never "what happens" — determinism of *placement* is this skill's contract; determinism of *creature behavior* is the AI system's.
