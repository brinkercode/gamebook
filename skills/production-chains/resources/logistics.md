# Logistics — Ticking, Buffers, and Transport

## Tick

Production never advances in `Tick()`. A `UWorldSubsystem` drives one coarse timer for the whole
settlement (or per-region shard on large worlds) and fans out to every registered `UProductionComponent`.

```cpp
// Source/<Project>/Public/Economy/SettlementTickSubsystem.h
UCLASS()
class MYGAME_API USettlementTickSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    void RegisterProducer(UProductionComponent* Producer);
    void UnregisterProducer(UProductionComponent* Producer);

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Economy")
    float TickIntervalSeconds = 2.0f;      // coarse — not per-frame, not per-actor Tick()

    FTimerHandle TickHandle;
    void AdvanceProduction();              // iterates registered producers, advances cycles

    UPROPERTY()
    TArray<TObjectPtr<UProductionComponent>> RegisteredProducers;
};
```

```cpp
void USettlementTickSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    GetWorld()->GetTimerManager().SetTimer(
        TickHandle, this, &USettlementTickSubsystem::AdvanceProduction,
        TickIntervalSeconds, /*bLoop=*/true);
}

void USettlementTickSubsystem::AdvanceProduction()
{
    if (!GetWorld()->GetNetMode() == NM_Client) // server/standalone only — see #determinism
    {
        for (UProductionComponent* Producer : RegisteredProducers)
        {
            Producer->AdvanceCycle(TickIntervalSeconds);
        }
    }
}
```

**Rules:**
- One shared timer per subsystem instance, not one `FTimerHandle` per building. Buildings register/
  unregister on `BeginPlay`/`EndPlay`; the subsystem owns the cadence.
- `TickIntervalSeconds` (1–5s typical) trades responsiveness for CPU — tune per project scale, never
  drop to per-frame. A settlement with hundreds of buildings must stay O(buildings) per tick, not
  O(buildings × frames).
- Large worlds: shard by region/settlement (`UWorldSubsystem` per streamed level, or a region key on
  a single subsystem) so an unloaded region's buildings don't tick — pairs with `[[level-streaming]]`.

## `UProductionComponent`

```cpp
// Source/<Project>/Public/Economy/ProductionComponent.h
UCLASS(ClassGroup = (Economy), meta = (BlueprintSpawnableComponent))
class MYGAME_API UProductionComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UProductionComponent();

    UFUNCTION(BlueprintCallable, Category = "Economy")
    bool AssignRecipe(FName RecipeRowName);      // validates fertility gate + building tag

    void AdvanceCycle(float DeltaSeconds);        // called only by USettlementTickSubsystem

    UPROPERTY(BlueprintReadOnly)
    TObjectPtr<UInventoryComponent> InputBuffer;   // sized from UDA_ProductionBuilding::InputBufferSlots

    UPROPERTY(BlueprintReadOnly)
    TObjectPtr<UInventoryComponent> OutputBuffer;  // sized from UDA_ProductionBuilding::OutputBufferSlots

protected:
    UPROPERTY(EditDefaultsOnly)
    TObjectPtr<UDataTable> RecipeTable;

    FName ActiveRecipeRowName;
    float CycleProgressSeconds = 0.f;

    UPROPERTY()
    FRandomStream ByproductStream;                 // seeded (WorldSeed, BuildingInstanceID) — #determinism

    bool TryConsumeInputs(const FProductionRecipeRow& Row);
    void ProduceOutputs(const FProductionRecipeRow& Row);
    float ComputeEffectiveCycleTime(const FProductionRecipeRow& Row) const; // applies #efficiency-modifiers
};
```

`AdvanceCycle` logic: if `InputBuffer` holds enough for `Row.Inputs` and `OutputBuffer` has room for
`Row.Outputs`, accumulate `CycleProgressSeconds`; on reaching `ComputeEffectiveCycleTime`, consume
inputs, produce outputs (+ any byproduct roll from `ByproductStream`), reset progress. If inputs are
short or output buffer is full, the building **stalls** (progress holds, does not reset) — this stall
state is what a transport shortfall or downstream backup surfaces to the player.

Buffers are plain `UInventoryComponent` instances (see `[[inventory-system]]`) configured with
`InputBufferSlots`/`OutputBufferSlots` from `UDA_ProductionBuilding` — production code never
reimplements stack/weight logic, it only calls `TryAddItems`/`TryRemoveItems` on the component.

## Transport

Goods must physically move from a producer's `OutputBuffer` to a consumer's `InputBuffer`, whether
across a room (chain co-located in one settlement) or across regions (fertility-driven trade route).
Pick **one** mechanism per project during scaffolding; both share the same buffer-to-buffer contract
so a project can start with one and add the other later without touching `UProductionComponent`.

### Option A — creature carriers (`Work.Transport`)

Delegate to `[[creature-work-assignment]]`: a tamed/hired creature is assigned a `Work.Transport`
slot with a source building + destination building pair. The work system paths the creature between
the two, and on arrival calls the same transfer entrypoint as Option B:

```cpp
// Called by the creature-work-assignment Work.Transport task on arrival at destination
bool UTransportRouteComponent::DeliverCarriedGoods(UInventoryComponent* Destination)
{
    return CarriedGoods->TransferAllTo(Destination); // server-authoritative, per inventory-system
}
```

Pick this when the project already has tameable/hireable creatures (Palworld-shaped) and wants
transport capacity to scale with creature roster management rather than player construction.

