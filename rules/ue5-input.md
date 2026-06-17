---
paths:
  - "Source/**/Input/**"
  - "Content/Core/Input/**"
  - "Content/**/Input/**"
---

# UE5 Enhanced Input Rules

## Stack

- **Enhanced Input plugin only** — `EnhancedInput` in `<Project>.Build.cs` `PublicDependencyModuleNames`. No `BindAxis`, no `BindAction` on the legacy `UInputComponent`.
- **`UInputAction` assets** — one per logical action (`IA_Jump`, `IA_PrimaryFire`, `IA_Look`, `IA_Move`). Declare value type: `Digital` (bool), `Axis1D` (float), `Axis2D` (FVector2D).
- **`UInputMappingContext` (IMC) assets** — one per control mode. Bind Input Actions to raw hardware keys/buttons/axes within the IMC.

## Input Action design

```
Content/Core/Input/
├── Actions/
│   ├── IA_Jump.uasset
│   ├── IA_Move.uasset                  (Axis2D)
│   ├── IA_Look.uasset                  (Axis2D)
│   ├── IA_PrimaryFire.uasset           (Digital)
│   ├── IA_SecondaryFire.uasset         (Digital)
│   ├── IA_Reload.uasset
│   ├── IA_Interact.uasset
│   └── IA_Pause.uasset
└── Contexts/
    ├── IMC_OnFoot.uasset               (Priority 0 — always active)
    ├── IMC_Vehicle.uasset              (Priority 1 — replaces OnFoot locomotion)
    ├── IMC_Aiming.uasset               (Priority 2 — overlays aiming modifiers)
    └── IMC_UI.uasset                   (Priority 10 — UI captures all input while active)
```

- **One `IA_` per logical action, not per key** — `IA_PrimaryFire` is one asset; it is mapped to `Left Mouse Button` in the keyboard IMC and `Right Trigger` in the gamepad IMC.
- **Separate look action from move action** — `IA_Look` (Axis2D) handles mouse and right stick; `IA_Move` (Axis2D) handles WASD and left stick. Never combine into one action.
- **Value type accuracy matters** — `IA_PrimaryFire` that needs hold detection should be `Digital`, not `Axis1D`. Trigger modifiers only fire on the correct value type.

## Binding in C++

```cpp
void AMyPlayerCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    check(EIC);

    EIC->BindAction(JumpAction, ETriggerEvent::Started, this, &AMyPlayerCharacter::OnJump);
    EIC->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMyPlayerCharacter::OnMove);
    EIC->BindAction(LookAction, ETriggerEvent::Triggered, this, &AMyPlayerCharacter::OnLook);
    EIC->BindAction(PrimaryFireAction, ETriggerEvent::Started, this, &AMyPlayerCharacter::OnPrimaryFireStart);
    EIC->BindAction(PrimaryFireAction, ETriggerEvent::Completed, this, &AMyPlayerCharacter::OnPrimaryFireEnd);
}
```

- **Always cast to `UEnhancedInputComponent`** — the base `UInputComponent` has no Enhanced Input API.
- **Bind `Started` and `Completed` separately for held actions** — `Started` fires on first press, `Completed` fires on release. `Triggered` fires every frame the action is active (use for move/look).
- **Input Action and IMC assets are `UPROPERTY(EditDefaultsOnly)`** on the character — set in the Blueprint CDO, not hard-coded in C++.

```cpp
// Character header
UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputMappingContext> DefaultMappingContext;

UPROPERTY(EditDefaultsOnly, Category="Input")
int32 DefaultMappingPriority = 0;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> JumpAction;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> MoveAction;
```

## Adding and removing IMC contexts

```cpp
void AMyPlayerCharacter::AddMappingContext(
    UInputMappingContext* Context, int32 Priority)
{
    if (APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
            ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
        {
            Subsystem->AddMappingContext(Context, Priority);
        }
    }
}

void AMyPlayerCharacter::RemoveMappingContext(UInputMappingContext* Context)
{
    if (APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
            ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
        {
            Subsystem->RemoveMappingContext(Context);
        }
    }
}
```

- **Swap contexts on state change, don't disable actions manually** — entering a vehicle removes `IMC_OnFoot`, adds `IMC_Vehicle`. Exiting reverses it. Never track individual action disabled states.
- **UI IMC at high priority** — when a menu opens, add `IMC_UI` at priority 10. It shadows all gameplay actions. Remove it when the menu closes.
- **Aiming IMC overlays, not replaces** — `IMC_Aiming` at priority 2 adds ADS-specific modifiers while the base `IMC_OnFoot` at priority 0 remains active. Higher priority wins for conflicting actions.

## IMC priority guidelines

| Priority | IMC | Active when |
|---|---|---|
| 0 | `IMC_OnFoot` | Default player state |
| 1 | `IMC_Vehicle` | Inside a drivable vehicle |
| 2 | `IMC_Aiming` | Aiming down sights |
| 5 | `IMC_Cutscene` | Cinematic playing — blocks all gameplay input |
| 10 | `IMC_UI` | Any modal UI (pause, inventory, menus) |
| 10 | `IMC_TextInput` | Chat / name entry — captures all keyboard input |

## Modifiers and Triggers

**Modifiers** transform raw axis values before the action fires:

```
IA_Move (Axis2D):
  W key → Modifier: Swizzle Input Axis Values (YXZ) + Negate Y
  S key → Modifier: Swizzle + Negate Y + Negate
  A key → (no modifiers needed, X axis)
  D key → Negate
```

- **`Negate` and `Swizzle` for WASD-to-Vector2D mapping** — standard pattern; configure in the IMC, not in C++.
- **`Dead Zone` modifier on all analog sticks** — prevents stick drift. Set inner dead zone to 0.15, outer to 0.95.
- **`Scalar` modifier for sensitivity scaling** — don't multiply axis values in C++ code. Put the scalar in the IMC; it's tunable per platform.

**Triggers** control when `Started`, `Triggered`, and `Completed` fire:

| Trigger | Use |
|---|---|
| `Pressed` | Digital action fires on initial press only |
| `Released` | Digital action fires on release only |
| `Hold` | Action fires after N seconds held (hold-to-interact) |
| `Pulse` | Action fires repeatedly while held (auto-fire) |
| `Tap` | Action fires on quick press-release |
| `Chord Action` | Action fires only when another Input Action is also active |

- **`Hold` trigger for interact** — `IA_Interact` with `Hold (1.0s)` trigger requires player to hold E for 1 second. Progress percentage is exposed via `ETriggerEvent::Ongoing`.
- **`Chord Action` for alt-fire** — bind `IA_AltFire` with a Chord trigger requiring `IA_Aiming` to be active. The chord is declared in the IMC, not in ability code.

## Rebinding (runtime)

Store user-remapped keys as `FKey` overrides in the save game, and apply via:

```cpp
Subsystem->AddPlayerMappedKeyInSlot(MappingName, NewKey);
```

- **Never save raw keybindings in a plain JSON file** — use `FEnhancedActionKeyMapping` serialization via `USaveGame`. See [git-lfs.md](git-lfs.md) for save file handling.
- **Validate that the remapped key is not already claimed** by another action in the same IMC before applying.
