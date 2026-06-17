---
name: interaction-system
description: Use when adding player interaction (inspect, pick up, talk, open) to a UE5 FPS project — creates IInteractableInterface, a line-trace interaction component, and a prompt widget. Invoke when the user says "add interaction", "let the player interact with objects", "build the interact system", or "add an E-to-interact prompt".
version: "1.0.0"
---

# Interaction System

> Creates `IInteractableInterface` (C++ interface), `UInteractionComponent` (line-trace actor component), and `WB_InteractionPrompt` (HUD widget). Any actor implements the interface to become interactable — no per-actor interaction code needed.

## When to use

Invoke once per project to establish the system. After that, adding a new interactable is a `/fix` — just implement `IInteractableInterface` on the target actor. The `dialogue-tree`, `pickup-system`, and `save-system` (checkpoint) skills all depend on this system being in place.

## How it works

1. **Interface** — create `IInteractableInterface` per `resources/interface.md`.
2. **Interaction component** — create `UInteractionComponent` per `resources/interaction-component.md`; attach to the player character; traces every tick (throttled to 10Hz).
3. **Prompt widget** — create `WB_InteractionPrompt` per `resources/prompt-widget.md`; shown on `UI.Layer.Game` when trace hits an interactable.
4. **Wire input** — bind `IA_Interact` to `UInteractionComponent::TryInteract()`.
5. **Verify** — place a test actor implementing `IInteractableInterface` in PIE; walk within range; confirm prompt appears; press E; confirm `Execute_Interact` fires.

## Resources (read on demand)

- `resources/interface.md` — `IInteractableInterface` C++ interface with `Interact`, `GetInteractPrompt`, and `CanInteract`.
- `resources/interaction-component.md` — `UInteractionComponent` with throttled line trace and current interactable tracking.
- `resources/prompt-widget.md` — `WB_InteractionPrompt` widget with key glyph + action label.

## Success Criteria

- [ ] `IInteractableInterface::Interact` called when player presses E within `InteractRange` UU
- [ ] Prompt appears/disappears within one trace interval (100ms) of entering/leaving range
- [ ] Multiple overlapping interactables: nearest / most centered wins
- [ ] Interactable actor out of LOS (wall between player and object): no prompt
- [ ] Disabled interactable (`CanInteract` returns false): prompt shown as greyed out, interaction blocked
- [ ] `WB_InteractionPrompt` shows correct platform glyph (E for KBM, Square/Y for gamepad)

## What to Commit

```
Source/<Project>/Systems/InteractableInterface.h
Source/<Project>/Systems/InteractionComponent.h
Source/<Project>/Systems/InteractionComponent.cpp
Content/UI/HUD/WB_InteractionPrompt.uasset
```