### Option B — player-built logistics (paths/carts)

A `ABuildPlot`-placed path network (`[[building-system]]`) with `ACartActor` instances that patrol
a fixed route between two registered buildings, picking up from `OutputBuffer` and dropping into
`InputBuffer` on a timer of their own (still driven by `USettlementTickSubsystem`, not `Tick()`).

```cpp
UCLASS()
class MYGAME_API ACartActor : public AActor
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere) TObjectPtr<AActor> SourceBuilding;
    UPROPERTY(EditAnywhere) TObjectPtr<AActor> DestBuilding;
    UPROPERTY(EditAnywhere) float RoundTripSeconds = 20.f;
    // Moves along a spline baked from the path network; on each arrival at Dest,
    // transfers carried goods via the same UInventoryComponent::TransferAllTo contract as Option A.
};
```

Pick this when the project wants a visible, player-designed transport network as a construction
sink (Anno-shaped) rather than a creature-roster mechanic.

### Either option — the shared contract

- Transport capacity (items/trip × trips/tick) must be sized against the throughput math in
  `resources/chain-graphs.md#throughput-math` — an undersized route stalls the downstream building
  exactly like an undersized producer count does.
- Cross-region routes are how fertility gating (`resources/chain-graphs.md#fertility-gating`) resolves
  into gameplay: a region missing `Fertility.Grain` imports Bread via a route from a region that has it.
- In-transit goods (carried by a creature or cart mid-route) are part of save state — persist as a
  delta/entry, not lost on save/reload (see `#determinism` below).

## Efficiency modifiers

Applied multiplicatively in `ComputeEffectiveCycleTime`, never baked into the recipe row:

```cpp
float UProductionComponent::ComputeEffectiveCycleTime(const FProductionRecipeRow& Row) const
{
    const float AptitudeMult = GetAssignedWorkerAptitudeMult();   // 0.5x-1.5x, from creature-work-assignment worker stat
    const float WeatherMult  = GetRegionWeatherMult();            // from day-night-weather subsystem, e.g. rain slows open-air smelters
    const float HappinessMult = GetSettlementHappinessMult();     // from settlement/liveops happiness stat, 0.75x-1.25x typical
    const float CombinedMult = FMath::Max(0.1f, AptitudeMult * WeatherMult * HappinessMult);
    return Row.BaseCycleTimeSeconds / CombinedMult;
}
```

- **Worker aptitude** — the creature/NPC filling the building's `FWorkSlot` (`[[creature-work-assignment]]`)
  carries a per-skill aptitude stat; an unstaffed slot runs at a low baseline rate (or zero, per
  project design) rather than stalling entirely — decide this once and encode it as a project rule,
  not per-building.
- **Weather/season** — query the active weather/season state from the project's `[[day-night-weather]]`
  subsystem; apply per-building-type multipliers (open-air stations slowed by rain, greenhouse-type
  stations immune) via a small `DT_WeatherEfficiencyModifiers` table, not hardcoded per building class.
- **Settlement happiness** — a single settlement-wide scalar (owned by whatever liveops/settlement
  system tracks it) applied uniformly to all producers in that settlement; keeps the multiplier chain
  simple (three inputs, one formula) rather than growing ad hoc modifiers per feature.

## Determinism

- All byproduct/quality rolls draw from `FRandomStream ByproductStream` seeded
  `Hash(WorldSeed, BuildingInstanceID)` at `BeginPlay`, advanced deterministically per cycle —
  never `FMath::Rand()`/`FMath::RandRange()`. Mirrors the seed-discipline in `[[procgen-world]]`.
- `AdvanceProduction()` and `AdvanceCycle()` execute **server-side only** (`NM_Client` early-out
  above); clients receive replicated buffer counts and predicted UI state, never compute cycles
  locally. In single-player, "server" is the local authoritative game instance — the same code
  path, no branch needed.
- Persistence: each `UProductionComponent`'s `ActiveRecipeRowName`, `CycleProgressSeconds`, and
  buffer contents serialize into the save delta log (`[[procgen-world]]`/`save-system` convention)
  as a `FProductionStateDelta`; in-transit transport goods persist similarly as
  `FTransportInTransitDelta` so a save/reload mid-route doesn't destroy carried goods.
- Multiplayer RPCs (recipe assignment, manual buffer withdrawal) are `Server, Reliable, WithValidation`
  per the `[[gas-ability]]`/replication conventions in `agents/_shared/PATTERNS.md#replication` —
  a client requesting `AssignRecipe` on a fertility-ungated recipe is rejected server-side, not
  merely hidden client-side.

## Verify

Functional Test setup for `<Project>.Economy.ProductionChain.<Domain>.BalancesThroughput`:

1. Spawn 2× `OreMine`, 1× `Smelter`, 1× `Toolsmith` in a region tagged `Fertility.Iron`.
2. Register all four with a test `USettlementTickSubsystem`; advance N ticks (simulate
   `TickIntervalSeconds * N` via `AdvanceProduction()` calls, not real wall-clock wait).
3. Assert `Toolsmith.OutputBuffer` Tool count matches the expected 2:1:1-derived rate for N cycles
   (within one cycle's rounding tolerance).
4. Attempt to assign a `Fertility.Grain`-gated recipe (e.g. `Bakery`) in the same Iron-only region;
   assert `AssignRecipe` returns `false` and no bread is ever produced.
5. Save, reload, and assert in-flight `CycleProgressSeconds` and buffer contents round-trip exactly.
