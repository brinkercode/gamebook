# Creature Data — species Data Assets and attribute sets

## `UDA_CreatureSpecies` — Primary Data Asset

One instance per species. Programmers add fields; designers (`design-technical`) fill in values per species. Consumed by `pcg-biome-population` for spawn-marker weighting, by the capture chain for difficulty, and by `creature-work-assignment` for aptitude-based job scoring.

```cpp
// Source/<Project>/Public/Creatures/DA_CreatureSpecies.h
UCLASS(BlueprintType)
class MYGAME_API UDA_CreatureSpecies : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId("CreatureSpecies", SpeciesID);
    }

    UPROPERTY(EditAnywhere, Category = "Identity")
    FName SpeciesID;                              // e.g. "Grubcat", "Emberhorn"

    UPROPERTY(EditAnywhere, Category = "Identity")
    FText DisplayName;

    UPROPERTY(EditAnywhere, Category = "Visuals")
    TSoftObjectPtr<USkeletalMesh> Mesh;

    UPROPERTY(EditAnywhere, Category = "Visuals")
    TSubclassOf<AActor> CreaturePawnClass;         // BP_Creature_<Species>

    // --- Combat attribute defaults (seeds UCreatureCombatAttributeSet on spawn) ---
    UPROPERTY(EditAnywhere, Category = "Attributes")
    float BaseHealth = 100.f;

    UPROPERTY(EditAnywhere, Category = "Attributes")
    float BaseStamina = 50.f;

    UPROPERTY(EditAnywhere, Category = "Attributes")
    float BaseMoveSpeed = 350.f;

    // --- Work aptitudes: gameplay-tag-keyed float 0..1, consumed by creature-work-assignment ---
    UPROPERTY(EditAnywhere, Category = "Work")
    TMap<FGameplayTag, float> WorkAptitudes;       // e.g. Work.Gathering.Mining -> 0.9, Work.Farming -> 0.2

    // --- Capture tuning ---
    UPROPERTY(EditAnywhere, Category = "Capture")
    UCurveFloat* CaptureDifficultyCurve;           // X = remaining Health %, Y = base capture chance

    UPROPERTY(EditAnywhere, Category = "Capture")
    float CaptureDifficultyMultiplier = 1.f;       // per-species flat modifier applied after the curve

    // --- Spawn weighting, consumed by pcg-biome-population's DT_BiomeScatterParams pipeline ---
    UPROPERTY(EditAnywhere, Category = "Spawn")
    TMap<FGameplayTag, float> BiomeSpawnWeights;   // Biome.Forest -> 0.6, Biome.Tundra -> 0.05

    UPROPERTY(EditAnywhere, Category = "Spawn")
    int32 MaxConcurrentInWorld = 40;               // soft population cap per world region

    // --- Breeding (optional section, see #breeding) ---
    UPROPERTY(EditAnywhere, Category = "Breeding")
    bool bBreedable = false;

    UPROPERTY(EditAnywhere, Category = "Breeding", meta = (EditCondition = "bBreedable"))
    TArray<FGameplayTag> InheritableTraitTags;     // Trait.Docile, Trait.HighYield, ...
};
```

**Rules:**
- `SpeciesID` is stable and never renamed once shipped — it's the `FPrimaryAssetId` key referenced by save games and roster entries.
- `WorkAptitudes` and `BiomeSpawnWeights` are `TMap<FGameplayTag, float>` — sparse, so a species only lists the tags it's relevant for. Missing entries default to 0 aptitude / 0 spawn weight at read time.
- Asset Manager registers `CreatureSpecies` as a Primary Asset Type in `Config/DefaultGame.ini` under `[/Script/Engine.AssetManagerSettings]` so `pcg-biome-population` and `creature-work-assignment` can bulk-load by type without hardcoded soft-object arrays.

## `UCreatureCombatAttributeSet`

Mirrors the player's vitals pattern (`survival-stats`) but scoped to the creature actor — do not reuse the player's AttributeSet class.

