# Placement & Validation

> `UBuildPlacementComponent` drives the ghost preview, validates the candidate transform against the procgen heightmap and region rules, and resolves grid or socket snapping. Everything here runs client-side as a *proposal* — the server re-validates independently before spawning (see `structures-persistence.md#persistence`).

## Component {#component}

```cpp
// Source/<Project>/Public/Building/BuildPlacementComponent.h
UCLASS(ClassGroup = (Building), meta = (BlueprintSpawnableComponent))
class MYGAME_API UBuildPlacementComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UBuildPlacementComponent();

    UFUNCTION(BlueprintCallable, Category = "Building")
    void BeginPlacement(UDA_Structure* StructureDef);

    UFUNCTION(BlueprintCallable, Category = "Building")
    void CancelPlacement();

    /** Ticks the ghost preview against the current camera trace; updates ValidationResult. */
    UFUNCTION(BlueprintCallable, Category = "Building")
    void UpdatePlacementPreview();

    /** Client → server: request the confirmed placement. Server re-validates. */
    UFUNCTION(BlueprintCallable, Category = "Building")
    void ConfirmPlacement();

    UPROPERTY(BlueprintReadOnly, Category = "Building")
    FPlacementValidationResult ValidationResult;

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Building")
    float MaxPlacementDistance = 800.f;

    UPROPERTY(EditDefaultsOnly, Category = "Building")
    TEnumAsByte<ECollisionChannel> PlacementTraceChannel = ECC_WorldStatic;

    UPROPERTY(Transient)
    TObjectPtr<UDA_Structure> ActiveStructureDef;

    UPROPERTY(Transient)
    TObjectPtr<AActor> GhostPreviewActor;

    UFUNCTION(Server, Reliable, WithValidation)
    void Server_ConfirmPlacement(const FTransform& CandidateTransform, UDA_Structure* StructureDef);

    FPlacementValidationResult ValidateCandidate(const FTransform& CandidateTransform, const UDA_Structure* StructureDef) const;
};
```

```cpp
// FPlacementValidationResult — plain struct, drives ghost material feedback
USTRUCT(BlueprintType)
struct FPlacementValidationResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) bool bValid = false;
    UPROPERTY(BlueprintReadOnly) FTransform SnappedTransform;
    UPROPERTY(BlueprintReadOnly) FText RejectionReason; // empty when bValid
};
```

`UpdatePlacementPreview` runs every tick while placement mode is active (enable `PrimaryComponentTick.bCanEverTick = true` only for this component, only while `ActiveStructureDef` is set — disable it again in `CancelPlacement`/`ConfirmPlacement`). It:

1. Line-traces from the camera along the look vector, `PlacementTraceChannel`, `MaxPlacementDistance`.
2. Builds a candidate `FTransform` from the trace hit (location + surface normal for pitch/roll if the structure allows terrain-following, otherwise up-vector locked).
3. Calls `ValidateCandidate` — returns the validation result.
4. Calls snap resolution (`ResolveSnap`, below) on the candidate before finalizing `SnappedTransform`.
5. Updates the ghost preview's material parameter (`bValid` → green translucent, else red translucent) — cosmetic only, no gameplay logic in the material.

## Surface rules {#surface-rules}

`ValidateCandidate` queries `UWorldGenSubsystem` (from `[[procgen-world]]`) rather than reading a raw heightmap array directly — the subsystem is the only owner of terrain data.

