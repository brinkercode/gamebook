# Input Mapping Context Guide

## Standard IMC Set

| IMC | Priority | Loaded when | Purpose |
|---|---|---|---|
| `IMC_Default` | 10 | Always | KBM gameplay bindings |
| `IMC_Gamepad` | 10 | Always | Gamepad gameplay bindings |
| `IMC_UI` | 100 | Menu/dialogue open | UI navigation (Tab, Enter, Escape navigation) |
| `IMC_Vehicle` | 20 | Entering vehicle | Vehicle-specific controls that override movement |
| `IMC_Spectator` | 10 | Spectator mode | Free-fly camera, no combat bindings |

## Loading IMCs

All permanent contexts loaded in `AMyCharacter::SetupPlayerInputComponent`:

```cpp
void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputLocalPlayerSubsystem* Subsystem =
        ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(
            GetController<APlayerController>()->GetLocalPlayer());

    Subsystem->ClearAllMappings();
    Subsystem->AddMappingContext(IMC_Default, 10);
    Subsystem->AddMappingContext(IMC_Gamepad, 10);
}
```

## Context-Sensitive IMCs (push/pop)

Push when entering a context:
```cpp
Subsystem->AddMappingContext(IMC_Vehicle, 20); // higher priority overrides movement
```

Pop when leaving:
```cpp
Subsystem->RemoveMappingContext(IMC_Vehicle);
```

IMC_UI is managed by CommonUI automatically — it pushes when a menu activates and pops when it deactivates.

## Controller Glyph Switching

On input device change, swap visual hints in HUD:

```cpp
// In AMyPlayerController
void AMyPlayerController::OnInputDeviceChanged(ECommonInputType NewType)
{
    UEnhancedInputLocalPlayerSubsystem* Subsystem = ...;
    if (NewType == ECommonInputType::Gamepad)
    {
        Subsystem->RemoveMappingContext(IMC_Default);
        Subsystem->AddMappingContext(IMC_Gamepad, 10);
        HUD->SetControllerGlyphSet(EGlyphSet::Gamepad);
    }
    else
    {
        Subsystem->RemoveMappingContext(IMC_Gamepad);
        Subsystem->AddMappingContext(IMC_Default, 10);
        HUD->SetControllerGlyphSet(EGlyphSet::KBM);
    }
}
```

Register this on the `UCommonInputSubsystem::OnInputMethodChanged` delegate in `BeginPlay`.