```cpp
// Source/<Project>/Public/Creatures/CreatureCombatAttributeSet.h
UCLASS()
class MYGAME_API UCreatureCombatAttributeSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    ATTRIBUTE_ACCESSORS(UCreatureCombatAttributeSet, Health)
    ATTRIBUTE_ACCESSORS(UCreatureCombatAttributeSet, MaxHealth)
    ATTRIBUTE_ACCESSORS(UCreatureCombatAttributeSet, Stamina)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Health)
    FGameplayAttributeData Health;
    UFUNCTION() void OnRep_Health(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UCreatureCombatAttributeSet, Health, Old); }

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxHealth)
    FGameplayAttributeData MaxHealth;
    UFUNCTION() void OnRep_MaxHealth(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UCreatureCombatAttributeSet, MaxHealth, Old); }

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Stamina)
    FGameplayAttributeData Stamina;
    UFUNCTION() void OnRep_Stamina(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UCreatureCombatAttributeSet, Stamina, Old); }

    virtual void PreAttributeChange(const FGameplayAttribute& Attr, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
};
```

`Health`/`MaxHealth` are seeded from `UDA_CreatureSpecies::BaseHealth` in the creature pawn's `BeginPlay` via `AbilitySystemComponent->SetNumericAttributeBase(...)` (or an `Instant` init `UGameplayEffect`, preferred — never set the raw attribute outside a GE outside of initial spawn seeding).

## `UCreatureLoyaltyAttributeSet`

Separate set — loyalty/hunger are the taming-specific vitals, kept distinct from combat so a wild creature (no owner yet) never carries them uninitialized.

```cpp
// Source/<Project>/Public/Creatures/CreatureLoyaltyAttributeSet.h
UCLASS()
class MYGAME_API UCreatureLoyaltyAttributeSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    ATTRIBUTE_ACCESSORS(UCreatureLoyaltyAttributeSet, Loyalty)
    ATTRIBUTE_ACCESSORS(UCreatureLoyaltyAttributeSet, Hunger)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Loyalty)
    FGameplayAttributeData Loyalty;   // 0..100, clamped in PreAttributeChange
    UFUNCTION() void OnRep_Loyalty(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UCreatureLoyaltyAttributeSet, Loyalty, Old); }

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Hunger)
    FGameplayAttributeData Hunger;    // 0..100, clamped in PreAttributeChange
    UFUNCTION() void OnRep_Hunger(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UCreatureLoyaltyAttributeSet, Hunger, Old); }

    virtual void PreAttributeChange(const FGameplayAttribute& Attr, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
};
```

**Rules:**
- Only granted to the ability system when a creature is captured (roster insertion) — wild creatures don't carry this set, keeping the wild-AI `UAbilitySystemComponent` lean.
- `GE_Creature_Hunger_Drain` (Infinite, Period) mirrors `survival-stats`' periodic drain pattern exactly; low `Hunger` triggers a `State.Creature.Unhappy` tag which reduces `Loyalty` regen and (per project design) work-output aptitude in `creature-work-assignment`.
- `Loyalty` decay/regen rates pull from `CT_CreatureLoyaltyRates` `CurveTable` via `FScalableFloat` — never hardcoded per-species in C++; per-species multipliers, if any, come from `UDA_CreatureSpecies` fields added alongside `CaptureDifficultyMultiplier`.
- Replicated `COND_OwnerOnly` — other players don't need to see a creature's private loyalty/hunger values unless the project's design explicitly wants shared-base visibility, in which case widen the condition deliberately (don't default to public).

## Breeding / trait inheritance (optional)

Only build this if the project design calls for it. Skip entirely for projects without a breeding loop.

- Breeding is a `GA_Creature_Breed` ability activated on two roster creatures with `bBreedable = true` species, `NetExecutionPolicy::ServerInitiated`.
- Offspring species and inherited `InheritableTraitTags` are resolved by a **seeded** roll: `Seed = WorldSeed + ParentAInstanceID + ParentBInstanceID + BreedAttemptCount`. Same seed inputs always produce the same offspring trait set — required for save/replay determinism, not for player-visible "RNG fairness" theater.
- Trait tags modify `WorkAptitudes` and `CaptureDifficultyMultiplier`-equivalent fields at the *instance* level (an `FCreatureRosterEntry` override map), not at the species Data Asset level — the species asset defines the population baseline, instance overrides are per-creature save data.
- Offspring enters the roster directly (no capture step) via the same roster-insertion path described in `capture-flow.md#roster-handoff`, tagged `Origin.Bred` instead of `Origin.Captured` for UI/analytics.
