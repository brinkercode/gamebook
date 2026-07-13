# Structures, Build Plots & Persistence

> Structural pieces are data (`UDA_Structure`), local terrain edits are scoped to `ABuildPlot` volumes, and every confirmed placement/demolish is a delta-log entry replayed on load — never a saved heightmap patch, never a global voxel array.

## Structure data {#structure-data}

```cpp
// Source/<Project>/Public/Data/DA_Structure.h
UCLASS(BlueprintType)
class MYGAME_API UDA_Structure : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, Category = "Structure")
    FName StructureID;

    UPROPERTY(EditAnywhere, Category = "Structure")
    TSubclassOf<AStructureBase> StructureClass;

    UPROPERTY(EditAnywhere, Category = "Structure")
    TSoftObjectPtr<UStaticMesh> PreviewMesh;

    // Footprint used for overlap sweeps and grid occupancy — simple shape, not full collision mesh.
    UPROPERTY(EditAnywhere, Category = "Structure")
    FVector FootprintExtent = FVector(100.f, 100.f, 50.f);

    UPROPERTY(EditAnywhere, Category = "Structure")
    float MaxSlopeDegrees = 20.f;

    UPROPERTY(EditAnywhere, Category = "Structure")
    bool bAllowsWaterPlacement = false;

    UPROPERTY(EditAnywhere, Category = "Structure")
    bool bUsesGridSnap = true;

    UPROPERTY(EditAnywhere, Category = "Structure", meta = (EditCondition = "bUsesGridSnap"))
    float GridSize = 100.f;

    UPROPERTY(EditAnywhere, Category = "Structure", meta = (EditCondition = "bUsesGridSnap"))
    float GridRotationSnapDegrees = 90.f;

    // Authored in the structure's editor as local-space transforms; consumed by ResolveSnap.
    UPROPERTY(EditAnywhere, Category = "Structure|Sockets")
    TArray<FSnapSocket> Sockets;

    // Inventory cost — read by UBuildPlacementComponent::ConfirmPlacement, deducted server-side.
    UPROPERTY(EditAnywhere, Category = "Structure")
    TArray<FInventoryCost> BuildCost;

    // If true, this structure requires an ABuildPlot to exist (or be created) before it can be placed —
    // set for foundations/cellars that level terrain; false for freestanding props/walls.
    UPROPERTY(EditAnywhere, Category = "Structure")
    bool bRequiresBuildPlot = false;
};
```

Generate `DA_Structure_<Piece>` instances via `[[ue5-editor-python]]` (`Tools/Python/gen/building_structure.py`, parameterized by a CSV of `{StructureID, StructureClass, FootprintExtent, MaxSlopeDegrees, BuildCost, ...}`) — one script for the whole family, not one per piece, matching the crafting-system recipe-table convention.

## Build plots (local destructibility) {#build-plots}

`ABuildPlot` is the project's answer to "can players dig/flatten terrain" without a voxel engine. It owns a bounded local patch of the heightmap (its own footprint, typically the union of the structures it will host, padded by a margin) and offers flatten/dig operations that only ever touch that patch.

```cpp
// Source/<Project>/Public/Building/BuildPlot.h
UCLASS()
class MYGAME_API ABuildPlot : public AActor
{
    GENERATED_BODY()
public:
    ABuildPlot();

    UFUNCTION(BlueprintCallable, Category = "Building")
    FBox GetPlotBounds() const;

    /** Server-only. Levels the heightmap within GetPlotBounds() to TargetElevation. */
    UFUNCTION(Category = "Building")
    void FlattenWithinPlot(float TargetElevation);

    /** Server-only. Lowers the heightmap within a sub-region of the plot (cellars, foundations). */
    UFUNCTION(Category = "Building")
    void DigWithinPlot(const FBox& SubRegion, float DepthUnits);

protected:
    UPROPERTY(Replicated)
    FBox PlotBounds;

    // Local patch of overridden height samples — small, bounded by PlotBounds, never the world array.
    UPROPERTY()
    TMap<FIntPoint, float> HeightOverrides;
};
```

Rules:

- `FlattenWithinPlot`/`DigWithinPlot` write only into `HeightOverrides`, keyed by local grid cell within `PlotBounds` — `UWorldGenSubsystem::SampleHeight` checks a plot's `HeightOverrides` first before falling back to procedural noise, so the rest of the world is untouched.
- A plot's `HeightOverrides` are themselves persisted as delta-log entries (`EDeltaType::PlotEdit`), not as a separate save blob — see `persistence.md#persistence` below. This keeps build-plot edits inside the same regenerate-and-replay model as every other world delta from `[[procgen-world]]`.
- Plots are bounded and finite — there is no mechanism for a plot to grow arbitrarily or merge with another plot's patch at runtime; a new build spanning more area requires a new/larger plot claimed explicitly, keeping the local-edit footprint auditable and cheap to replicate.
- All flatten/dig calls are server-only (`ABuildPlot` functions have no client-callable path); the placement flow requests a plot operation through `UBuildPlacementComponent::Server_ConfirmPlacement`, never directly.

