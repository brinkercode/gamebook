# AMainMenuGameMode

```cpp
// MainMenuGameMode.h
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "MainMenuGameMode.generated.h"

UCLASS()
class MYGAME_API AMainMenuGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AMainMenuGameMode();
    virtual void BeginPlay() override;

    UPROPERTY(EditDefaultsOnly, Category="UI")
    TSubclassOf<UUserWidget> MainMenuLayoutClass;
};
```

```cpp
// MainMenuGameMode.cpp
#include "MainMenuGameMode.h"
#include "Blueprint/UserWidget.h"
#include "GameFramework/PlayerController.h"

AMainMenuGameMode::AMainMenuGameMode()
{
    // No default pawn in the main menu
    DefaultPawnClass = nullptr;
}

void AMainMenuGameMode::BeginPlay()
{
    Super::BeginPlay();

    // Show cursor, suppress game inputs
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        PC->SetInputMode(FInputModeUIOnly());
        PC->SetShowMouseCursor(true);
    }

    // Create and add the root layout widget
    if (MainMenuLayoutClass)
    {
        UUserWidget* Layout = CreateWidget<UUserWidget>(
            GetWorld()->GetFirstPlayerController(), MainMenuLayoutClass);
        Layout->AddToViewport(100); // z-order above everything
    }

    // Set Wwise music state
    // UAkGameplayStatics::SetState("MusicMode", "MainMenu");
}
```

## Level Setup: `L_MainMenu`

- World Settings → GameMode Override: `AMainMenuGameMode`
- No NavMesh, no AI system, no physics simulation needed
- Place a simple `BP_MainMenuCamera` Actor with a `UCameraComponent`; set as ViewTarget in `AMainMenuGameMode::BeginPlay`
- Ambient environment: a static scene, possibly a slowly rotating hero model or particle effect

## `DefaultGame.ini` map redirect

```ini
[/Script/EngineSettings.GameMapsSettings]
GameDefaultMap=/Game/Levels/L_MainMenu.L_MainMenu
TransitionMap=/Game/Levels/L_Transition.L_Transition
```
