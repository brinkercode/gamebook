# POI Placement

> How a POI archetype becomes a deterministic set of placed, streamable, nav-bounded instances in the world. Read this when implementing `UPOIPlacementSubsystem`, authoring a new `UDA_POIArchetype`, or wiring Level Instance streaming/navmesh bounds for POI interiors.

## `UDA_POIArchetype`

One Data Asset per POI *type* (not per instance). Tunables live here — never hardcode spacing/danger values in C++.

```cpp
// Source/<Project>/Public/Data/DA_POIArchetype.h
UENUM(BlueprintType)
enum class EPOIKind : uint8
{
    Ruins, Camp, DungeonEntrance, BossArena
};

UCLASS(BlueprintType)
class MYPROJECT_API UDA_POIArchetype : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere) FName POIID;                 // stable ID, e.g. "BanditCamp_T2"
    UPROPERTY(EditAnywhere) EPOIKind Kind = EPOIKind::Camp;
    UPROPERTY(EditAnywhere) int32 DangerTier = 1;         // matches region danger tier / DT_EncounterTable key

    // Content: either a Level Instance prefab OR an editor-Python composition script.
    // Never both; never hand-placed actors.
    UPROPERTY(EditAnywhere) TSoftObjectPtr<UWorld> InteriorLevel;      // ALevelInstance target, if prefab-based
    UPROPERTY(EditAnywhere) FSoftObjectPath CompositionScript;         // Tools/Python/gen/poi_<name>.py, if generated

    // Placement rules — consumed by UPOIPlacementSubsystem, never re-derived in code.
    UPROPERTY(EditAnywhere) float MinSpacingFromSameTypeCm = 500000.f; // 5km
    UPROPERTY(EditAnywhere) float MinSpacingFromAnyPOICm = 150000.f;   // 1.5km
    UPROPERTY(EditAnywhere) TArray<FName> AllowedBiomes;               // matches procgen-world biome IDs
    UPROPERTY(EditAnywhere) FFloatRange AllowedSlopeDegrees = FFloatRange(0.f, 20.f);
    UPROPERTY(EditAnywhere) float SpawnWeight = 1.f;                   // relative pick weight within a region's budget
    UPROPERTY(EditAnywhere) FVector InteriorNavBoundsExtent = FVector(4000.f, 4000.f, 1500.f);

    // Respawn/lockout policy (see resources/encounter-tables.md for the delta record it produces).
    UPROPERTY(EditAnywhere) bool bRespawns = true;
    UPROPERTY(EditAnywhere) float RespawnLockoutHours = 48.f;          // 0 = event-gated only, never timer-gated
};
```

Naming: `DA_POI_<Name>` under `Content/World/POI/`.

## Placement algorithm — Poisson-disc + suitability mask

Placement runs **after** `procgen-world`'s region graph exists and **before** any per-chunk fine detail is needed — POIs are a region-scale decision, not a chunk-scale one. Never let a POI decide its own biome/danger tier locally; it reads its region's profile, exactly like `procgen-world` Rule #3.

```cpp
// Source/<Project>/Public/World/POI/POIPlacementSubsystem.h
UCLASS()
class MYPROJECT_API UPOIPlacementSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    // Called once per region when the region graph is finalized (procgen-world hook).
    TArray<FPOIPlacement> PlaceForRegion(const FRegionProfile& Region, int64 WorldSeed);

private:
    FRandomStream MakeRegionStream(int64 WorldSeed, int32 RegionID) const
    {
        // Same hashing discipline as procgen-world/resources/seed-discipline.md —
        // one derived stream per region, never a shared/global stream.
        const uint32 Combined = HashCombine(GetTypeHash(WorldSeed), GetTypeHash(RegionID));
        return FRandomStream(Combined);
    }
};
```

Algorithm, per region:

