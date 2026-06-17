# Pause Controller Logic

Add to `AMyPlayerController`:

```cpp
// MyPlayerController.h (additions)
UFUNCTION(BlueprintCallable, Category="Pause")
void TogglePause();

UFUNCTION(BlueprintCallable, Category="Pause")
void OpenPauseMenu();

UFUNCTION(BlueprintCallable, Category="Pause")
void ClosePauseMenu();

UFUNCTION(BlueprintPure, Category="Pause")
bool IsPaused() const { return bIsPaused; }

UPROPERTY(EditDefaultsOnly, Category="Pause|UI")
TSubclassOf<UCommonActivatableWidget> PauseMenuWidgetClass;

private:
bool bIsPaused = false;

UPROPERTY()
TObjectPtr<UCommonActivatableWidget> PauseMenuWidget;
```

```cpp
// MyPlayerController.cpp (additions)

void AMyPlayerController::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    UEnhancedInputComponent* EIC = CastChecked<UEnhancedInputComponent>(PlayerInputComponent);
    EIC->BindAction(IA_Pause, ETriggerEvent::Started, this, &AMyPlayerController::TogglePause);
}

void AMyPlayerController::TogglePause()
{
    if (bIsPaused) ClosePauseMenu();
    else OpenPauseMenu();
}

void AMyPlayerController::OpenPauseMenu()
{
    if (bIsPaused) return;
    bIsPaused = true;

    // Single-player: dilate time to 0
    // Multiplayer: skip SetGlobalTimeDilation — pause is client-display-only
    if (!GetWorld()->GetNetMode() == NM_Standalone)
    {
        // Multiplayer: do NOT pause time
    }
    else
    {
        UGameplayStatics::SetGlobalTimeDilation(GetWorld(), 0.0f);
        GetWorld()->GetWorldSettings()->Pauser = GetPlayerState<APlayerState>();
    }

    // Switch to UI input mode, show cursor
    SetInputMode(FInputModeGameAndUI().SetHideCursorDuringCapture(false));
    SetShowMouseCursor(true);

    // Push pause widget
    if (PauseMenuWidgetClass && !PauseMenuWidget)
    {
        PauseMenuWidget = UCommonUIExtensions::PushContentToLayer_ForPlayer(
            GetLocalPlayer(),
            FGameplayTag::RequestGameplayTag("UI.Layer.Menu"),
            PauseMenuWidgetClass);
    }

    // Wwise: set pause state
    // UAkGameplayStatics::SetState("MusicMode", "PauseMenu");
}

void AMyPlayerController::ClosePauseMenu()
{
    if (!bIsPaused) return;
    bIsPaused = false;

    // Restore time
    UGameplayStatics::SetGlobalTimeDilation(GetWorld(), 1.0f);
    GetWorld()->GetWorldSettings()->Pauser = nullptr;

    // Restore game input, hide cursor
    SetInputMode(FInputModeGameOnly());
    SetShowMouseCursor(false);

    // Pop pause widget
    if (PauseMenuWidget)
    {
        PauseMenuWidget->DeactivateWidget();
        PauseMenuWidget = nullptr;
    }

    // Wwise: restore gameplay music state
    // UAkGameplayStatics::SetState("MusicMode", "Exploration"); // or Combat
}
```

## Multiplayer Variant

For multiplayer, do not call `SetGlobalTimeDilation`. The pause menu is a client-side UI overlay only — the server continues running. Display a "Game Paused (offline only)" notice if solo in an online session.

```cpp
void AMyPlayerController::OpenPauseMenu()
{
    bIsPaused = true;
    // NO time dilation in networked game
    SetInputMode(FInputModeGameAndUI().SetHideCursorDuringCapture(false));
    SetShowMouseCursor(true);
    // push widget as above
}
```
