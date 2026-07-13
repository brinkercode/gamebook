# Survival AttributeSet — C++ Template

`Source/<Project>/Public/Abilities/PlayerSurvivalAttributeSet.h` /
`Source/<Project>/Private/Abilities/PlayerSurvivalAttributeSet.cpp`

One `UAttributeSet` for all five vitals plus one meta attribute for incoming
environmental damage. Follows the AttributeSet Pattern in `agents/_shared/PATTERNS.md#attribute` —
this file only adds the survival-specific clamp/threshold/meta-attribute logic.

## Header

```cpp
// PlayerSurvivalAttributeSet.h
#pragma once

#include "AttributeSet.h"
#include "AbilitySystemComponent.h"
#include "PlayerSurvivalAttributeSet.generated.h"

// Standard accessor boilerplate macro (Epic's GASDocumentation pattern)
#define SURVIVAL_ATTRIBUTE_ACCESSORS(ClassName, PropertyName) \
    ATTRIBUTE_ACCESSORS(ClassName, PropertyName)

UCLASS()
class MYPROJECT_API UPlayerSurvivalAttributeSet : public UAttributeSet
{
    GENERATED_BODY()

public:
    UPlayerSurvivalAttributeSet();

    // ---- Vitals (all clamped 0..Max in PreAttributeChange) ----

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Hunger, Category = "Survival")
    FGameplayAttributeData Hunger;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, Hunger)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxHunger, Category = "Survival")
    FGameplayAttributeData MaxHunger;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, MaxHunger)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Thirst, Category = "Survival")
    FGameplayAttributeData Thirst;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, Thirst)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxThirst, Category = "Survival")
    FGameplayAttributeData MaxThirst;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, MaxThirst)

    // Temperature is signed and centers on a comfort band, e.g. -100..100,
    // 0 = neutral. Comfort band and freeze/overheat thresholds are data
    // (CT_SurvivalRates), not hardcoded here.
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Temperature, Category = "Survival")
    FGameplayAttributeData Temperature;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, Temperature)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Stamina, Category = "Survival")
    FGameplayAttributeData Stamina;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, Stamina)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxStamina, Category = "Survival")
    FGameplayAttributeData MaxStamina;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, MaxStamina)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Health, Category = "Survival")
    FGameplayAttributeData Health;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, Health)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxHealth, Category = "Survival")
    FGameplayAttributeData MaxHealth;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, MaxHealth)

    // ---- Meta attribute: not replicated, not clamped, exists for one frame ----
    // All environmental damage (starvation, dehydration, exposure) is applied
    // as EnvironmentDamage and converted to Health loss in PostGameplayEffectExecute.
    // Never let a GE modify Health directly for status-driven damage — always
    // route through this meta attribute so every damage source is auditable
    // in one place.
    UPROPERTY(BlueprintReadOnly, Category = "Survival")
    FGameplayAttributeData EnvironmentDamage;
    SURVIVAL_ATTRIBUTE_ACCESSORS(UPlayerSurvivalAttributeSet, EnvironmentDamage)

    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

protected:
    UFUNCTION() void OnRep_Hunger(const FGameplayAttributeData& Old)      { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, Hunger, Old); }
    UFUNCTION() void OnRep_MaxHunger(const FGameplayAttributeData& Old)   { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, MaxHunger, Old); }
    UFUNCTION() void OnRep_Thirst(const FGameplayAttributeData& Old)     { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, Thirst, Old); }
    UFUNCTION() void OnRep_MaxThirst(const FGameplayAttributeData& Old)  { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, MaxThirst, Old); }
    UFUNCTION() void OnRep_Temperature(const FGameplayAttributeData& Old){ GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, Temperature, Old); }
    UFUNCTION() void OnRep_Stamina(const FGameplayAttributeData& Old)    { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, Stamina, Old); }
    UFUNCTION() void OnRep_MaxStamina(const FGameplayAttributeData& Old) { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, MaxStamina, Old); }
    UFUNCTION() void OnRep_Health(const FGameplayAttributeData& Old)     { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, Health, Old); }
    UFUNCTION() void OnRep_MaxHealth(const FGameplayAttributeData& Old)  { GAMEPLAYATTRIBUTE_REPNOTIFY(UPlayerSurvivalAttributeSet, MaxHealth, Old); }

private:
    void CheckThresholdTags(const FGameplayEffectModCallbackData& Data);
};
```

## PreAttributeChange — clamp every vital

```cpp
void UPlayerSurvivalAttributeSet::PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue)
{
    Super::PreAttributeChange(Attribute, NewValue);

    if (Attribute == GetHungerAttribute())
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxHunger());
    else if (Attribute == GetThirstAttribute())
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxThirst());
    else if (Attribute == GetTemperatureAttribute())
        NewValue = FMath::Clamp(NewValue, -100.f, 100.f); // comfort band bounds, tune via CT_SurvivalRates
    else if (Attribute == GetStaminaAttribute())
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxStamina());
    else if (Attribute == GetHealthAttribute())
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxHealth());
}
```

Clamping here — not in the GE, not in BP — is load-bearing: it is the single
choke point a Functional Test can assert against regardless of which effect
caused the change (`Survival.AttributeSet.ClampBounds.NeverExceedMax`, see
`periodic-effects.md#tests`).

## PostGameplayEffectExecute — meta attribute → Health, threshold tags

