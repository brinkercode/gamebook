---
name: pause-menu
description: Use when adding a pause menu to a UE5 FPS project — handles input mode swap, time dilation to 0, ESC binding via Enhanced Input, and resume/settings/quit options. Invoke when the user says "add a pause menu", "implement ESC to pause", or "build the pause screen".
version: "1.0.0"
---

# Pause Menu

> Creates `WB_PauseMenu` (CommonActivatableWidget), Enhanced Input `IA_Pause` binding, time dilation to 0 on open, full time dilation restore on close, and correct input mode swaps. Pushed onto `UI.Layer.Menu` — above HUD, below modal.

## When to use

Invoke after the HUD and main menu are in place. The pause menu is a self-contained system — it requires `input-binding` skill patterns and CommonUI layer setup (from `hud-widget` skill). If the game is multiplayer, pause must not dilate time on the server — read `resources/pause-controller.md` for the server-safe variant.

## How it works

1. **Input Action** — create `IA_Pause` (digital) and add ESC / Start button to `IMC_Default` and `IMC_Gamepad`.
2. **Pause controller** — create `APauseController` logic in the PlayerController per `resources/pause-controller.md`; handles toggle, time dilation, input mode.
3. **Widget** — create `WB_PauseMenu` per `resources/pause-widget.md`; Resume / Settings / Main Menu / Quit buttons.
4. **Settings sub-panel** — reuse `WB_SettingsMenu` from `main-menu` skill; push onto the stack from the pause menu.
5. **Wwise** — set `MusicMode.PauseMenu` state on open; restore `MusicMode.Combat` or `MusicMode.Exploration` on close.
6. **Verify** — press ESC in gameplay PIE; confirm time stops, cursor appears, resume restores gameplay.

## Resources (read on demand)

- `resources/pause-controller.md` — `APauseController` PlayerController extension with toggle, time dilation, and input mode logic.
- `resources/pause-widget.md` — `WB_PauseMenu` widget with button layout and delegates.

## Success Criteria

- [ ] ESC opens pause menu; time dilation set to 0 (`AWorldSettings::TimeDilation = 0`)
- [ ] Game inputs suppressed while paused (no character movement)
- [ ] Resume: time dilation restored to 1, game inputs re-enabled, cursor hidden
- [ ] Settings pushed and popped correctly while paused
- [ ] Main Menu: save triggered, then `OpenLevel("L_MainMenu")`
- [ ] Quit: `UKismetSystemLibrary::QuitGame`
- [ ] Multiplayer: time dilation NOT set to 0 on server; pause is client-local only

## What to Commit

```
Content/Input/Actions/IA_Pause.uasset
Content/Input/IMC_Default.uasset          (modified — IA_Pause mapping added)
Content/UI/Menus/WB_PauseMenu.uasset
Source/<Project>/Player/MyPlayerController.h   (modified — pause toggle logic)
Source/<Project>/Player/MyPlayerController.cpp
```
