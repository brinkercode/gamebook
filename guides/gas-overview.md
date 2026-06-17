# GAS Overview — Gameplay Ability System Onboarding

> The Gameplay Ability System (GAS) is a battle-tested UE framework for authoring abilities, status effects, and character stats in a data-driven, network-aware way. Every combat mechanic, buff/debuff, status effect, and character attribute in this project goes through GAS — no ad-hoc health float mutation, no custom damage dispatch outside it. This document covers the conceptual model, the five core objects, and practical setup patterns for a new project.

---

## The Five Core Objects

| Object | Class | What it does |
|--------|-------|-------------|
| Ability System Component | `UAbilitySystemComponent` (ASC) | The hub — lives on Actor, owns abilities, attributes, and effects |
| Gameplay Ability | `UGameplayAbility` | One discrete action (fire weapon, sprint, roll) |
| Gameplay Effect | `UGameplayEffect` | Stateless mutation spec — how attributes change |
| Attribute Set | `UAttributeSet` | Float attributes (Health, Stamina, Armor) with replication |
| Gameplay Tag | `FGameplayTag` | Hierarchical string key — abilities, states, damage types, input |

Every ability reads and writes attributes only via Gameplay Effects. Never modify `AttributeSet` members directly outside the GAS pipeline.

---

## Conceptual Flow

```
Player presses [Fire]
  └─ Enhanced Input → InputTag.Ability.PrimaryFire
        └─ ASC::AbilityInputTagPressed()
              └─ Activates GA_PrimaryFire
                    ├─ Checks Cost GE (ammo ≥ 1)
                    ├─ Checks Cooldown GE (0.1s fire rate)
                    ├─ Plays fire montage via AbilityTask_PlayMontageAndWait
                    ├─ Spawns projectile (server)
                    └─ Applies GE_BulletDamage to target's ASC
                          └─ GE modifies Target.Health attribute
                                └─ HealthComponent.OnHealthChanged broadcasts
                                      └─ WB_HUD updates health bar
```

No step in this chain knows about any other step beyond its immediate dependency.

---

## Attribute Set

Attribute sets hold `FGameplayAttributeData` members — each is a (Base, Current) pair. Define one set per concern: combat stats separate from stamina separate from economy.

### GAS_CombatAttributeSet.h

```cpp
#pragma once
#include "AttributeSet.h"
#include "AbilitySystemComponent.h"
#include "GAS_CombatAttributeSet.generated.h"

// Boilerplate accessor macro — generates GetHealth(), SetHealth(), GetHealthAttribute()
#define ATTRIBUTE_ACCESSORS(ClassName, PropertyName) \
    GAMEPLAYATTRIBUTE_PROPERTY_GETTER(ClassName, PropertyName) \
    GAMEPLAYATTRIBUTE_VALUE_GETTER(PropertyName) \
    GAMEPLAYATTRIBUTE_VALUE_SETTER(PropertyName) \
    GAMEPLAYATTRIBUTE_VALUE_INITTER(PropertyName)

UCLASS()
class PROJECTNAME_API UGAS_CombatAttributeSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    UGAS_CombatAttributeSet();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;

    // Health
    UPROPERTY(BlueprintReadOnly, Category="Attributes", ReplicatedUsing=OnRep_Health)
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UGAS_CombatAttributeSet, Health)

    UPROPERTY(BlueprintReadOnly, Category="Attributes", ReplicatedUsing=OnRep_MaxHealth)
    FGameplayAttributeData MaxHealth;
    ATTRIBUTE_ACCESSORS(UGAS_CombatAttributeSet, MaxHealth)

    // Meta attribute — damage incoming before reduction; not replicated
    UPROPERTY(BlueprintReadOnly, Category="Attributes")
    FGameplayAttributeData IncomingDamage;
    ATTRIBUTE_ACCESSORS(UGAS_CombatAttributeSet, IncomingDamage)

    UPROPERTY(BlueprintReadOnly, Category="Attributes", ReplicatedUsing=OnRep_Armor)
    FGameplayAttributeData Armor;
    ATTRIBUTE_ACCESSORS(UGAS_CombatAttributeSet, Armor)

protected:
    UFUNCTION()
    virtual void OnRep_Health(const FGameplayAttributeData& OldValue);
    UFUNCTION()
    virtual void OnRep_MaxHealth(const FGameplayAttributeData& OldValue);
    UFUNCTION()
    virtual void OnRep_Armor(const FGameplayAttributeData& OldValue);
};
```

