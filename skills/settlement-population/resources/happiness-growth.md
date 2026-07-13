# Happiness, Growth, Unrest & Exodus

## `HappinessAttributeSet`

Same GAS pattern as `survival-stats`'s `UPlayerSurvivalAttributeSet`: one attribute set, driven entirely by `UGameplayEffect`s, clamped in `PreAttributeChange`. This set lives on the settlement's `ASettlementCenter` (or a dedicated `AInfo`-derived settlement actor with its own `UAbilitySystemComponent`) — not on the player.

```cpp
// Source/<Project>/Public/Settlement/HappinessAttributeSet.h
UCLASS()
class MYPROJECT_API UHappinessAttributeSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    ATTRIBUTE_ACCESSORS(UHappinessAttributeSet, Happiness)
    ATTRIBUTE_ACCESSORS(UHappinessAttributeSet, GrowthPoints)
    ATTRIBUTE_ACCESSORS(UHappinessAttributeSet, ExodusPressure)

    // 0..100. Integrates fulfillment ratio over time (decays toward 0 on shortfall,
    // grows toward 100 on surplus — never snaps instantly).
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Happiness)
    FGameplayAttributeData Happiness;
    UFUNCTION() void OnRep_Happiness(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UHappinessAttributeSet, Happiness, Old); }

    // Accrues while Happiness > GrowthThreshold; consumed on population tick-up.
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_GrowthPoints)
    FGameplayAttributeData GrowthPoints;
    UFUNCTION() void OnRep_GrowthPoints(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UHappinessAttributeSet, GrowthPoints, Old); }

    // Accrues while Happiness < UnrestThreshold; consumed on population tick-down.
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_ExodusPressure)
    FGameplayAttributeData ExodusPressure;
    UFUNCTION() void OnRep_ExodusPressure(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UHappinessAttributeSet, ExodusPressure, Old); }

    virtual void PreAttributeChange(const FGameplayAttribute& Attr, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
};
```

`PreAttributeChange` clamps `Happiness` to `[0, 100]`, `GrowthPoints`/`ExodusPressure` to `[0, GrowthGate]`/`[0, ExodusGate]` respectively (gate values from `DT_SettlementTuning`).

## Fulfillment → happiness GE chain

`ApplyFulfillmentToHappiness` (called from the needs cycle in `needs-tiers.md`) applies one `Infinite`-style `Instant` GE per cycle tick with `SetByCaller` magnitudes computed from the ratios — not a raw per-frame drift, because the needs cycle itself is already throttled:

```cpp
void USettlementPopulationComponent::ApplyFulfillmentToHappiness(
    float FoodRatio, float GoodsRatio, float ServiceRatio)
{
    const float CompositeFulfillment = (FoodRatio + GoodsRatio + ServiceRatio) / 3.f;
    const float Delta = (CompositeFulfillment - 0.5f) * HappinessSwingPerCycle; // +/- around neutral

    FGameplayEffectContextHandle Ctx = AbilitySystemComponent->MakeEffectContext();
    FGameplayEffectSpecHandle Spec = AbilitySystemComponent->MakeOutgoingSpec(
        GE_Settlement_NeedsFulfillment, /*Level=*/1.f, Ctx);
    Spec.Data->SetSetByCallerMagnitude(FGameplayTag::RequestGameplayTag("SetByCaller.NeedsFulfillment.HappinessDelta"), Delta);
    AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(*Spec.Data);
}
```

`GE_Settlement_NeedsFulfillment` is `Instant`, one modifier on `Happiness` via `SetByCaller`. This keeps all the math in the AttributeSet/GE layer — `TickNeedsCycle` only computes ratios and hands the delta to GAS; it never writes `Happiness` directly.

## Growth & tier-upgrade gates

`PostGameplayEffectExecute` (or a lightweight reaction bound to `GetGameplayAttributeValueChangeDelegate(Happiness)`) checks thresholds each cycle:

```cpp
void UHappinessAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data)
{
    Super::PostGameplayEffectExecute(Data);
    if (Data.EvaluatedData.Attribute != GetHappinessAttribute()) return;

    const float H = GetHappiness();
    USettlementPopulationComponent* Pop = GetOwningPopulationComponent();
    if (H >= Pop->GrowthThreshold())
    {
        SetGrowthPoints(GetGrowthPoints() + Pop->GrowthAccrualRate());
        SetExodusPressure(FMath::Max(0.f, GetExodusPressure() - Pop->ExodusRecoveryRate()));
        if (GetGrowthPoints() >= Pop->GrowthGate())
        {
            Pop->TryGrowPopulation(); // bounded by MaxPopulation; resets GrowthPoints
        }
        Pop->RemoveTag(SettlementTags::Unrest());
    }
    else if (H <= Pop->UnrestThreshold())
    {
        Pop->AddTag(SettlementTags::Unrest());
        SetExodusPressure(GetExodusPressure() + Pop->ExodusAccrualRate());
        if (GetExodusPressure() >= Pop->ExodusGate())
        {
            Pop->TriggerExodusWave(); // removes pops, may demote SettlementTier
        }
    }
}
```

