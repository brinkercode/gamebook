# Input Map

> Enhanced Input plugin configuration — Input Actions, Input Mapping Contexts, modifiers, triggers, and rebind strategy for {{PROJECT_NAME}}.

## Input Actions (IA_*)

All Input Actions live in `Content/Core/Input/Actions/`.

| Asset | Type | Consumes input | Triggered by |
|---|---|---|---|
| `IA_Move` | `FVector2D` | Yes | WASD / Left stick |
| `IA_Look` | `FVector2D` | Yes | Mouse / Right stick |
| `IA_Jump` | `bool` | Yes | Space / Cross |
| `IA_Sprint` | `bool` | Yes | Shift / L3 |
| `IA_PrimaryFire` | `bool` | Yes | LMB / R2 |
| `IA_ADS` | `bool` | Yes | RMB / L2 |
| `IA_Reload` | `bool` | Yes | R / Square |
| `IA_Interact` | `bool` | Yes | E / Triangle |
| `IA_WeaponSlot1` | `bool` | No | 1 / D-pad Up |
| `IA_PauseMenu` | `bool` | No | Esc / Start |

_(add rows as actions are implemented)_

## Input Mapping Contexts (IMC_*)

All IMCs live in `Content/Core/Input/Contexts/`.

| Asset | Priority | Active when |
|---|---|---|
| `IMC_Gameplay` | 0 | Default — always active during gameplay |
| `IMC_Vehicle` | 1 | Player in vehicle — overrides movement |
| `IMC_Swimming` | 1 | Player underwater |
| `IMC_UI` | 10 | Any menu open — consumes all gameplay input |

Higher priority value = evaluated first. Use `AddMappingContext` / `RemoveMappingContext` via `UInputRebindSubsystem` — never directly on `UEnhancedInputLocalPlayerSubsystem` from game code.

## Trigger Configuration

| Action | Trigger type | Settings |
|---|---|---|
| `IA_PrimaryFire` | `ETriggerType::Pressed` + `ETriggerType::Down` | Held for auto-fire: `HoldTimeThreshold = 0.1` |
| `IA_ADS` | `ETriggerType::Down` | Smooth blend via GAS |
| `IA_Jump` | `ETriggerType::Pressed` | Single-frame |
| `IA_Sprint` | `ETriggerType::Down` | Held — ability cancels on release |

## Modifier Configuration

| Action | Modifier | Settings |
|---|---|---|
| `IA_Look` (gamepad) | `Scalar` | X: 2.0, Y: 2.0 (adjust for feel target) |
| `IA_Look` (mouse) | `Scalar` | X: 0.07, Y: 0.07 |
| `IA_Move` (gamepad) | `DeadZone` | Lower: 0.15, Upper: 1.0 |

## Ability Binding

GAS abilities bound via Input Tags, not direct IA binding:

```cpp
// In UAbilitySystemComponent setup:
AbilitySystemComponent->BindAbilityActivationToInputComponent(
    InputComponent,
    FGameplayAbilityInputBinds("Confirm", "Cancel", "EAbilityInputID")
);
```

Each `UGA_*` sets `AbilityTags` and `ActivationOwnedTags` — the Input subsystem maps `IA_*` → `FGameplayTag` → ability activation. See `UInputRebindSubsystem::BindAbilityInputs`.

## Rebind Strategy

- All bindings persisted in `USaveGame` slot `"Settings"` via `UInputRebindSubsystem`.
- Rebind UI: `WB_KeyBindings` widget reads from `UInputRebindSubsystem`.
- Conflicting rebinds: warn player, allow override.
- Reset to defaults: `UInputRebindSubsystem::ResetToDefaults()`.

## Gamepad Layout (default)

_(diagram or table showing face/shoulder/trigger mapping)_

## Platform Notes

- PC: mouse + keyboard primary. Controller auto-detected.
- Console: controller only. Input hints swap automatically via `UCommonUISubsystem::GetInputType()`.