```cpp
FPlacementValidationResult UBuildPlacementComponent::ValidateCandidate(
    const FTransform& CandidateTransform, const UDA_Structure* StructureDef) const
{
    FPlacementValidationResult Result;

    UWorldGenSubsystem* WorldGen = GetWorld()->GetSubsystem<UWorldGenSubsystem>();
    if (!WorldGen)
    {
        Result.RejectionReason = NSLOCTEXT("Building", "NoWorldGen", "World not ready.");
        return Result;
    }

    const FVector Location = CandidateTransform.GetLocation();

    // 1. Slope check — sample the heightmap normal at Location, compare against StructureDef->MaxSlopeDegrees.
    const float SlopeDegrees = WorldGen->SampleSlopeDegrees(Location);
    if (SlopeDegrees > StructureDef->MaxSlopeDegrees)
    {
        Result.RejectionReason = NSLOCTEXT("Building", "TooSteep", "Ground too steep.");
        return Result;
    }

    // 2. Water check — reject if the sample point is below the region's water table, unless the
    //    structure explicitly allows water placement (docks, piers).
    if (!StructureDef->bAllowsWaterPlacement && WorldGen->IsUnderwater(Location))
    {
        Result.RejectionReason = NSLOCTEXT("Building", "Underwater", "Cannot build in water.");
        return Result;
    }

    // 3. Region rule check — some regions (e.g. protected/sacred biome tags from the region graph)
    //    forbid construction entirely regardless of slope/water.
    const FGameplayTagContainer RegionTags = WorldGen->GetRegionTagsAt(Location);
    if (RegionTags.HasTag(FGameplayTag::RequestGameplayTag("Region.NoBuild")))
    {
        Result.RejectionReason = NSLOCTEXT("Building", "RegionForbidden", "Cannot build in this region.");
        return Result;
    }

    // 4. Footprint overlap — sweep StructureDef->Footprint at CandidateTransform against
    //    ECC_WorldStatic + a dedicated Structure trace channel; reject on blocking overlap
    //    unless the overlap is with the structure's own valid snap socket (handled in ResolveSnap).
    if (HasFootprintOverlap(CandidateTransform, StructureDef))
    {
        Result.RejectionReason = NSLOCTEXT("Building", "Overlap", "Overlaps existing geometry.");
        return Result;
    }

    Result.bValid = true;
    Result.SnappedTransform = CandidateTransform;
    return Result;
}
```

Rejection reasons are player-facing text, not logging — bind `ValidationResult.RejectionReason` to a HUD widget so the ghost preview and an on-screen message stay in sync.

## Snapping {#snapping}

Two resolution passes, socket taking priority over grid:

1. **Socket snap** — every placed `AStructureBase` exposes `TArray<FSnapSocket>` (local-space transform + `ESnapSocketType`: Wall/Floor/Roof/Foundation). When the candidate transform's structure has a compatible socket type within `SocketSnapRadius` of a placed structure's open socket, snap exactly to that socket's world transform and mark the neighboring socket "occupied."
2. **Grid snap** — if no socket match, and the structure def has `bUsesGridSnap = true`, quantize `CandidateTransform.GetLocation()` to `GridSize` (data-driven per structure tier, e.g. 100uu for foundations) and quantize rotation to `GridRotationSnapDegrees` (commonly 90°).
3. Freeform structures (`bUsesGridSnap = false`, no sockets — decorative props) skip both and use the raw trace-hit transform.

```cpp
FSnapSocket UBuildPlacementComponent::FindNearestCompatibleSocket(
    const FVector& CandidateLocation, ESnapSocketType RequiredType) const
{
    // Query nearby AStructureBase actors (small sphere overlap, radius = SocketSnapRadius),
    // filter sockets by RequiredType and !bOccupied, return closest by distance.
    // Deterministic given the same set of neighboring actors — no randomness.
}
```

`FSnapSocket` and `ESnapSocketType` are declared once in `Source/<Project>/Public/Building/StructureBase.h` and reused by every structure Data Asset — see `structures-persistence.md#structure-data` for the socket authoring format.

## BP wiring notes

- `UBuildPlacementComponent` lives on `BP_PlayerCharacter` (or a dedicated `BP_BuilderPawn` for creative/admin modes); designers wire `BeginPlacement`/`ConfirmPlacement`/`CancelPlacement` to Enhanced Input actions (`IA_BuildMode`, `IA_ConfirmPlacement`, `IA_CancelPlacement`) per `[[input-binding]]`.
- The ghost preview actor (`BP_GhostPreview`) is spawned once per `BeginPlacement` call and destroyed on cancel/confirm — never pooled across different `StructureDef`s, since mesh/collision differ per structure.
- HUD binds to `ValidationResult` via a `BlueprintCallable` getter polled once per `UpdatePlacementPreview` tick (this is a UI-refresh exception to the "never poll in Tick" UMG rule in `PATTERNS.md#umg` — placement preview is inherently a per-frame cursor, not attribute state).
