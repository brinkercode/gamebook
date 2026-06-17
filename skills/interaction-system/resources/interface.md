# IInteractableInterface

## Header: `Source/<Project>/Systems/InteractableInterface.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "InteractableInterface.generated.h"

UINTERFACE(MinimalAPI, Blueprintable)
class UInteractableInterface : public UInterface
{
    GENERATED_BODY()
};

class MYGAME_API IInteractableInterface
{
    GENERATED_BODY()

public:
    // Called when the player presses the interact key while this actor is the focus
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Interaction")
    void Interact(AActor* Instigator);

    // Returns the action label shown in WB_InteractionPrompt ("Open", "Pick Up", "Talk")
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Interaction")
    FText GetInteractPrompt() const;

    // Returns false if interaction is blocked (e.g., locked door, dialogue already active)
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Interaction")
    bool CanInteract(AActor* Instigator) const;

    // Returns the maximum distance at which this actor can be interacted with
    // Default 200 UU (~2m); override for large objects (levers, terminals)
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Interaction")
    float GetInteractRange() const;
};
```

## Minimal C++ Implementation (on any Actor)

```cpp
// In BP_MyDoor.h
UCLASS()
class ABP_MyDoor : public AActor, public IInteractableInterface
{
    GENERATED_BODY()
public:
    virtual void Interact_Implementation(AActor* Instigator) override;
    virtual FText GetInteractPrompt_Implementation() const override;
    virtual bool CanInteract_Implementation(AActor* Instigator) const override;
    virtual float GetInteractRange_Implementation() const override { return 200.f; }

private:
    bool bIsOpen = false;
};
```

```cpp
void ABP_MyDoor::Interact_Implementation(AActor* Instigator)
{
    bIsOpen = !bIsOpen;
    // Play open/close animation...
}

FText ABP_MyDoor::GetInteractPrompt_Implementation() const
{
    return bIsOpen ? FText::FromString("Close") : FText::FromString("Open");
}

bool ABP_MyDoor::CanInteract_Implementation(AActor* Instigator) const
{
    return true; // add lock check here
}
```

## Blueprint Implementation

In `BP_MyDoor` Blueprint:
1. Class Settings → Implement Interface → `InteractableInterface`
2. Implement `Interact`, `GetInteractPrompt`, `CanInteract` as Blueprint events
3. No C++ required for Blueprint-only actors
