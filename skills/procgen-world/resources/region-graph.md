# Region Graph

> Before any noise runs, the world is partitioned at kilometer scale into a region graph. Each region gets a biome archetype and a resource/fertility profile with **deliberate scarcity** — no single region can sustain a player or settlement alone. This is the Anno economic-geography lesson applied to a Palworld-shaped base-building loop: trade, logistics, and expansion exist because the map forces them to.

## Why region-first, not noise-first

If biome is decided purely by local elevation/moisture noise, you get plausible-looking terrain but no macro economic structure — iron might spawn next to every settleable valley, and the "civilization" half of the game has nothing to build tension around. Region-first generation fixes the macro layout deliberately, then lets noise fill in local detail *inside* the constraints the region already set.

```
Region Graph (km scale)  →  Elevation/Moisture/Temp noise (per chunk)  →  Biome lookup  →  Feature placement
      ^ deliberate                    ^ organic detail                       ^ derived        ^ derived
```

## `UWorldGenSubsystem` region API

```cpp
// Source/<Project>/Public/WorldGen/WorldGenSubsystem.h
USTRUCT(BlueprintType)
struct FRegionProfile
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) FIntPoint RegionCoord;      // km-scale grid coordinate
    UPROPERTY(BlueprintReadOnly) FGameplayTag BiomeArchetype; // Biome.Tundra, Biome.Savanna, Biome.Wetland...
    UPROPERTY(BlueprintReadOnly) TMap<FGameplayTag, float> ResourceAbundance; // Resource.Iron -> 0..1, sparse map
    UPROPERTY(BlueprintReadOnly) float FertilityScore = 0.f;  // 0..1, drives farmable-tile density
    UPROPERTY(BlueprintReadOnly) TArray<FIntPoint> AdjacentRegions;
};

UCLASS()
class MYGAME_API UWorldGenSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category = "WorldGen")
    void InitializeWorld(int64 InWorldSeed);

    UFUNCTION(BlueprintCallable, Category = "WorldGen")
    FRegionProfile GetRegionProfile(FIntPoint RegionCoord) const;

    UFUNCTION(BlueprintCallable, Category = "WorldGen")
    FIntPoint WorldPositionToRegion(FVector WorldPos) const;

private:
    int64 WorldSeed = 0;
    TMap<FIntPoint, FRegionProfile> RegionCache; // lazily populated, never persisted (see delta-saves.md)
    FRegionProfile GenerateRegionProfile(FIntPoint RegionCoord) const;
};
```

`GenerateRegionProfile` is pure — same `(WorldSeed, RegionCoord)` always yields the same `FRegionProfile`. It is never written to a save file; it is recomputed from the seed every time (see `resources/delta-saves.md`).

## Building the graph

1. **Voronoi/Poisson seed points at region scale.** Scatter region-center points with a Poisson-disc process (min spacing ~1-2km) seeded via `WorldGenHash::MakeStream(WorldSeed, 0, 0, ELayer::RegionAssignment)` — a single global stream is *correct* here because region placement is one whole-map operation, not a per-chunk one. Assign each region a coordinate id from a coarse grid over those points.
2. **Macro noise pass over region centers only** (continent-scale elevation/latitude/moisture, very low frequency) decides each region's rough climate band — this is a *separate*, coarser noise pass from the per-chunk elevation noise in `resources/chunk-pipeline.md`, evaluated once per region center, not once per chunk.
3. **Biome archetype lookup** from climate band via a `UDataTable` (`DT_RegionArchetypes`) — same Whittaker-style axes as the chunk-level biome lookup, but at region granularity, e.g. `(Latitude, MacroMoisture) → Biome.Tundra`.
4. **Resource/fertility assignment — the scarcity pass.** This is the deliberate step, not noise-derived:
   - Each biome archetype has a **resource table** in `DA_BiomeResourceProfile` (Primary Data Asset) listing 2-4 candidate resources with weight (e.g., Tundra: Iron 0.8, Fur 0.9, Fertility 0.1).
   - For each region, roll which resources are actually *present* (not all candidates appear in every region of that biome) using the `RegionAssignment` stream, targeting a global scarcity budget: no resource type should appear in more than ~30-40% of regions of any one biome archetype (tune via `DA_ScarcityBudget`).
   - Explicitly zero out at least one "essential" category per region (e.g., a region with high Iron never also has high Fertility) so the graph forces trade routes between regions, not self-sufficient homesteads.
5. **Adjacency** — record `AdjacentRegions` from the Voronoi/grid neighbor relationships; this is what `design-technical` uses to wire trade-route UI and AI caravan pathing, and what `design-economy` (see agent roster) balances against.

## Deliberate scarcity rules

- No region has both high `FertilityScore` (>0.6) and high abundance (>0.6) of more than one non-food resource. Farmland regions are resource-poor; resource-rich regions are food-poor.
- At least one resource essential to a mid-game crafting tier (see `[[crafting-system]]`) must be absent from the player's starting region, by construction — verify this in the determinism/balance test, not by hand-placing.
- `FRegionProfile::ResourceAbundance` is a sparse map — regions typically have 2-4 entries, never a flat distribution across all resource tags. A region with every resource at 0.3 is a bug, not a feature; the scarcity budget check in `DA_ScarcityBudget` should flag it.

## Handoff surface

`eng-gameplay` exposes `GetRegionProfile`/`WorldPositionToRegion` in `systems_surface[]` as `type: "subsystem"` with `blueprint_consumers` covering the world map UI widget and the caravan/trade-route AI. `design-economy` and `design-level` consume `DA_RegionArchetypes` / `DA_BiomeResourceProfile` / `DA_ScarcityBudget` as the tunable data layer — programmers own the region-graph *algorithm*, designers own the *weights*.
