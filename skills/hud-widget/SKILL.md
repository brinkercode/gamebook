---
name: hud-widget
description: Use when adding a new HUD element to a UE5 FPS project — creates a CommonUI widget with a ViewModel binding and correct input routing. Invoke when the user says "add a HUD element", "show health on screen", "build the ammo counter", or "create a HUD widget".
version: "1.0.0"
---

# HUD Widget

> Creates `WB_<Name>` (UMG + CommonUI widget), a `UVM_<Name>` ViewModel for attribute binding, and wires it into the HUD manager. Input routing stays correct — the HUD never steals focus from gameplay.

## When to use

Invoke for any persistent screen-space HUD element (health bar, ammo counter, ability cooldown ring, crosshair, objective tracker). For full-screen menus, use `main-menu` or `pause-menu` skills instead. For dialogue, use `dialogue-tree` skill.

## How it works

1. **Interview** — ask the scoping questions from `resources/interview.md`.
2. **ViewModel** — create `UVM_<Name>` using the template in `resources/viewmodel.md`; subscribe to GAS attribute change delegates.
3. **Widget Blueprint** — create `WB_<Name>` extending `UCommonUserWidget`; bind to ViewModel fields per `resources/widget.md`.
4. **HUD manager** — add `WB_<Name>` to the HUD layer via `UCommonUIExtensions::PushContentToLayer_ForPlayer` or directly in the HUD class per `resources/hud-manager.md`.
5. **Input routing** — confirm the widget is on a non-focusable layer; verify clicking the game world does not focus the HUD widget.
6. **Verify** — change the relevant GAS attribute in PIE; confirm the HUD updates within one frame.

## Resources (read on demand)

- `resources/interview.md` — scoping questions.
- `resources/viewmodel.md` — `UVM_<Name>` C++ class subscribed to GAS `OnAttributeChange` delegates.
- `resources/widget.md` — `WB_<Name>` UMG + CommonUI setup, ViewModel binding, and animation hooks.
- `resources/hud-manager.md` — HUD class setup, layer configuration, and widget lifecycle.

## Success Criteria

- [ ] `WB_<Name>` displays correct initial value on PIE start
- [ ] Value updates immediately when GAS attribute changes (no polling)
- [ ] Widget does not intercept mouse click input during gameplay
- [ ] Widget is removed cleanly on player death / level transition (no dangling references)
- [ ] No `NullPointerException` / ensure failures in PIE log

## What to Commit

```
Source/<Project>/UI/ViewModels/VM_<Name>.h
Source/<Project>/UI/ViewModels/VM_<Name>.cpp
Content/UI/HUD/WB_<Name>.uasset
Content/UI/HUD/WBP_HUDManager.uasset   (modified to include new widget)
```
