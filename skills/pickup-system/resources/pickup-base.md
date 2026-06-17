# APickupBase — C++ Actor

```cpp
// PickupBase.h
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "InteractableInterface.h"
#include "DA_PickupData.h"
#include "PickupBase.generated.h"

UCLASS(Abstract)
class MYGAME_API APickupBase : public AActor, public IInteractableInterface
{
    GENERATED_BODY()
public:
    APickupBase();

    // IInteractableInterface
    virtual void Interact_Implementation(AActor* Instigator) override;
    virtual FText GetInteractPrompt_Implementation() const override;
    virtual bool CanInteract_Implementation(AActor* Instigator) const override;
    virtual float GetInteractRange_Implementation() const override { return 150.f; }

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Pickup")
    TObjectPtr<UDA_PickupData> PickupData;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<USphereComponent> OverlapSphere;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UStaticMeshComponent> MeshComp;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UNiagaraComponent> IdleVFXComp;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UAkComponent> AkComp;

    bool bIsAvailable = true;
    FTimerHandle RespawnTimerHandle;

    UFUNCTION()
    void OnOverlapBegin(UPrimitiveComponent* OverlappedComp, AActor* OtherActor,
        UPrimitiveComponent* OtherComp, int32 OtherBodyIndex,
        bool bFromSweep, const FHitResult& SweepResult);

    void ApplyPickupEffect(AActor* Recipient);
    void HidePickup();
    void RespawnPickup();
};
```

```cpp
// PickupBase.cpp
#include "PickupBase.h"
#include "AbilitySystemInterface.h"
#include "AbilitySystemComponent.h"
#include "Components/SphereComponent.h"
#include "NiagaraComponent.h"

APickupBase::APickupBase()
{
    PrimaryActorTick.bCanEverTick = false;

    OverlapSphere = CreateDefaultSubobject<USphereComponent>(TEXT("OverlapSphere"));
    OverlapSphere->SetSphereRadius(100.f);
    OverlapSphere->SetCollisionProfileName(TEXT("Trigger"));
    SetRootComponent(OverlapSphere);

    MeshComp = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
    MeshComp->SetupAttachment(OverlapSphere);
    MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    IdleVFXComp = CreateDefaultSubobject<UNiagaraComponent>(TEXT("IdleVFX"));
    IdleVFXComp->SetupAttachment(OverlapSphere);

    AkComp = CreateDefaultSubobject<UAkComponent>(TEXT("AkComp"));
    AkComp->SetupAttachment(OverlapSphere);
}

void APickupBase::BeginPlay()
{
    Super::BeginPlay();
    OverlapSphere->OnComponentBeginOverlap.AddDynamic(this, &APickupBase::OnOverlapBegin);

    if (PickupData)
    {
        if (UStaticMesh* Mesh = PickupData->PickupMesh.LoadSynchronous())
            MeshComp->SetStaticMesh(Mesh);
        if (UNiagaraSystem* NS = PickupData->IdleVFX.LoadSynchronous())
            IdleVFXComp->SetAsset(NS);
    }
}

void APickupBase::OnOverlapBegin(UPrimitiveComponent*, AActor* OtherActor, ...)
{
    if (!bIsAvailable || !OtherActor) return;
    if (!OtherActor->Implements<UInteractableInterface>()) // must be a character
    {
        // Direct overlap pickup (no E required) — apply immediately
        if (CanInteract_Implementation(OtherActor))
        {
            ApplyPickupEffect(OtherActor);
        }
    }
    // If using interaction-system: overlap does NOT pick up — player must press E.
    // This actor implements IInteractableInterface; UInteractionComponent handles the press.
}

void APickupBase::Interact_Implementation(AActor* Instigator)
{
    if (!bIsAvailable) return;
    ApplyPickupEffect(Instigator);
}

bool APickupBase::CanInteract_Implementation(AActor* Instigator) const
{
    if (!bIsAvailable || !PickupData) return false;

    if (PickupData->bBlockIfFull && PickupData->FullCheckAttribute.IsValid())
    {
        if (IAbilitySystemInterface* ASI = Cast<IAbilitySystemInterface>(Instigator))
        {
            UAbilitySystemComponent* ASC = ASI->GetAbilitySystemComponent();
            bool bFound = false;
            float Current = ASC->GetGameplayAttributeValue(PickupData->FullCheckAttribute, bFound);
            // Check against MaxAttribute — simplified: if Health == MaxHealth, block
            // Full implementation: compare with max attribute value
            if (bFound && Current >= 100.f) return false; // replace 100 with actual max
        }
    }
    return true;
}

FText APickupBase::GetInteractPrompt_Implementation() const
{
    return PickupData ? PickupData->PickupPrompt : FText::FromString("Pick Up");
}

void APickupBase::ApplyPickupEffect(AActor* Recipient)
{
    if (!PickupData || !PickupData->PickupEffect) return;

    if (IAbilitySystemInterface* ASI = Cast<IAbilitySystemInterface>(Recipient))
    {
        UAbilitySystemComponent* ASC = ASI->GetAbilitySystemComponent();
        if (ASC)
        {
            FGameplayEffectContextHandle Context = ASC->MakeEffectContext();
            FGameplayEffectSpecHandle Spec =
                ASC->MakeOutgoingSpec(PickupData->PickupEffect, 1.f, Context);
            ASC->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get());
        }
    }

    // Play audio
    if (!PickupData->WwisePickupEventName.IsNone())
    {
        // AkComp->PostAkEventByName(PickupData->WwisePickupEventName.ToString());
    }

    HidePickup();

    if (PickupData->RespawnDelay > 0.f)
    {
        GetWorld()->GetTimerManager().SetTimer(
            RespawnTimerHandle, this, &APickupBase::RespawnPickup,
            PickupData->RespawnDelay, false);
    }
}

void APickupBase::HidePickup()
{
    bIsAvailable = false;
    MeshComp->SetVisibility(false);
    IdleVFXComp->Deactivate();
    OverlapSphere->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void APickupBase::RespawnPickup()
{
    bIsAvailable = true;
    MeshComp->SetVisibility(true);
    IdleVFXComp->Activate(true);
    OverlapSphere->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
}
```
