# Input Action — Value Types

## Digital (bool)

Use for: Fire, Jump, Interact, Pause, Reload, Ability activation

- `ETriggerEvent::Started` — fires once on key down
- `ETriggerEvent::Triggered` — fires every tick while held (use for auto-fire)
- `ETriggerEvent::Completed` — fires once on key up

Example: `IA_Jump` → Digital → bind to `ETriggerEvent::Started`

## Axis1D (float, -1 to +1)

Use for: Sprint amount (analog trigger), ADS zoom level, throttle

- Left trigger (PS5/Xbox): 0.0 (not pressed) to 1.0 (fully pressed)
- Mouse scroll wheel: positive = scroll up, negative = scroll down

Example: `IA_Sprint` — if sprint is analog (trigger pressure = sprint speed), use Axis1D.
If sprint is binary (button = max speed), use Digital instead.

## Axis2D (FVector2D)

Use for: Move (WASD / left stick), Look (mouse / right stick)

Two-axis input on a single action. Avoids needing separate Left/Right/Forward/Back actions.

Example: `IA_Move` → Axis2D → WASD keys mapped with Swizzle + Negate Modifiers:
- W → Axis2D Y positive (forward)
- S → Axis2D Y negative (backward, via Negate modifier)
- A → Axis2D X negative (left, via Swizzle YXZ + Negate)
- D → Axis2D X positive (right, via Swizzle YXZ)
- Left Stick → maps directly to Axis2D

Example: `IA_Look` → Axis2D → Mouse XY / Right Stick

## Axis3D (FVector)

Rare in FPS games. Use for: 6DOF movement (space sim), gyroscope input.

Not needed for standard FPS.

---

## Standard FPS Action Set

| Action | Value Type | Primary key | Gamepad | Notes |
|---|---|---|---|---|
| `IA_Move` | Axis2D | WASD | Left Stick | Swizzle+Negate on WSAD keys |
| `IA_Look` | Axis2D | Mouse XY | Right Stick | DeadZone modifier on stick |
| `IA_Jump` | Digital | Space | A (Xbox) / Cross (PS) | Started |
| `IA_Fire` | Digital | Left Mouse | Right Trigger | Triggered for full-auto |
| `IA_ADS` | Digital | Right Mouse | Left Trigger (digital) | Started/Completed for toggle |
| `IA_Reload` | Digital | R | X (Xbox) / Square (PS) | Started |
| `IA_Interact` | Digital | E | Y (Xbox) / Triangle (PS) | Started |
| `IA_Sprint` | Digital | Left Shift | Left Stick Click | Started/Completed |
| `IA_Crouch` | Digital | Left Ctrl | B (Xbox) / Circle (PS) | Started/Completed |
| `IA_Pause` | Digital | Escape | Start | Started |
| `IA_WeaponSwap` | Axis1D | Mouse Scroll | D-Pad Up/Down | Scroll triggers discrete swap |
