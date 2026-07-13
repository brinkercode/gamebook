# Needs Tiers — data, residences, and the shared item pool

## Residences

`AResidenceBuilding` is a content-side `AStructureBase` subclass (per `building-system`) — the C++ base stays generic, capacity is data:

```cpp
// Source/<Project>/Public/Settlement/ResidenceBuilding.h
UCLASS()
class MYPROJECT_API AResidenceBuilding : public AStructureBase
{
    GENERATED_BODY()
public:
    // How many pops this residence supports once occupied/powered/serviced.
    UPROPERTY(EditDefaultsOnly, Category = "Settlement")
    int32 CapacityProvided = 4;

    // Minimum SettlementTier required before this residence can be built/occupied.
    UPROPERTY(EditDefaultsOnly, Category = "Settlement")
    FGameplayTag MinimumSettlementTier;

    UFUNCTION(BlueprintCallable, Category = "Settlement")
    ASettlementCenter* GetOwningSettlement() const;
};
```

`USettlementPopulationComponent::RecomputeMaxPopulation()` sums `CapacityProvided` across every `AResidenceBuilding` registered to the settlement (registration happens in `AResidenceBuilding::BeginPlay` → `GetOwningSettlement()->GetPopulationComponent()->RegisterResidence(this)`, and on demolish it deregisters). Never hardcode a settlement's population cap — it is always a live sum of placed, powered residences.

## `UDA_NeedsTier`

```cpp
// Source/<Project>/Public/Data/NeedsTierData.h
UCLASS(BlueprintType)
class MYPROJECT_API UDA_NeedsTier : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    // e.g. "Tier1_Basic", "Tier2_Comfort", "Tier3_Prosperity"
    UPROPERTY(EditAnywhere, Category = "Needs")
    FGameplayTag TierTag;

    // Minimum distinct food ItemIDs the store must hold per cycle to satisfy Food need.
    UPROPERTY(EditAnywhere, Category = "Needs")
    int32 RequiredFoodVariety = 1;

    // Goods items consumed per pop per cycle: {ItemID -> qty per pop}.
    UPROPERTY(EditAnywhere, Category = "Needs")
    TMap<FName, int32> GoodsPerPop;

    // Service buildings (by gameplay tag, e.g. "Service.Tavern") that must be
    // reachable within ServiceRadius for this tier's Services need to be satisfied.
    UPROPERTY(EditAnywhere, Category = "Needs")
    TArray<FGameplayTag> RequiredServiceTags;

    UPROPERTY(EditAnywhere, Category = "Needs")
    float ServiceRadiusCm = 3000.f;
};
```

Rows are authored per `SettlementTier.*` — Tier1 needs are a subset of Tier2's superset, so upgrading never *removes* a satisfied need, it *adds* new ones the settlement must now also satisfy to stay happy. This is what stops growth from being a one-way ratchet with no upkeep pressure.

## Needs cycle — reading the shared store

`USettlementPopulationComponent::TickNeedsCycle()` runs on a `USettlementTickSubsystem` (`UWorldSubsystem`) that batches every registered settlement's cycle on a shared throttled timer (e.g. every 30s game-time) — never a per-settlement `Tick()`.

```cpp
void USettlementPopulationComponent::TickNeedsCycle()
{
    const UDA_NeedsTier* Tier = GetActiveNeedsTierAsset(); // current SettlementTier's row
    UInventoryComponent* Store = GetOwningSettlement()->GetSharedStore(); // see below

    const float FoodRatio = ComputeFoodVarietyRatio(Store, Tier->RequiredFoodVariety);
    const float GoodsRatio = ComputeGoodsRatio(Store, Tier->GoodsPerPop, PopulationCount);
    const float ServiceRatio = ComputeServiceCoverageRatio(Tier->RequiredServiceTags, Tier->ServiceRadiusCm);

    // Consume the satisfied portion from the store — partial fulfillment consumes
    // proportionally, it never goes negative or over-consumes on shortfall.
    Store->ConsumeForNeedsCycle(Tier, PopulationCount, FoodRatio, GoodsRatio);

    ApplyFulfillmentToHappiness(FoodRatio, GoodsRatio, ServiceRatio); // see happiness-growth.md
}
```

`ComputeFoodVarietyRatio`/`ComputeGoodsRatio`/`ComputeServiceCoverageRatio` are pure functions of store contents + tier data + population count — no randomness, so two settlements with identical store/tier/population always compute identical ratios (determinism matters here even though this isn't world-gen, because the delta-log replay depends on it — see `#player-as-settler` and the main SKILL.md persistence rule).

## Player as settler — the shared item pool

The settlement's "shared store" is not a second inventory system. It is the same `UInventoryComponent`-family container `production-chains` stations write output into and `crafting-system`/player inventory read from — settlement needs and player survival draw from one pool when the player is bound to the settlement:

```cpp
// ASettlementCenter
UFUNCTION(BlueprintCallable, Category = "Settlement")
UInventoryComponent* GetSharedStore() const { return SharedStoreComponent; }

// Player opts in (e.g. via an interaction at the settlement's storehouse):
UFUNCTION(BlueprintCallable, Category = "Settlement")
void BindPlayerToSettlement(APlayerController* PC);
```

When bound, the player's `eat`/`drink` GAS abilities (per `gas-ability` + `survival-stats`) resolve their item cost against `GetSharedStore()` instead of a personal-only inventory, and the settlement's needs cycle reads from the same container. This is intentional design pressure, not a bug: a player who strips the storehouse for personal survival directly starves their own colony's `FoodRatio` next cycle, and a starving colony's exodus reduces the workforce feeding `production-chains` the player relies on. Server-authoritative: `BindPlayerToSettlement`/unbind and every `ConsumeForNeedsCycle` call happen on the server; clients only see the replicated resulting counts.

## Rules recap

- Residence capacity is always a live sum, never a cached/stale total — recompute on register/deregister, not once at level load.
- `UDA_NeedsTier` rows are strictly additive tier-over-tier.
- The needs cycle consumes from the one real store; never snapshot/copy store contents into a parallel "settlement warehouse."
- All ratio math is pure and deterministic given store + tier + population — no `FMath::Rand` in the needs cycle.
