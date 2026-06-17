# UInteractionComponent

## Header: `Source/<Project>/Systems/InteractionComponent.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "InteractableInterface.h"
#include "InteractionComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFocusedInteractableChanged, AActor*, NewFocusedActor);

UCLASS(ClassGroup=(Systems), meta=(BlueprintSpawnableComponent))
class MYGAME_API UInteractionComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UInteractionComponent();

    UFUNCTION(BlueprintCallable, Category="Interaction")
    void TryInteract();

    UFUNCTION(BlueprintPure, Category="Interaction")
    AActor* GetFocusedInteractable() const { return FocusedInteractable.Get(); }

    UPROPERTY(EditDefaultsOnly, Category="Interaction")
    float DefaultInteractRange = 250.0f;

    UPROPERTY(EditDefaultsOnly, Category="Interaction")
    float TraceFrequencyHz = 10.0f; // trace 10 times per second

    UPROPERTY(BlueprintAssignable)
    FOnFocusedInteractableChanged OnFocusedInteractableChanged;

protected:
    virtual void BeginPlay() override;

private:
    TWeakObjectPtr<AActor> FocusedInteractable;
    FTimerHandle TraceTimerHandle;

    void PerformTrace();
    FVector GetTraceStart() const;
    FVector GetTraceEnd() const;
};
```

## Implementation: `Source/<Project>/Systems/InteractionComponent.cpp`

```cpp
#include "InteractionComponent.h"
#include "GameFramework/Character.h"
#include "Camera/CameraComponent.h"

UInteractionComponent::UInteractionComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UInteractionComponent::BeginPlay()
{
    Super::BeginPlay();

    float Interval = 1.0f / FMath::Max(TraceFrequencyHz, 1.0f);
    GetWorld()->GetTimerManager().SetTimer(
        TraceTimerHandle, this, &UInteractionComponent::PerformTrace,
        Interval, true);
}

void UInteractionComponent::PerformTrace()
{
    FHitResult Hit;
    FCollisionQueryParams Params;
    Params.AddIgnoredActor(GetOwner());

    bool bHit = GetWorld()->LineTraceSingleByChannel(
        Hit, GetTraceStart(), GetTraceEnd(), ECC_Visibility, Params);

    AActor* NewFocus = nullptr;
    if (bHit && Hit.GetActor() && Hit.GetActor()->Implements<UInteractableInterface>())
    {
        float Range = IInteractableInterface::Execute_GetInteractRange(Hit.GetActor());
        if (Hit.Distance <= Range)
        {
            NewFocus = Hit.GetActor();
        }
    }

    if (NewFocus != FocusedInteractable.Get())
    {
        FocusedInteractable = NewFocus;
        OnFocusedInteractableChanged.Broadcast(NewFocus);
    }
}

void UInteractionComponent::TryInteract()
{
    AActor* Target = FocusedInteractable.Get();
    if (!Target) return;

    if (!IInteractableInterface::Execute_CanInteract(Target, GetOwner())) return;

    IInteractableInterface::Execute_Interact(Target, GetOwner());
}

FVector UInteractionComponent::GetTraceStart() const
{
    if (ACharacter* Char = Cast<ACharacter>(GetOwner()))
    {
        if (UCameraComponent* Cam = Char->FindComponentByClass<UCameraComponent>())
        {
            return Cam->GetComponentLocation();
        }
    }
    return GetOwner()->GetActorLocation();
}

FVector UInteractionComponent::GetTraceEnd() const
{
    if (ACharacter* Char = Cast<ACharacter>(GetOwner()))
    {
        if (UCameraComponent* Cam = Char->FindComponentByClass<UCameraComponent>())
        {
            return Cam->GetComponentLocation() +
                   Cam->GetForwardVector() * DefaultInteractRange;
        }
    }
    return GetOwner()->GetActorLocation() + GetOwner()->GetActorForwardVector() * DefaultInteractRange;
}
```