### GAS_CombatAttributeSet.cpp

```cpp
#include "AbilitySystem/Attributes/GAS_CombatAttributeSet.h"
#include "Net/UnrealNetwork.h"
#include "GameplayEffectExtension.h"

UGAS_CombatAttributeSet::UGAS_CombatAttributeSet()
{
    InitHealth(100.f);
    InitMaxHealth(100.f);
    InitArmor(0.f);
}

void UGAS_CombatAttributeSet::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME_CONDITION_NOTIFY(UGAS_CombatAttributeSet, Health,    COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGAS_CombatAttributeSet, MaxHealth, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGAS_CombatAttributeSet, Armor,     COND_None, REPNOTIFY_Always);
}

void UGAS_CombatAttributeSet::PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue)
{
    Super::PreAttributeChange(Attribute, NewValue);
    // Clamp Health to [0, MaxHealth]
    if (Attribute == GetHealthAttribute())
    {
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxHealth());
    }
}

void UGAS_CombatAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data)
{
    Super::PostGameplayEffectExecute(Data);

    if (Data.EvaluatedData.Attribute == GetIncomingDamageAttribute())
    {
        const float Damage  = GetIncomingDamage();
        const float Reduced = FMath::Max(0.f, Damage - GetArmor());
        SetIncomingDamage(0.f);  // Clear meta attribute

        const float NewHealth = FMath::Max(0.f, GetHealth() - Reduced);
        SetHealth(NewHealth);
    }
}

void UGAS_CombatAttributeSet::OnRep_Health(const FGameplayAttributeData& OldValue)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGAS_CombatAttributeSet, Health, OldValue);
}
void UGAS_CombatAttributeSet::OnRep_MaxHealth(const FGameplayAttributeData& OldValue)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGAS_CombatAttributeSet, MaxHealth, OldValue);
}
void UGAS_CombatAttributeSet::OnRep_Armor(const FGameplayAttributeData& OldValue)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGAS_CombatAttributeSet, Armor, OldValue);
}
```

The `IncomingDamage` pattern (meta attribute) is idiomatic GAS: the Gameplay Effect writes to IncomingDamage; `PostGameplayEffectExecute` reads it, applies armor reduction, then writes the final value to Health. This keeps damage formula logic in one place.

---

## Gameplay Ability

Every ability subclasses `UGA_BaseGameplayAbility`, which sets defaults and provides helper accessors.

### GA_BaseGameplayAbility.h

```cpp
UCLASS(Abstract)
class PROJECTNAME_API UGA_BaseGameplayAbility : public UGameplayAbility
{
    GENERATED_BODY()
public:
    UGA_BaseGameplayAbility();

    // The Enhanced Input tag that activates this ability.
    UPROPERTY(EditDefaultsOnly, Category="Input")
    FGameplayTag InputTag;

protected:
    // Helper: typed ASC access
    UGAS_AbilitySystemComponent* GetProjectASC() const;
    AProjectNameCharacter* GetProjectCharacter() const;
    AProjectNamePlayerController* GetProjectPlayerController() const;
};
```

### GA_Sprint.cpp — a minimal ability example