```cpp
void UPlayerSurvivalAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data)
{
    Super::PostGameplayEffectExecute(Data);

    if (Data.EvaluatedData.Attribute == GetEnvironmentDamageAttribute())
    {
        const float DamageDone = GetEnvironmentDamage();
        SetEnvironmentDamage(0.f); // meta attribute never persists
        if (DamageDone > 0.f)
        {
            SetHealth(FMath::Clamp(GetHealth() - DamageDone, 0.f, GetMaxHealth()));
        }
    }

    // Re-evaluate threshold tags any time a vital that gates them changes.
    if (Data.EvaluatedData.Attribute == GetHungerAttribute()
        || Data.EvaluatedData.Attribute == GetThirstAttribute()
        || Data.EvaluatedData.Attribute == GetTemperatureAttribute()
        || Data.EvaluatedData.Attribute == GetStaminaAttribute())
    {
        CheckThresholdTags(Data);
    }
}
```

## Threshold tag reaction

Thresholds are `FGameplayTag`s, applied/removed on the ASC directly (loose
tags) or via a dedicated marker `GameplayEffect` — prefer the marker-GE form
so the tag's lifetime is visible in `ShowDebug AbilitySystem` and so the
debuff GE can be `GrantedTags`-linked instead of manually toggled:

```cpp
void UPlayerSurvivalAttributeSet::CheckThresholdTags(const FGameplayEffectModCallbackData& Data)
{
    UAbilitySystemComponent* ASC = GetOwningAbilitySystemComponent();
    if (!ASC) return;

    static const FGameplayTag Tag_Starving  = FGameplayTag::RequestGameplayTag(FName("State.Starving"));
    static const FGameplayTag Tag_Dehydrated= FGameplayTag::RequestGameplayTag(FName("State.Dehydrated"));
    static const FGameplayTag Tag_Freezing  = FGameplayTag::RequestGameplayTag(FName("State.Freezing"));
    static const FGameplayTag Tag_Overheat  = FGameplayTag::RequestGameplayTag(FName("State.Overheating"));
    static const FGameplayTag Tag_Exhausted = FGameplayTag::RequestGameplayTag(FName("State.Exhausted"));

    auto SyncTag = [ASC](const FGameplayTag& Tag, bool bShouldHave)
    {
        const bool bHas = ASC->HasMatchingGameplayTag(Tag);
        if (bShouldHave && !bHas) ASC->AddLooseGameplayTag(Tag);
        else if (!bShouldHave && bHas) ASC->RemoveLooseGameplayTag(Tag);
    };

    SyncTag(Tag_Starving,   GetHunger()      <= 0.f);
    SyncTag(Tag_Dehydrated, GetThirst()      <= 0.f);
    SyncTag(Tag_Freezing,   GetTemperature() <= -80.f);  // tune via CT_SurvivalRates thresholds
    SyncTag(Tag_Overheat,   GetTemperature() >=  80.f);
    SyncTag(Tag_Exhausted,  GetStamina()     <= 0.f);
}
```

**Loose tags vs marker GEs**: loose tags (above) are simplest and sufficient
for driving HUD state and `ActivationBlockedTags` checks. If the project
needs the tag's *duration* to survive a respawn/relog without re-deriving it
from current vitals, promote this to a dedicated `Infinite` marker
`GameplayEffect` (`GE_State_Starving`) applied/removed instead of loose tags
— same trigger logic, `ASC->ApplyGameplayEffectToSelf` / `RemoveActiveGameplayEffectBySourceEffect`
in place of `AddLooseGameplayTag`/`RemoveLooseGameplayTag`.

The debuff itself (e.g. starvation damage-over-time) is a separate `Infinite`
GE (`GE_Starvation_HealthDrain`) with `Application Requirement: ASC has tag
State.Starving` — see `periodic-effects.md#threshold-debuffs`. This keeps
"detect the threshold" and "apply the consequence" as two independently
testable steps.

## GetLifetimeReplicatedProps — replication mode per attribute

Per the skill's replication rule: Health/MaxHealth are visible to everyone
(other players' HUD, hit-reaction anims); Hunger/Thirst/Temperature/Stamina
are private unless the project wants visible status icons.

```cpp
void UPlayerSurvivalAttributeSet::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, Health,    COND_None,       REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, MaxHealth, COND_None,       REPNOTIFY_Always);

    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, Stamina,    COND_None,      REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, MaxStamina, COND_None,      REPNOTIFY_Always);

    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, Hunger,      COND_OwnerOnly, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, MaxHunger,   COND_OwnerOnly, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, Thirst,      COND_OwnerOnly, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, MaxThirst,   COND_OwnerOnly, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UPlayerSurvivalAttributeSet, Temperature, COND_OwnerOnly, REPNOTIFY_Always);
}
```

`COND_OwnerOnly` matters both for bandwidth (single-player projects don't
care, but a Palworld/Anno-shaped multiplayer base-building project has many
simulated actors) and for design intent — other players should not read a
survivor's exact hunger value off the wire, only the coarse `State.*` tags
which are gameplay tags on the ASC, replicated separately and
intentionally-visible (or not) per `ASC->ReplicationMode`.

## Single-set vs split-set

This skill assumes **one** `UPlayerSurvivalAttributeSet` for all five vitals.
Split into `UVitalsAttributeSet` (Health/Stamina, visible) +
`USurvivalNeedsAttributeSet` (Hunger/Thirst/Temperature, private) only if
profiling shows the combined replication payload matters, or if
non-player-controlled pawns (tamed creatures in a Palworld-shaped project)
need Health/Stamina without Hunger/Thirst/Temperature — in that case the
creature AttributeSet reuses the Vitals half only. Keep it as one set by
default; splitting is an optimization, not a starting point.
