---
paths:
  - "Source/**/Abilities/**"
  - "Source/**/Attributes/**"
  - "Source/**/Effects/**"
  - "Content/Core/Abilities/**"
  - "Content/Core/Data/**"
---

# UE5 Gameplay Ability System (GAS) Rules

## Stack

- **`UAbilitySystemComponent` (ASC)** on every Actor that has abilities or attributes.
- **`UGameplayAbility` subclass** for every discrete player/enemy capability (fire, dash, reload, stun).
- **`UGameplayEffect` subclass** (or Blueprint) for every attribute modification and temporary state.
- **`UAttributeSet` subclass** for every group of numeric attributes (Health, Stamina, Ammo, Resources).
- **`FGameplayTag`** for all state flags, ability triggers, effect categories, and hit react types.

## UAbilitySystemComponent setup

```cpp
// Character.h
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GAS")
TObjectPtr<UAbilitySystemComponent> AbilitySystemComponent;

UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GAS")
TObjectPtr<UMyAttributeSet> AttributeSet;

// IAbilitySystemInterface — required for GAS to find the ASC on the actor
virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;
```

```cpp
// Character.cpp
UAbilitySystemComponent* AMyCharacter::GetAbilitySystemComponent() const
{
    return AbilitySystemComponent;
}
```

- **Implement `IAbilitySystemInterface`** on every Actor that has an ASC. Without it, `UAbilitySystemBlueprintLibrary::GetAbilitySystemComponent` fails silently.
- **Initialize the ASC on `PossessedBy` (server) and `OnRep_PlayerState` (client)** for player-controlled characters. For AI, initialize in `BeginPlay`.
- **`PlayerState` owns the ASC for player characters** — not `Character`. This survives respawn without losing granted abilities and attributes.

## GameplayAbility lifecycle

```cpp
UCLASS()
class UGA_PrimaryFire : public UGameplayAbility
{
    GENERATED_BODY()
public:
    UGA_PrimaryFire();

    virtual bool CanActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayTagContainer* SourceTags,
        const FGameplayTagContainer* TargetTags,
        FGameplayTagContainer* OptionalRelevantTags) const override;

    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,
        bool bWasCancelled) override;
};
```

- **Always call `Super::ActivateAbility`** at the start. Always call `EndAbility` when done — abilities that never call `EndAbility` block re-activation forever.
- **`CommitAbility` before applying costs/cooldowns** — `CommitAbility(Handle, ActorInfo, ActivationInfo)` checks and consumes cost + cooldown atomically. If it returns false, call `EndAbility` immediately.
- **Use `AbilityTasks` for async waits** — `UAbilityTask_WaitGameplayEvent`, `UAbilityTask_PlayMontageAndWait`, `UAbilityTask_WaitInputRelease`. Never tick or use latent actions inside an ability.
- **`Instancing Policy`**: `InstancedPerActor` for abilities with state (most abilities). `NonInstanced` only for trivially stateless, high-frequency abilities. `InstancedPerExecution` for rare, complex abilities that need isolated state per activation.

## GameplayEffect duration types

| Type | Use case | Example |
|---|---|---|
| `Instant` | Permanent attribute change applied once | Damage, heal, ammo pickup |
| `Duration` | Temporary modifier, expires after N seconds | Speed boost (5s), shield (10s) |
| `Infinite` | Persistent modifier, removed by effect removal API | Passive stat buff from equipped item |

```cpp
// Apply a Duration GE — 5-second stun
FGameplayEffectSpecHandle SpecHandle = ASC->MakeOutgoingSpec(
    StunEffectClass, AbilityLevel, ASC->MakeEffectContext());
ASC->ApplyGameplayEffectSpecToSelf(*SpecHandle.Data.Get());

// Remove an Infinite GE
FActiveGameplayEffectHandle ActiveHandle = ASC->ApplyGameplayEffectToSelf(...);
ASC->RemoveActiveGameplayEffect(ActiveHandle);
```

- **Never hard-code duration values in C++** — Duration effects read from `UGameplayEffect` `Duration.Magnitude` which is configured in the asset (Data Asset or Blueprint subclass).
- **Stack policy matters** — `AggregateBySource` for per-instigator stacks (bleed from multiple enemies). `AggregateByTarget` for global stacks (vulnerability debuff).
- **`GrantedTags` on effects, not on characters** — the effect grants a gameplay tag to the owner while it's active. `ASC->HasMatchingGameplayTag()` queries it. Never manually add/remove tags.

## AttributeSet rules