```cpp
#include "AbilitySystem/Abilities/GA_Sprint.h"
#include "AbilitySystemComponent.h"
#include "ProjectNameGameplayTags.h"

UGA_Sprint::UGA_Sprint()
{
    // Instancing: InstancedPerActor lets the ability cache state across frames
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;

    // Blocked while dead
    ActivationBlockedTags.AddTag(ProjectNameGameplayTags::Status_Death);
}

bool UGA_Sprint::CanActivateAbility(const FGameplayAbilitySpecHandle Handle,
                                    const FGameplayAbilityActorInfo* ActorInfo,
                                    const FGameplayTagContainer* SourceTags,
                                    const FGameplayTagContainer* TargetTags,
                                    FGameplayTagContainer* OptionalRelevantTags) const
{
    if (!Super::CanActivateAbility(Handle, ActorInfo, SourceTags, TargetTags, OptionalRelevantTags))
    {
        return false;
    }
    // Example: require minimum stamina
    if (const UGAS_CombatAttributeSet* Attrs = GetProjectASC()->GetSet<UGAS_CombatAttributeSet>())
    {
        return Attrs->GetStamina() > 0.f;
    }
    return true;
}

void UGA_Sprint::ActivateAbility(const FGameplayAbilitySpecHandle Handle,
                                  const FGameplayAbilityActorInfo* ActorInfo,
                                  const FGameplayAbilityActivationInfo ActivationInfo,
                                  const FGameplayEventData* TriggerEventData)
{
    Super::ActivateAbility(Handle, ActorInfo, ActivationInfo, TriggerEventData);

    // Apply the speed boost + stamina drain effect
    FGameplayEffectContextHandle Context = MakeEffectContext();
    FGameplayEffectSpecHandle Spec = MakeOutgoingGameplayEffectSpec(SprintEffect, GetAbilityLevel());
    ApplyGameplayEffectSpecToOwner(Handle, ActorInfo, ActivationInfo, Spec);
}

void UGA_Sprint::InputReleased(const FGameplayAbilitySpecHandle Handle,
                                const FGameplayAbilityActorInfo* ActorInfo,
                                const FGameplayAbilityActivationInfo ActivationInfo)
{
    EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
}

void UGA_Sprint::EndAbility(const FGameplayAbilitySpecHandle Handle,
                             const FGameplayAbilityActorInfo* ActorInfo,
                             const FGameplayAbilityActivationInfo ActivationInfo,
                             bool bReplicateEndAbility, bool bWasCancelled)
{
    // Remove sprint effect on end
    GetAbilitySystemComponentFromActorInfo()->RemoveActiveGameplayEffectBySourceEffect(
        SprintEffect, GetAbilitySystemComponentFromActorInfo());

    Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
```

---

## Gameplay Effects

Effects are data assets — no C++ logic. Create them in-editor: `Content/Core/GAS/Effects/`.

| Effect type | Duration policy | When to use |
|-------------|----------------|-------------|
| Instant | `Instant` | One-shot attribute mutation (apply damage) |
| Duration | `HasDuration` | Timed buff/debuff (5s speed boost) |
| Infinite | `Infinite` | Passive while condition holds (sprint active) |

**GE_BulletDamage setup (Instant):**
```
Duration Policy:  Instant
Modifiers:
  Attribute:  UGAS_CombatAttributeSet.IncomingDamage
  Op:         Add
  Magnitude:  Scalable Float Curve → BaseDamage row in DT_DamageMultipliers
Granted Tags on Apply: (none)
Application Requirement: (none, always apply)
```

**GE_SpeedBoost_Sprint (Infinite):**
```
Duration Policy:  Infinite
Modifiers:
  Attribute:  UGAS_MovementAttributeSet.MaxWalkSpeed
  Op:         Multiply
  Magnitude:  1.5 (Scalable Float, constant)
Granted Tags: Status.Sprinting
Removal Tags: (cleared when ability ends via RemoveActiveGameplayEffectBySourceEffect)
```

---

## Ability Granting via DA_AbilitySet

Never call `GiveAbility()` directly from character code. The `UDA_AbilitySet` data asset batches grants:

```cpp
// DA_AbilitySet.cpp
void UDA_AbilitySet::GiveToAbilitySystem(UAbilitySystemComponent* ASC,
                                          TArray<FGameplayAbilitySpecHandle>* OutHandles) const
{
    check(ASC);
    check(ASC->IsOwnerActorAuthoritative());

    for (const FAttributeSetEntry& Entry : GrantedAttributeSets)
    {
        ASC->AddAttributeSetSubobject(NewObject<UAttributeSet>(ASC, Entry.AttributeSet));
    }

    for (const FAbilitySetEntry& Entry : GrantedAbilities)
    {
        FGameplayAbilitySpec Spec(Entry.Ability, Entry.Level);
        Spec.DynamicAbilityTags.AddTag(Entry.InputTag);
        FGameplayAbilitySpecHandle Handle = ASC->GiveAbility(Spec);
        if (OutHandles) { OutHandles->Add(Handle); }
    }

    for (const TSubclassOf<UGameplayEffect>& GEClass : GrantedEffects)
    {
        FGameplayEffectContextHandle Context = ASC->MakeEffectContext();
        ASC->ApplyGameplayEffectToSelf(
            GetDefault<UGameplayEffect>(GEClass), 1.f, Context);
    }
}
```

