# HUD Manager Setup

## AHUD subclass: `AMyHUD`

```cpp
// MyHUD.h
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "MyHUD.generated.h"

UCLASS()
class MYGAME_API AMyHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void BeginPlay() override;

    UPROPERTY(EditDefaultsOnly, Category="HUD|Widgets")
    TSubclassOf<UCommonUserWidget> HealthBarWidgetClass;

    UPROPERTY(EditDefaultsOnly, Category="HUD|Widgets")
    TSubclassOf<UCommonUserWidget> AmmoCounterWidgetClass;

private:
    UPROPERTY()
    TObjectPtr<UCommonUserWidget> HealthBarWidget;

    void CreateAndPushHUDWidget(TSubclassOf<UCommonUserWidget> WidgetClass,
                                 FGameplayTag LayerTag);
};
```

```cpp
// MyHUD.cpp
void AMyHUD::BeginPlay()
{
    Super::BeginPlay();

    APlayerController* PC = Cast<APlayerController>(GetOwningPlayerController());
    if (!PC) return;

    // Push all HUD widgets to the non-interactive HUD layer
    CreateAndPushHUDWidget(HealthBarWidgetClass,
        FGameplayTag::RequestGameplayTag("UI.Layer.HUD"));
    CreateAndPushHUDWidget(AmmoCounterWidgetClass,
        FGameplayTag::RequestGameplayTag("UI.Layer.HUD"));
}

void AMyHUD::CreateAndPushHUDWidget(
    TSubclassOf<UCommonUserWidget> WidgetClass, FGameplayTag LayerTag)
{
    if (!WidgetClass) return;
    ULocalPlayer* LP = GetOwningPlayerController()->GetLocalPlayer();
    UCommonUIExtensions::PushContentToLayer_ForPlayer(LP, LayerTag, WidgetClass);
}
```

## ViewModel Initialization

After the player character possesses a pawn and the ASC is ready, initialize ViewModels:

```cpp
// In AMyPlayerController::OnPossess or AMyCharacter::OnRep_PlayerState
void AMyCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    InitAbilitySystem();

    // Notify HUD to initialize ViewModels with this ASC
    if (AMyHUD* HUD = Cast<AMyHUD>(NewController->GetHUD()))
    {
        // Each WB_ widget's ViewModel gets initialized here
        // If using MVVM resolver, the HUD's ViewModelCollection binds to PlayerState's ASC
    }
}
```

## Layer Configuration (Project Settings)

`Project Settings → Game → Common UI → Registered Layers`:

```
Name: HUD     Tag: UI.Layer.HUD     Widget: WBP_HUDLayer (root container)
Name: Game    Tag: UI.Layer.Game    Widget: WBP_GameLayer
Name: Menu    Tag: UI.Layer.Menu    Widget: WBP_MenuLayer
Name: Modal   Tag: UI.Layer.Modal   Widget: WBP_ModalLayer
```

Each layer widget is a `UCommonActivatableWidgetStack` child class placed inside `WBP_PrimaryGameLayout` (the root CommonUI layout widget added in the PlayerController).
