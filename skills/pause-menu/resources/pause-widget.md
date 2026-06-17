# WB_PauseMenu — Widget

## Class: `UCommonActivatableWidget`

## UMG Layout

```
WB_PauseMenu (CommonActivatableWidget)
└── Canvas Panel (full screen, semi-transparent dark overlay)
    └── Border (centered card, ~400×500px)
        ├── TextBlock: "Paused"  (large header)
        └── VerticalBox
            ├── WB_MenuButton: "Resume"
            ├── WB_MenuButton: "Settings"
            ├── WB_MenuButton: "Main Menu"
            └── WB_MenuButton: "Quit to Desktop"
```

## Input Config

```cpp
TOptional<FUIInputConfig> WB_PauseMenu::GetDesiredInputConfig() const
{
    return FUIInputConfig(ECommonInputMode::Menu, EMouseCaptureMode::NoCapture);
}
```

## Button Logic

**Resume**:
```cpp
// Tell PlayerController to close pause
if (AMyPlayerController* PC = GetOwningPlayer<AMyPlayerController>())
{
    PC->ClosePauseMenu();
}
```

**Settings**:
```cpp
// Push WB_SettingsMenu (shared with main menu)
GetOwningLocalPlayer()
    ->GetSubsystem<UCommonUISubsystem>()
    ->PushWidget<WB_SettingsMenu>(FGameplayTag::RequestGameplayTag("UI.Layer.Modal"));
```

**Main Menu**:
```cpp
// Save first, then load main menu
USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();
SS->OnSaveComplete.AddDynamic(this, &WB_PauseMenu::OnSavedBeforeExit);
SS->SaveAsync(USaveGameSubsystem::DefaultSlot);
```

```cpp
void WB_PauseMenu::OnSavedBeforeExit(bool bSuccess)
{
    // Restore time before level transition (otherwise new level starts at dilation 0)
    UGameplayStatics::SetGlobalTimeDilation(GetWorld(), 1.0f);
    UGameplayStatics::OpenLevel(this, FName("L_MainMenu"));
}
```

**Quit to Desktop**:
```cpp
UKismetSystemLibrary::QuitGame(this, GetOwningPlayer(), EQuitPreference::Quit, false);
```

## ESC to Resume

`UCommonActivatableWidget` calls `DeactivateWidget()` automatically on Back input (ESC on PC, B on gamepad) if `bAutoBackAction = true` is set in widget defaults. Override `NativeOnDeactivated` to also call `PC->ClosePauseMenu()`:

```cpp
void WB_PauseMenu::NativeOnDeactivated()
{
    Super::NativeOnDeactivated();
    if (AMyPlayerController* PC = GetOwningPlayer<AMyPlayerController>())
    {
        if (PC->IsPaused())
        {
            PC->ClosePauseMenu();
        }
    }
}
```

This ensures the controller state and the widget state cannot desync.