---

## Gameplay Tag Queries

Use tag queries to check state — never boolean flags:

```cpp
// Is the character currently sprinting?
bool bSprinting = AbilitySystemComponent->HasMatchingGameplayTag(
    ProjectNameGameplayTags::Status_Sprinting);

// Can fire? (not dead, not stunned, not reloading)
FGameplayTagContainer BlockedTags;
BlockedTags.AddTag(ProjectNameGameplayTags::Status_Death);
BlockedTags.AddTag(ProjectNameGameplayTags::Status_Stunned);
BlockedTags.AddTag(ProjectNameGameplayTags::Status_Reloading);
bool bCanFire = !AbilitySystemComponent->HasAnyMatchingGameplayTags(BlockedTags);
```

---

## Cue — Visual / Audio Feedback

Gameplay Cues trigger VFX and sound in response to GAS events. They are cosmetic only — never replicated game state.

```
GameplayCue.Character.HitReact       → Niagara hit flash + Wwise hit impact event
GameplayCue.Weapon.MuzzleFlash       → NS_MuzzleFlash spawn at muzzle socket
GameplayCue.Character.Death          → ragdoll enable + death sound event
```

Register cues in `Config/DefaultGame.ini`:
```ini
[/Script/GameplayAbilities.AbilitySystemGlobals]
+GameplayCueNotifyPaths=/Game/Core/GAS/Cues
```

Trigger from a Gameplay Effect:
```
GE_BulletDamage → GameplayCueTag: GameplayCue.Character.HitReact
```

Or from ability C++:
```cpp
FGameplayCueParameters Params;
Params.SourceObject = this;
AbilitySystemComponent->ExecuteGameplayCue(
    FGameplayTag::RequestGameplayTag("GameplayCue.Weapon.MuzzleFlash"), Params);
```

---

## GAS Initialization — Server vs. Client

For a player character, the ASC lives on the Pawn but the PlayerState is a common alternative for multiplayer. This project puts the ASC on the Character for singleplayer-default simplicity; see [replication-overview.md](replication-overview.md) for the multiplayer pattern.

```cpp
// Pawn-owned ASC: initialize on both server and client
void AProjectNameCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    // Server: initialize ASC
    AbilitySystemComponent->InitAbilityActorInfo(this, this);
    if (DefaultAbilitySet) { DefaultAbilitySet->GiveToAbilitySystem(AbilitySystemComponent, nullptr); }
}

void AProjectNameCharacter::OnRep_PlayerState()
{
    Super::OnRep_PlayerState();
    // Client: re-init ASC actor info after replication
    AbilitySystemComponent->InitAbilityActorInfo(this, this);
}
```

---

## Key Rules

1. **All attribute mutation through GAS Effects** — never `AttributeSet->SetHealth(x)` from game code.
2. **Meta attributes for damage math** — write to `IncomingDamage`, compute reduction in `PostGameplayEffectExecute`, write result to `Health`.
3. **Tags describe all game state** — `Status.Dead`, `Status.Stunned`, `Status.Reloading`. No boolean flags on Character.
4. **Abilities granted from DA_AbilitySet data assets** — never hardcoded `GiveAbility()` calls scattered in C++.
5. **Cues are cosmetic** — they never change game state. Missing a cue is a visual bug, not a gameplay bug.
6. **`InstancedPerActor` for stateful abilities** — `NonInstanced` only for very simple fire-and-forget abilities with no per-activation state.
7. **`LocalPredicted` for responsive feel** — ability activates immediately on client, server confirms. Use `ServerPredictedAbility` pattern in [replication-overview.md](replication-overview.md) for authority corrections.
