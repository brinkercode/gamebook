# UGA_<Name> — Ability Class Template

## Header: `Source/<Project>/GAS/Abilities/GA_<Name>.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "Abilities/GameplayAbility.h"
#include "GA_<Name>.generated.h"

UCLASS()
class MYGAME_API UGA_<Name> : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UGA_<Name>();

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

    virtual bool CanActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayTagContainer* SourceTags,
        const FGameplayTagContainer* TargetTags,
        FGameplayTagContainer* OptionalRelevantTags) const override;
};
```

## Implementation: `Source/<Project>/GAS/Abilities/GA_<Name>.cpp`

```cpp
#include "GA_<Name>.h"
#include "AbilitySystemComponent.h"

UGA_<Name>::UGA_<Name>()
{
    // Activation policy
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;

    // Net execution: LocalPredicted for responsive feel; ServerOnly for cheat-sensitive abilities
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;

    // Tags this ability requires on the owner to activate
    ActivationRequiredTags.AddTag(FGameplayTag::RequestGameplayTag(FName("State.Alive")));

    // Tags that block activation (e.g., already sprinting, in a cutscene)
    ActivationBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(FName("State.Stunned")));

    // Tag granted to owner while this ability is active
    ActivationOwnedTags.AddTag(FGameplayTag::RequestGameplayTag(FName("Ability.<Name>.Active")));

    // Set cost and cooldown effect classes in the subclass constructor or Blueprint defaults
    // CostGameplayEffectClass    = UGE_<Name>_Cost::StaticClass();
    // CooldownGameplayEffectClass = UGE_<Name>_Cooldown::StaticClass();
}

bool UGA_<Name>::CanActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayTagContainer* SourceTags,
    const FGameplayTagContainer* TargetTags,
    FGameplayTagContainer* OptionalRelevantTags) const
{
    if (!Super::CanActivateAbility(Handle, ActorInfo, SourceTags, TargetTags, OptionalRelevantTags))
    {
        return false;
    }
    // Custom checks (e.g., minimum ammo for grenade)
    return true;
}

void UGA_<Name>::ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData)
{
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        // CommitAbility applies cost and cooldown; returns false if cost check fails
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }

    // --- Ability logic here ---
    // Example: instant ability
    // DoSomething();
    // EndAbility(Handle, ActorInfo, ActivationInfo, true, false);

    // Example: duration ability (sprint) — end on input release via AbilityTask
    // UAbilityTask_WaitInputRelease* Task = UAbilityTask_WaitInputRelease::WaitInputRelease(this, false);
    // Task->OnRelease.AddDynamic(this, &UGA_<Name>::OnInputReleased);
    // Task->ReadyForActivation();
}

void UGA_<Name>::EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility,
    bool bWasCancelled)
{
    // Cleanup: remove any applied effects, stop tasks
    Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
```

## Granting the Ability to a Character

```cpp
// In AMyCharacter::BeginPlay() or OnPossessed()
void AMyCharacter::GrantDefaultAbilities()
{
    if (!AbilitySystemComponent || !HasAuthority()) return;

    for (TSubclassOf<UGameplayAbility> AbilityClass : DefaultAbilities)
    {
        FGameplayAbilitySpec Spec(AbilityClass, 1, INDEX_NONE, this);
        AbilitySystemComponent->GiveAbility(Spec);
    }
}
```

`DefaultAbilities` is a `TArray<TSubclassOf<UGameplayAbility>>` `UPROPERTY(EditDefaultsOnly)` on the character — set in the character Blueprint defaults.
