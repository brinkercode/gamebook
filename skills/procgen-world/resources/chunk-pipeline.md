# Chunk Pipeline

> Coarse-to-fine layered generation, run per chunk, each layer independently seeded (see `resources/seed-discipline.md`). Region graph (`resources/region-graph.md`) has already fixed the macro biome/resource envelope by the time any of this runs — chunk noise fills in *within* that envelope, it does not override it.

## Pipeline order

```
1. Elevation noise         (FastNoiseLite/FastNoise2, per chunk, per layer stream)
2. Moisture + Temperature noise
3. Whittaker biome lookup  (region archetype + local elevation/moisture/temp -> final biome)
4. Poisson-disc feature placement (trees, rocks, resource nodes, ruins)
```

## Noise layers

Vendor **FastNoise2** (preferred — SIMD, node-graph configurable) or **FastNoiseLite** (single header, simpler) under `Plugins/FastNoise/` and compile it in — do not call out to a runtime noise library or Blueprint-only noise nodes for terrain-defining noise; determinism across platforms requires the same compiled code path everywhere.

```cpp
// Source/<Project>/Public/WorldGen/ChunkGenerator.h
UCLASS()
class MYGAME_API UChunkGenerator : public UObject
{
    GENERATED_BODY()
public:
    FChunkData GenerateChunk(int64 WorldSeed, FIntPoint ChunkCoord, const FRegionProfile& Region);

private:
    float SampleElevation(int64 WorldSeed, FIntPoint ChunkCoord, FVector2D LocalPos) const;
    float SampleMoisture(int64 WorldSeed, FIntPoint ChunkCoord, FVector2D LocalPos) const;
    float SampleTemperature(int64 WorldSeed, FIntPoint ChunkCoord, FVector2D LocalPos) const;
};
```

```cpp
float UChunkGenerator::SampleElevation(int64 WorldSeed, FIntPoint ChunkCoord, FVector2D LocalPos) const
{
    FRandomStream Stream = WorldGenHash::MakeStream(WorldSeed, ChunkCoord.X, ChunkCoord.Y, WorldGenHash::ELayer::Elevation);
    FastNoise::SmartNode<> FractalNoise = FastNoise::NewFromEncodedNodeTree("...");  // baked node graph, see FastNoise2 docs
    // Seed FastNoise2's own generator from our stream so identical (seed, chunk) -> identical field,
    // independent of which chunk generated before it.
    const int32 NoiseSeed = Stream.GetUnsignedInt();
    const FVector2D WorldPos = FVector2D(ChunkCoord) * ChunkSizeWorldUnits + LocalPos;
    return FractalNoise->GenSingle2D(WorldPos.X * Frequency, WorldPos.Y * Frequency, NoiseSeed);
}
```

Moisture and Temperature follow the same shape with `ELayer::Moisture` / `ELayer::Temperature` and their own frequency/octave tuning (temperature additionally biased by the region's macro latitude band from `FRegionProfile`, so per-chunk noise perturbs rather than overrides the region's climate).

## Whittaker-style biome lookup

Classic 2-axis (moisture × temperature) Whittaker diagram, constrained to the candidates the region archetype allows:

```cpp
// Source/<Project>/Public/WorldGen/BiomeLookup.h
FGameplayTag UBiomeLookup::ResolveBiome(const FRegionProfile& Region, float Elevation, float Moisture, float Temperature)
{
    // DT_WhittakerTable: rows = (MoistureBand, TemperatureBand) -> Biome tag,
    // but only among Region.BiomeArchetype's allowed sub-biomes (e.g. Tundra region
    // resolves to Biome.Tundra_Rocky or Biome.Tundra_Taiga, never Biome.Desert).
    return WhittakerTable->FindBiome(Region.BiomeArchetype, Moisture, Temperature, Elevation);
}
```

`DT_WhittakerTable` is a `UDataTable` designers edit directly — programmers own `ResolveBiome`, designers own the moisture/temperature band boundaries and which sub-biomes each archetype allows. See `[[gas-ability]]`-style split: code owns the algorithm, Data Table owns the tuning.

## Poisson-disc feature placement

Run last, after biome is known, so feature density/type is biome-aware:

```cpp
void UChunkGenerator::PlaceFeatures(int64 WorldSeed, FIntPoint ChunkCoord, FChunkData& Chunk)
{
    FRandomStream Stream = WorldGenHash::MakeStream(WorldSeed, ChunkCoord.X, ChunkCoord.Y, WorldGenHash::ELayer::FeaturePlacement);
    const UDA_BiomeFeatureProfile* FeatureProfile = ResolveFeatureProfile(Chunk.Biome); // DA_Feature_<Biome>
    TArray<FVector2D> Points = PoissonDiscSample2D(Stream, ChunkBounds, FeatureProfile->MinSpacing);
    for (const FVector2D& P : Points)
    {
        const FGameplayTag FeatureTag = FeatureProfile->RollFeatureType(Stream); // e.g. Feature.Tree.Pine, Feature.ResourceNode.IronVein
        Chunk.PendingFeatures.Add({ FeatureTag, P, Stream.GetFraction() * 360.f /*rotation*/ });
    }
}
```

Feature actors (`BP_Feature_*`) spawn from `Chunk.PendingFeatures` when the chunk streams in — they are ordinary destructible/interactable actors, not baked into any mesh, so a player harvesting a tree or mining a vein is a normal actor-destroy event that gets written to the delta log (see `resources/delta-saves.md`), not a terrain edit.

## Heightmap-vs-voxel fork {#fork}

**Default: heightmap + feature actors.** `FChunkData::HeightSamples` (a `TArray<float>` grid, e.g. 64x64 per chunk) drives a `ULandscapeComponent` or a generated static mesh section; local destructibility (mining a vein, felling a tree, building a foundation) is handled by *actors placed on top of* the heightmap, not by editing the heightmap itself. This covers survival/crafting/civilization needs — bases, farms, mines-as-actors, roads — without a volumetric mesher.

Fork to **full voxel** only when the design requires arbitrary excavation/terraforming as a core verb (tunneling anywhere, terrain deformation as base-building). If you fork:

- You now need a voxel mesher (Marching Cubes or Dual Contouring) running per-chunk, still seeded per `(WorldSeed, ChunkCoord, Layer)` for any procedural cave/ore-vein noise.
- The delta log entries become voxel-edit ops (`{ChunkCoord, VoxelIndex, NewMaterial}`) instead of actor-spawn/destroy ops — same schema shape in `resources/delta-saves.md`, larger volume.
- **Raise the perf budget explicitly** in `project.config.json` (`worldgen.mode = "voxel"`) — voxel meshing is not covered by the default 60 FPS / GTX 1060 baseline in `agents/_shared/STACK.md`; `eng-director` and `qa-lead` should treat a voxel fork as requiring its own perf pass (chunk remesh budget per frame, LOD/greedy-meshing strategy), not an assumption that the default baseline still holds.
- Nanite is still OFF by default per the locked stack — voxel meshes are typically instanced static meshes or runtime-generated `FRuntimeMeshComponent`/`RealtimeMesh`-style sections, not Nanite.

Record the choice (`worldgen.mode`) once, in `project.config.json`, during scaffolding — do not let it drift silently per-feature.
