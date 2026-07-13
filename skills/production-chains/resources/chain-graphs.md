# Chain Graphs — Data, Not Code

> A "chain" is never a hardcoded sequence in C++. It's an emergent graph formed by recipe rows
> whose `Outputs` match another recipe's `Inputs`. Adding a new tier to a chain is a DataTable
> row edit, not a code change.

## Data

### `FProductionRecipeRow` (row struct for `DT_ProductionRecipes_<Domain>`)

```cpp
// Source/<Project>/Public/Data/ProductionRecipeRow.h
USTRUCT(BlueprintType)
struct MYGAME_API FProductionRecipeRow : public FTableRowBase
{
    GENERATED_BODY()

    // Goods consumed per cycle. Item IDs reference UDA_ItemDefinition (inventory-system).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FInventoryEntry> Inputs;

    // Goods produced per cycle.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FInventoryEntry> Outputs;

    // Base wall-clock seconds for one full cycle at 100% efficiency, 1.0x speed.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BaseCycleTimeSeconds = 30.f;

    // Building type allowed to run this recipe. Matched against AProductionBuilding's tag.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta = (Categories = "Building"))
    FGameplayTag RequiredBuildingTag;

    // Region fertility/resource tag(s) that must be present for this recipe to be assignable
    // in a given region. Empty = no fertility gate (e.g. pure-processing recipes like Ingot->Tools).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta = (Categories = "Fertility"))
    FGameplayTagContainer RequiredFertilityTags;

    // Optional: seeded byproduct roll table (e.g. 5% chance of a bonus Gem per cycle).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    UCurveTable* ByproductRollTable = nullptr;
};
```

### `UDA_ProductionBuilding` (Primary Data Asset — the building "class" tunables)

```cpp
// Source/<Project>/Public/Data/DA_ProductionBuilding.h
UCLASS(BlueprintType)
class MYGAME_API UDA_ProductionBuilding : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, meta = (Categories = "Building"))
    FGameplayTag BuildingTag;              // e.g. Building.Smelter

    UPROPERTY(EditAnywhere)
    int32 InputBufferSlots = 4;

    UPROPERTY(EditAnywhere)
    int32 OutputBufferSlots = 4;

    UPROPERTY(EditAnywhere)
    int32 MaxWorkerSlots = 1;              // FWorkSlot count (creature-work-assignment)

    UPROPERTY(EditAnywhere)
    TSoftObjectPtr<UStaticMesh> Mesh;

    UPROPERTY(EditAnywhere)
    FDataTableRowHandle DefaultRecipe;     // row into DT_ProductionRecipes_<Domain>
};
```

**Chain composition rule:** never write `if (Recipe == "Ingot") SpawnActor(Tools)` in C++. A chain
is discovered at design time by a human (or `design-economy`) tracing which `Outputs` feed which
`Inputs` across rows in the same or sibling DataTables — enforce this by grepping item IDs across
`DT_ProductionRecipes_*` in the Functional Test's setup, not by encoding the graph in a class.

Generate/update the DataTable from CSV via `ue5-editor-python` (`Tools/Python/gen/economy_recipes.py`,
one script parameterized per domain — `Metals`, `Food`, `Textiles` — not one script per table).
Idempotent: re-running with an unchanged CSV is a no-op; changed rows update in place.

## Throughput math

### Cycle time, rate, and the 2:1:1 pattern

A building's effective cycle time is:

```
EffectiveCycleTime = BaseCycleTimeSeconds / (WorkerAptitudeMult * WeatherMult * HappinessMult)
```

Its throughput rate is `Outputs.Count / EffectiveCycleTime` (goods/second) per output good.

**Chain balancing — the classic Anno-style 2:1:1 ratio:** when a downstream building consumes
faster than one upstream building can supply, staff *N* upstream producers so their combined rate
matches the downstream consumption rate. The canonical shape:

```
2x OreMine   --(ore, 20s/cycle, 1 ore/cycle each => 0.1 ore/s x2 = 0.2 ore/s)-->
1x Smelter   --(consumes 2 ore/cycle every 20s = 0.1 ore/s ... wait, balance to match)-->
1x Toolsmith --(consumes 1 ingot/cycle every 20s = 0.05 ingot/s)
```

Concretely: if `Smelter` turns 2 Ore → 1 Ingot every 20s (0.05 ingot/s), and `Toolsmith` turns
1 Ingot → 1 Tool every 20s (0.05 ingot/s consumed), the chain is balanced 1 Smelter : 1 Toolsmith.
But since `Smelter` needs 2 Ore/cycle (0.1 ore/s) and a single `OreMine` only yields 1 Ore/cycle
every 20s (0.05 ore/s), you need **2 OreMines : 1 Smelter : 1 Toolsmith** — the 2:1:1 pattern.
Generalize: `ProducersNeeded = ceil(DownstreamConsumptionRate / SingleProducerOutputRate)` per tier,
computed tier-by-tier from the final consumer backward.

`design-economy` owns this math as a spreadsheet/doc artifact (`docs/ECONOMY_BALANCE.md` or similar)
before content lands; `resources/logistics.md#tick` is where the runtime enforces the resulting
rates — the runtime never re-derives ratios, it just executes the timers data specifies.

### Balancing checklist (apply before greenlighting a chain)

- [ ] Every recipe's `Inputs` total volume/weight roughly tracks its `Outputs` (no free mass).
- [ ] For each tier, `ProducersNeeded` computed against the *next* tier's consumption rate, not
      an arbitrary guess.
- [ ] Buffer sizes (`InputBufferSlots`/`OutputBufferSlots`) sized to absorb at least one full
      upstream cycle of desync (transport latency, worker downtime) without stalling the chain.
- [ ] A Functional Test asserts the ratio holds over N cycles in `resources/logistics.md#verify`.

## Fertility gating

Query `UWorldGenSubsystem::GetRegionProfile(RegionId)` (see `[[procgen-world]]`) for the region's
`FertilityTags` (`FGameplayTagContainer`, e.g. `Fertility.Iron`, `Fertility.Grain`) before allowing
a `UProductionComponent` to be assigned `FProductionRecipeRow::RequiredFertilityTags`:

```cpp
bool UProductionComponent::CanAssignRecipe(FName RecipeRowName) const
{
    const FProductionRecipeRow* Row = LookupRecipe(RecipeRowName);
    if (!Row || Row->RequiredFertilityTags.IsEmpty())
    {
        return true; // pure-processing recipes (Ingot->Tools) have no fertility gate
    }
    UWorldGenSubsystem* WorldGen = GetWorld()->GetSubsystem<UWorldGenSubsystem>();
    const FRegionProfile& Region = WorldGen->GetRegionProfile(GetOwnerRegionId());
    return Region.FertilityTags.HasAll(Row->RequiredFertilityTags);
}
```

This is the mechanism that makes trade *necessary*, not optional: a region with `Fertility.Iron`
but not `Fertility.Grain` can smelt locally but must import food — see `resources/logistics.md#transport`
for how goods cross that gap. Reject assignment attempts server-side; never let a client silently
run an ungated recipe (`eng-director` checks this at review time per `SECURITY_CHECKLIST.md`).