`TryGrowPopulation()` picks a target unoccupied residence deterministically via the settlement's own `FRandomStream` (seeded `Hash(WorldSeed, SettlementID, GrowthEventIndex)` — never `FMath::Rand`), increments `PopulationCount`, and appends a `FSettlementDelta` entry (see below). Crossing a `SettlementTier` breakpoint (design-set: e.g. `PopulationCount >= 8` unlocks `SettlementTier.2`) grants the tier tag, which:

- Unlocks the matching `UDA_NeedsTier` row (new needs the settlement must now also satisfy).
- Raises the workforce ceiling `creature-work-assignment`'s `UWorkSchedulerSubsystem` can draw from for this settlement (higher `EAptitudeTier` slots become buildable/staffable).
- Awards a fixed `TechProgressionPoints` amount to the project's tech/unlock system (out of scope here — this skill only produces the award call site, e.g. `UTechProgressionSubsystem::AwardPoints(TierUpgradePoints)`).

## Unrest & exodus

`State.Settlement.Unrest` is granted/removed purely by the tag calls above — no gameplay code anywhere else checks a raw happiness float; everything downstream (residence build-rate penalties, worker efficiency in `creature-work-assignment`, ambient VFX/audio cues) reacts to the tag via `GameplayTagQuery` or a `UAbilityTask_WaitGameplayTag`.

`TriggerExodusWave()`:

```cpp
void USettlementPopulationComponent::TriggerExodusWave()
{
    const int32 Loss = FMath::Max(1, FMath::RoundToInt(PopulationCount * ExodusLossFraction));
    PopulationCount = FMath::Max(0, PopulationCount - Loss);
    HappinessAttributeSet->SetExodusPressure(0.f); // reset pressure after the wave fires
    if (PopulationCount < TierDemotionThreshold(SettlementTier))
    {
        DemoteSettlementTier();
    }
    AppendDelta(FSettlementDelta::MakeExodus(SettlementID, Loss, CurrentCycleIndex));
}
```

Sustained failure (not one bad cycle) is what triggers exodus — `ExodusPressure` accrues gradually and recovers whenever happiness clears the unrest threshold again, so a single supply hiccup never wipes a colony; only prolonged neglect does.

## Persistence — delta log, not snapshots

`USettlementPopulationComponent` never serializes `PopulationCount`/`SettlementTier`/`HappinessScore` directly into a save blob. Every mutating event appends a small struct to the world's delta log (the same log `procgen-world` and `building-system` write terrain/placement deltas into):

```cpp
USTRUCT()
struct FSettlementDelta
{
    GENERATED_BODY()
    UPROPERTY() FGuid SettlementID;
    UPROPERTY() ESettlementDeltaType Type; // Growth | TierUpgrade | Unrest | Exodus | Bind | Unbind
    UPROPERTY() int32 Magnitude = 0;       // pop delta, or 0 for tag-only events
    UPROPERTY() int32 CycleIndex = 0;      // deterministic ordering key
};
```

On load: regenerate the world from seed (`procgen-world`), reconstruct settlements from placed `ASettlementCenter`/`AResidenceBuilding` deltas (`building-system`), then replay `FSettlementDelta` entries in `CycleIndex` order to rebuild `PopulationCount`/`SettlementTier`/happiness state exactly. Replaying the same seed + delta log twice must produce an identical final `PopulationCount`/`SettlementTier` per settlement — this is what the Functional Test in the main `SKILL.md` asserts.

## Functional Test specs

- `<Project>.Settlement.Population.GrowsOnSustainedFulfillmentDecaysOnSustainedFailure` — stock the shared store above the active tier's needs for `GrowthGate / GrowthAccrualRate` cycles worth of headroom; assert `PopulationCount` increases and, once past the tier breakpoint, `SettlementTier` tag flips. Then drain the store below threshold for `ExodusGate / ExodusAccrualRate` cycles; assert `State.Settlement.Unrest` is granted, then `PopulationCount` decreases via `TriggerExodusWave`.
- `<Project>.Settlement.Population.DeterministicReplay` — run the growth scenario above once, capture the delta log, reload from `{seed, delta_log}` and replay; assert `PopulationCount`/`SettlementTier`/`Happiness` match bit-for-bit against the first run.
- `<Project>.Settlement.Population.SharedStoreConsumptionMatchesPlayerWithdrawal` — bind a player, have both the player's `eat` ability and a needs cycle draw from the same store in the same tick window; assert the store's final quantity equals the sum of both consumers' draws (no double-counting, no desync between the two read paths).
