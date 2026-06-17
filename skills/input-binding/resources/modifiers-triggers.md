# Modifiers and Triggers — Common Patterns

---

## Move (WASD → Axis2D)

`IA_Move` is Axis2D (X = strafe, Y = forward).

| Key | Modifiers | Result |
|---|---|---|
| W | None | (0, 1) → forward |
| S | Negate | (0, -1) → backward |
| D | Swizzle Input Axis Values (YXZ) | (1, 0) → strafe right |
| A | Swizzle (YXZ) + Negate | (-1, 0) → strafe left |
| Left Stick | None (already Axis2D) | Direct passthrough |

Swizzle (YXZ): swaps X and Y. A key pressed = Digital (1.0) on X; Swizzle makes it Y; Negate makes it -Y.

## Look (Mouse / Right Stick → Axis2D)

`IA_Look` is Axis2D (X = yaw/horizontal, Y = pitch/vertical).

Mouse:
- Mouse X → X axis (no modifier)
- Mouse Y → Y axis + Negate (mouse Y moves down when looking up without negate — invert based on player preference)

Provide an invert-Y toggle in settings: add/remove the Negate modifier on `IA_Look` Y mapping at runtime:
```cpp
Subsystem->GetMappingContext(IMC_Default)->GetMapping(IA_Look)->Modifiers; // not directly editable
// Easier: negate in character's AddControllerPitchInput implementation
```

## Hold Trigger (ADS)

`IA_ADS` → Trigger: Hold (0.3s hold to activate)
- Trigger type: Hold
- Hold threshold: 0.3s
- Fires `ETriggerEvent::Triggered` after threshold

For tap-to-toggle ADS: use a custom Blueprint or C++ toggle flag instead of the Hold trigger.

## Tap Trigger (interact vs. hold)

Two actions on the same key:
- `IA_Interact_Tap` → Trigger: Tap (fires if released before 0.3s)
- `IA_Interact_Hold` → Trigger: Hold (fires after 0.3s hold)

Both can map to E key. Tap = quick loot, Hold = detailed interact (read terminal, open door).

## Chord Modifier (modifier key required)

`IA_QuickSave` maps to Ctrl+F5:
1. `IA_QuickSave` mapping: key = F5
2. Add Chord modifier: Chord action = `IA_ModifierCtrl` (a Digital action mapped to Left Ctrl)
3. `IA_QuickSave` only triggers when both F5 and Left Ctrl are pressed

## Gamepad DeadZone

All stick-based Axis2D actions should have a `DeadZone` modifier:
- Type: Radial
- Lower threshold: 0.15
- Upper threshold: 1.0

Prevents stick drift on worn controllers. Apply to `IA_Move` and `IA_Look` gamepad mappings.

## Sensitivity Scale

Mouse sensitivity: apply a `Scalar` modifier on `IA_Look` mouse mapping:
- Scale value read from `UMyGameSave.MouseSensitivity` at runtime
- Update via `UEnhancedInputLocalPlayerSubsystem::RequestRebuildControlMappings` when sensitivity setting changes

Gamepad stick sensitivity: separate `Scalar` modifier value from mouse — players expect different sensitivities.