1. **Candidate generation** — Bridson's Poisson-disc sampling over the region's footprint using `MinSpacingFromAnyPOICm` as the disc radius, driven entirely by `MakeRegionStream`. This gives even, non-clustered candidate points without a rejection-sampling blowup.
2. **Suitability mask** — for each candidate, sample the region's heightfield/biome data (from `procgen-world`) and reject if: biome not in `AllowedBiomes`, slope outside `AllowedSlopeDegrees`, or too close to an already-accepted POI of the *same* archetype (`MinSpacingFromSameTypeCm`).
3. **Archetype pick** — among archetypes valid for the region's danger tier, weighted-random pick via `SpawnWeight`, drawn from the same region stream (order matters for determinism — always candidates-then-picks, never interleaved with anything non-deterministic).
4. **Budget cap** — region profile carries a max-POI-count; stop once reached. This is what keeps POI density Anno-scarce rather than saturating every region.
5. **Exclusion export** — accepted POI footprints (position + `InteriorNavBoundsExtent`) are pushed into the same exclusion-zone data `pcg-biome-population` reads (see its `resources/runtime-generation.md`), so volume scatter never spawns inside a POI.

Determinism contract: `PlaceForRegion` called twice with the same `(Region, WorldSeed)` must return byte-identical `FPOIPlacement` arrays — order, position, and archetype. This is what `<Project>.World.POI.PlacementDeterministic` asserts.

## Level Instance streaming for POI interiors

Exterior markers (`APOIVolume`) are cheap and always loaded once a region streams in. The interior — for prefab-based archetypes — loads only on approach.

```cpp
// On player entering the POI's trigger radius
if (ULevelInstanceSubsystem* LISubsystem = GetWorld()->GetSubsystem<ULevelInstanceSubsystem>())
{
    if (ALevelInstance* Instance = LISubsystem->GetLevelInstance(POIVolume->InteriorInstanceHandle))
    {
        LISubsystem->SetIsRequestedToBeLoaded(Instance, true);
    }
}
// On exit, or after RespawnLockoutHours with no player nearby:
LISubsystem->SetIsRequestedToBeLoaded(Instance, false);
```

- `ALevelInstance` actors are spawned by the placement subsystem at accepted candidate transforms, pointing at `InteriorLevel`. Placement is deterministic; the *load state* is not part of the seed contract — it's a runtime streaming concern.
- For editor-Python-composed archetypes (no prefab level, e.g. a procedurally-assembled ruin), the composition script runs once at first approach and caches its output as a spawned actor set tagged with the POI's stable ID — subsequent visits reuse the cached actors, not a re-run of the script (idempotent per `ue5-editor-python` convention #2).
- Multiplayer: interior streaming state is server-driven (`GetWorld()->GetNetMode() != NM_Client` gate before calling `SetIsRequestedToBeLoaded`); replicate presence via the standard actor-relevancy path, not a custom RPC.

## Runtime navmesh bounds around POIs

POI interiors are not known at cook time (procgen), so navmesh generation must be dynamic and scoped, not baked globally.

```cpp
// Config/DefaultEngine.ini — RecastNavMesh must allow runtime generation
[/Script/NavigationSystem.RecastNavMesh]
RuntimeGeneration=Dynamic

// On POI placement, spawn a scoped nav bounds volume sized to the archetype:
ANavModifierVolume* NavVol = World->SpawnActor<ANavModifierVolume>(Placement.Transform);
NavVol->SetActorScale3D(Archetype->InteriorNavBoundsExtent / 100.f); // volume default is 100cm cube
NavVol->GetComponent<UBrushComponent>()->SetCollisionProfileName(TEXT("NoCollision"));
FNavigationSystem::UpdateActorAndComponentsInNavOctree(*NavVol);
```

- Keep bounds tight to `InteriorNavBoundsExtent` — global dynamic nav generation across the whole procgen world is a perf trap; scope it per-POI (and per-chunk elsewhere, if the project needs open-world AI nav at all).
- On POI unload (Level Instance unloaded, player far away), destroy the nav bounds volume so tile data is reclaimed — don't leave orphaned nav bounds accumulating as the player explores.
- Boss arenas typically need a larger, hand-tuned extent than ruins/camps — set per-instance on the archetype, not globally.