```cpp
UCLASS()
class UMyHealthSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadOnly, Category="Health", ReplicatedUsing=OnRep_Health)
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UMyHealthSet, Health)   // Generates GetHealth(), SetHealth(), GetHealthAttribute()

    UPROPERTY(BlueprintReadOnly, Category="Health", ReplicatedUsing=OnRep_MaxHealth)
    FGameplayAttributeData MaxHealth;
    ATTRIBUTE_ACCESSORS(UMyHealthSet, MaxHealth)

    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;

    UFUNCTION()
    virtual void OnRep_Health(const FGameplayAttributeData& OldHealth);
    UFUNCTION()
    virtual void OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth);
};
```

- **Use `ATTRIBUTE_ACCESSORS` macro** — generates `GetX()`, `SetX()`, `GetXAttribute()` accessors. Never hand-write these.
- **`PreAttributeChange` for clamping, `PostGameplayEffectExecute` for side effects** — clamp `Health` to `[0, MaxHealth]` in `PreAttributeChange`. Trigger death in `PostGameplayEffectExecute` when `Health <= 0`.
- **Never write directly to `FGameplayAttributeData`** — all writes go through `UGameplayEffect`. The only exception is initialization in `InitFromMetaDataTable()`.
- **Separate AttributeSets per concern** — `UHealthSet`, `UMovementSet`, `UCombatResourceSet`. One flat attribute set with 50 attributes is unmanageable.
- **Replicate every attribute with `OnRep_`** — attributes do not automatically replicate. `GAMEPLAYATTRIBUTE_REPNOTIFY(UMyHealthSet, Health, OldHealth)` must appear in `OnRep_Health`.

## GameplayTags

```cpp
// In a module's header, or a dedicated GameplayTags.h
namespace MyGameTags
{
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Status_Stunned)
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Ability_PrimaryFire)
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Effect_Damage_Fire)
}

// In the .cpp
UE_DEFINE_GAMEPLAY_TAG(MyGameTags::Status_Stunned,    "Status.Stunned")
UE_DEFINE_GAMEPLAY_TAG(MyGameTags::Ability_PrimaryFire, "Ability.PrimaryFire")
UE_DEFINE_GAMEPLAY_TAG(MyGameTags::Effect_Damage_Fire,  "Effect.Damage.Fire")
```

- **All tags defined in C++** via `UE_DECLARE_GAMEPLAY_TAG_EXTERN` / `UE_DEFINE_GAMEPLAY_TAG`. Never define canonical tags only in Blueprint or a DataTable — they become magic strings.
- **Hierarchical naming** — `Status.Stunned`, `Status.Burning`, `Ability.Primary.Fire`, `Ability.Secondary.Dash`. Parent tags match on any child: `HasTag("Status")` matches `Status.Stunned`.
- **Register tags in a `GameplayTags.ini` or `DefaultGameplayTags.ini`** to get editor autocomplete. Generated from `UE_DEFINE_GAMEPLAY_TAG` via the tag registration system.
- **Query with `HasMatchingGameplayTag` and `HasAllMatchingGameplayTags`** — not string comparison. Never `TagName == "Status.Stunned"`.
- **`BlockedAbilityTags` and `CancelAbilitiesWithTag`** on `UGameplayAbility` — abilities that should block or cancel each other declare it in their Ability Tags config, not in C++ if/else chains.

## Prediction and client-side responsiveness

- **`FPredictionKey` on every ability** — ability activations are predicted client-side. The server confirms or rolls back.
- **`ActivationInfo.ActivationMode`** — check `EGameplayAbilityActivationMode::Predicting` vs `Authority` to branch cosmetic-only vs authoritative work.
- **`WaitNetSync` task for prediction barriers** — forces the client to wait for server confirmation before proceeding past a gate. Use before irreversible actions (spawning projectiles).
- **Never apply non-cosmetic effects from the client without server confirmation** — damage, cooldown consumption, and ammo deduction happen server-side. Client shows a predictive animation; the server applies the real state.

## Granting abilities

```cpp
void AMyCharacter::GiveStartingAbilities()
{
    if (!HasAuthority()) { return; }

    for (const TSubclassOf<UGameplayAbility>& AbilityClass : DefaultAbilities)
    {
        FGameplayAbilitySpec Spec(AbilityClass, 1, INDEX_NONE, this);
        AbilitySystemComponent->GiveAbility(Spec);
    }
}
```

- **Grant only on the server (`HasAuthority()`)** — `GiveAbility` replicates to clients automatically.
- **`DefaultAbilities` is a `TArray<TSubclassOf<UGameplayAbility>>` UPROPERTY** configured in the character's Blueprint class defaults. Never hard-code ability classes in C++.
- **Use `GiveAbilityAndActivateOnce` for one-shot passive setup abilities** — fires and forgets, does not remain in the spec list.
