# UWeaponBase — C++ Implementation

## Header: `Source/<Project>/Weapons/WeaponBase.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AbilitySystemInterface.h"
#include "GameplayTagContainer.h"
#include "DA_WeaponData.h"
#include "WeaponBase.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWeaponFired, int32, RemainingAmmo);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnWeaponReloaded);

UCLASS(ClassGroup=(Weapons), meta=(BlueprintSpawnableComponent))
class MYGAME_API UWeaponBase : public UActorComponent
{
    GENERATED_BODY()

public:
    UWeaponBase();

    // Called by character ability or input binding
    UFUNCTION(BlueprintCallable, Category="Weapon")
    virtual void Fire();

    UFUNCTION(BlueprintCallable, Category="Weapon")
    virtual void StartReload();

    UFUNCTION(BlueprintPure, Category="Weapon")
    int32 GetCurrentAmmo() const;

    UFUNCTION(BlueprintPure, Category="Weapon")
    bool CanFire() const;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon|Data")
    TObjectPtr<UDA_WeaponData> WeaponData;

    UPROPERTY(BlueprintAssignable, Category="Weapon|Events")
    FOnWeaponFired OnWeaponFired;

    UPROPERTY(BlueprintAssignable, Category="Weapon|Events")
    FOnWeaponReloaded OnWeaponReloaded;

protected:
    virtual void BeginPlay() override;

    UFUNCTION()
    virtual void PerformHitscan();

    UFUNCTION()
    virtual void SpawnProjectile();

    // Apply ammo cost + fire rate cooldown via GAS
    void ApplyFireEffects();

    // Cached GAS component from owner
    UPROPERTY()
    TObjectPtr<UAbilitySystemComponent> OwnerASC;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Weapon|State")
    int32 CurrentAmmo;

private:
    bool bIsReloading = false;
    FTimerHandle ReloadTimerHandle;
    void OnReloadComplete();
};
```

## Implementation: `Source/<Project>/Weapons/WeaponBase.cpp`

```cpp
#include "WeaponBase.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystemBlueprintLibrary.h"
#include "GameFramework/Character.h"
#include "DrawDebugHelpers.h"

UWeaponBase::UWeaponBase()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UWeaponBase::BeginPlay()
{
    Super::BeginPlay();

    // Cache ASC from owning character
    if (ACharacter* OwnerChar = Cast<ACharacter>(GetOwner()))
    {
        if (IAbilitySystemInterface* ASI = Cast<IAbilitySystemInterface>(OwnerChar))
        {
            OwnerASC = ASI->GetAbilitySystemComponent();
        }
    }

    // Initialize ammo from data asset
    if (WeaponData)
    {
        CurrentAmmo = WeaponData->MagazineSize;
    }
}

bool UWeaponBase::CanFire() const
{
    if (!WeaponData || bIsReloading || CurrentAmmo <= 0) return false;

    // Check GAS cooldown tag — GA_Weapon_Fire grants this tag while on cooldown
    if (OwnerASC && OwnerASC->HasMatchingGameplayTag(
            FGameplayTag::RequestGameplayTag(FName("Cooldown.Weapon.Fire"))))
    {
        return false;
    }
    return true;
}

void UWeaponBase::Fire()
{
    if (!CanFire()) return;

    if (WeaponData->bIsHitscan)
    {
        PerformHitscan();
    }
    else
    {
        SpawnProjectile();
    }

    ApplyFireEffects();
    OnWeaponFired.Broadcast(CurrentAmmo);
}

void UWeaponBase::PerformHitscan()
{
    ACharacter* OwnerChar = Cast<ACharacter>(GetOwner());
    if (!OwnerChar || !WeaponData) return;

    FVector Start = OwnerChar->GetFollowCamera()->GetComponentLocation();
    FVector End   = Start + OwnerChar->GetFollowCamera()->GetForwardVector() * WeaponData->MaxRange;

    FHitResult HitResult;
    FCollisionQueryParams Params;
    Params.AddIgnoredActor(OwnerChar);

    if (GetWorld()->LineTraceSingleByChannel(HitResult, Start, End, ECC_Visibility, Params))
    {
        // Apply damage via GAS GameplayEffect or UGameplayStatics::ApplyDamage
        if (HitResult.GetActor())
        {
            UAbilitySystemBlueprintLibrary::ApplyGameplayEffectSpecToTarget(
                /* build spec from WeaponData->DamageEffect here */);
        }
    }
}

void UWeaponBase::ApplyFireEffects()
{
    if (!OwnerASC || !WeaponData) return;

    // Apply ammo cost effect
    if (WeaponData->AmmoCostEffect)
    {
        FGameplayEffectContextHandle Context = OwnerASC->MakeEffectContext();
        FGameplayEffectSpecHandle Spec =
            OwnerASC->MakeOutgoingSpec(WeaponData->AmmoCostEffect, 1.f, Context);
        OwnerASC->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get());
    }

    // Apply fire rate cooldown effect
    if (WeaponData->FireRateCooldownEffect)
    {
        FGameplayEffectContextHandle Context = OwnerASC->MakeEffectContext();
        FGameplayEffectSpecHandle Spec =
            OwnerASC->MakeOutgoingSpec(WeaponData->FireRateCooldownEffect, 1.f, Context);
        OwnerASC->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get());
    }

    --CurrentAmmo;
}

void UWeaponBase::StartReload()
{
    if (bIsReloading || !WeaponData) return;
    if (CurrentAmmo >= WeaponData->MagazineSize) return;

    bIsReloading = true;
    GetWorld()->GetTimerManager().SetTimer(
        ReloadTimerHandle, this, &UWeaponBase::OnReloadComplete,
        WeaponData->ReloadTime, false);
}

void UWeaponBase::OnReloadComplete()
{
    if (WeaponData)
    {
        CurrentAmmo = WeaponData->MagazineSize;
    }
    bIsReloading = false;
    OnWeaponReloaded.Broadcast();
}

int32 UWeaponBase::GetCurrentAmmo() const
{
    return CurrentAmmo;
}
```