## Persistence {#persistence}

Placement and demolish are both delta-log entries, following the `[[procgen-world]]` delta schema (`{seed, region_graph_hash, delta_log[]}` in the encrypted `USaveGame`):

```cpp
// Delta entry variants relevant to building — appended to the same ordered delta_log[]
// that procgen-world's terrain/feature deltas use.
USTRUCT()
struct FStructurePlacementDelta
{
    GENERATED_BODY()
    UPROPERTY() FGuid DeltaID;
    UPROPERTY() FName StructureID;         // resolves UDA_Structure via Asset Manager
    UPROPERTY() FTransform Transform;      // already snap-resolved
    UPROPERTY() FGuid OwningPlotID;        // FGuid::Invalid if bRequiresBuildPlot == false
    UPROPERTY() FGameplayTagContainer OwnershipTags; // Owner.Player.<ID> / Owner.Settlement.<ID>
};

USTRUCT()
struct FPlotEditDelta
{
    GENERATED_BODY()
    UPROPERTY() FGuid PlotID;
    UPROPERTY() TMap<FIntPoint, float> HeightOverrides;
};

USTRUCT()
struct FStructureDemolishDelta
{
    GENERATED_BODY()
    UPROPERTY() FGuid DeltaID; // matches the FStructurePlacementDelta.DeltaID being removed
};
```

Flow on `Server_ConfirmPlacement`:

1. Server re-runs `ValidateCandidate` independently (never trusts the client's `ValidationResult`) — same slope/water/region/overlap checks as the client preview.
2. Deduct `BuildCost` from the requesting actor's inventory (server-authoritative, same as any inventory spend).
3. If `bRequiresBuildPlot`, claim or create the `ABuildPlot`, run `FlattenWithinPlot`/`DigWithinPlot`, and append the resulting `FPlotEditDelta`.
4. Spawn the real `AStructureBase` (`StructureClass` from the `UDA_Structure`), set `OwnershipTags`, append `FStructurePlacementDelta`.
5. The spawned actor replicates normally (standard actor replication) — the delta log is the durable record; the live actor is a runtime cache of it.

On load: `UWorldGenSubsystem` regenerates terrain from the seed, then replays `delta_log[]` in order — `FPlotEditDelta` entries rebuild each `ABuildPlot`'s `HeightOverrides` before any `FStructurePlacementDelta` entries spawn structures on top, so a plot's flattened ground is always in place before its buildings reconstruct.

Demolish follows the same server-authoritative path: validate permission (below), despawn the actor, append `FStructureDemolishDelta`. The replay on load simply skips placement deltas that have a matching demolish delta — the log is append-only, never rewritten in place, matching `[[procgen-world]]`'s determinism guarantee.

## Ownership & permission {#ownership}

Every `AStructureBase` carries an `FGameplayTagContainer OwnershipTags`, set at placement time:

- `Owner.Player.<PlayerID>` — placed by an individual player (relevant even in single-player, for consistency with multiplayer saves).
- `Owner.Settlement.<SettlementID>` — placed as part of a settlement claim (see integration note below); grants build/demolish rights to any member with `Build.Permission.Allied` or higher.
- `Build.Permission.Public` / `Build.Permission.Owner` / `Build.Permission.Allied` — set per-structure (or inherited from the owning settlement's default) and checked server-side in `Server_ConfirmPlacement`'s demolish/edit path before any delta is appended. A client requesting demolish on a structure it doesn't have permission for is rejected with no delta written and no visual change — reject-silently-with-log, not a client-visible desync.

Single-player projects still set `Owner.Player.<ID>` (a single fixed ID) for save-schema consistency, but skip the permission check entirely — see `stack.networking` in `project.config.json`.

## Integration notes

- **`[[settlement-population]]`** (once authored): a settlement's population/tier calculation counts structures whose `OwnershipTags` include `Owner.Settlement.<ID>` and whose `StructureID` matches a housing/utility category — this skill's delta log is the only source of truth settlement-population should query (via `UWorldGenSubsystem`'s delta index), never a separate structure count cached elsewhere.
- **Production-chains stations** (see `[[crafting-system]]`'s `AStation` pattern): a station is an `AStructureBase` subclass — it gets `StructureID`, `FootprintExtent`, `Sockets`, and `BuildCost` from a `UDA_Structure` exactly like any other placed piece, and additionally exposes `StationTag` + `WorkSlots[]` per the crafting-system skill. There is no second placement path for stations — they go through `UBuildPlacementComponent` like walls and foundations; crafting-system only adds the recipe-gating and work-slot behavior once the actor exists.
- **`[[save-system]]`**: the delta log lives inside the same encrypted `USaveGame` schema `[[procgen-world]]` defines; building-system does not introduce a second save slot or a parallel serialization path.
