---
name: input-binding
description: Use when adding a new input action to a UE5 FPS project — creates an IA_ Input Action asset, adds it to the correct IMC_, applies Modifiers and Triggers, and wires it to C++ or Blueprint. Invoke when the user says "add an input binding", "bind a key", "wire up the sprint input", or "create an Input Action".
version: "1.0.0"
---

# Input Binding

> Creates an `IA_<Name>` Input Action asset, adds a mapping to the appropriate `IMC_*` Input Mapping Context, applies the correct Modifier and Trigger combination, and provides the C++ binding pattern. One invocation per action.

## When to use

Invoke for any new player input: movement, fire, ability, interact, pause, UI navigation. Do not invoke for AI or NPC inputs — those use direct function calls, not Enhanced Input. If the binding requires activating a GAS ability, also read `gas-ability` skill `resources/input-binding.md`.

## How it works

1. **Determine input type** — read `resources/action-types.md` to pick the correct Value Type and Trigger combination for the desired behavior.
2. **Create IA asset** — create `Content/Input/Actions/IA_<Name>.uasset` with the correct Value Type.
3. **Add to IMC** — add the mapping to `IMC_Default` (KBM) and/or `IMC_Gamepad` per `resources/imc-guide.md`.
4. **Apply Modifiers and Triggers** — per `resources/modifiers-triggers.md`; common patterns: negate axis, swizzle for strafe, hold for ADS.
5. **Bind in C++** — use the pattern in `resources/cpp-binding.md`; bind to the appropriate character or controller function.
6. **Verify** — press the key in PIE; confirm `ETriggerEvent::Triggered` fires at the expected rate; confirm no input consumed by wrong IMC priority.

## Resources (read on demand)

- `resources/action-types.md` — Value Type selection (Digital, Axis1D, Axis2D, Axis3D) and when to use each.
- `resources/imc-guide.md` — IMC priority system, when to use which IMC, how to push/pop context-sensitive IMCs.
- `resources/modifiers-triggers.md` — standard Modifier+Trigger combos (negate, swizzle, hold, tap, chord).
- `resources/cpp-binding.md` — `UEnhancedInputComponent::BindAction` patterns for all trigger event types.

## Success Criteria

- [ ] `IA_<Name>` asset exists in `Content/Input/Actions/`
- [ ] Mapping exists in correct IMC with correct key assignment
- [ ] C++ handler fires at correct trigger event (`Started` / `Triggered` / `Completed`)
- [ ] No duplicate binding conflicts with existing actions (checked by testing all adjacent inputs)
- [ ] Gamepad and KBM both functional if both IMCs are mapped

## What to Commit

```
Content/Input/Actions/IA_<Name>.uasset
Content/Input/IMC_Default.uasset      (modified)
Content/Input/IMC_Gamepad.uasset      (modified, if gamepad binding added)
Source/<Project>/Player/<Class>.cpp   (modified — binding added)
```
