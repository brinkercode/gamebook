---
name: main-menu
description: Use when building the main menu for a UE5 FPS project — creates a CommonActivatable stack, Play/Continue/Settings/Quit navigation, save slot selection, and correct input mode on entry/exit. Invoke when the user says "build the main menu", "create the title screen", or "add the start menu".
version: "1.0.0"
---

# Main Menu

> Creates `WB_MainMenu` (CommonActivatableWidget root), `WB_SaveSlotList` (slot picker), `WB_SettingsMenu` (sub-panel pushed onto the stack), and the `AMainMenuGameMode` setup. Handles ESC/Back navigation and input mode correctly.

## When to use

Invoke when the game needs a main menu level (`L_MainMenu`). Depends on `save-system` skill (slot list reads save data) and `hud-widget` skill patterns (CommonUI layer setup). Build main menu after the save system is implemented.

## How it works

1. **Game mode** — create `AMainMenuGameMode` per `resources/game-mode.md`; disables AI, sets ambient music state, hides cursor correctly.
2. **Layout widget** — create `WBP_MainMenuLayout` (root `UCommonActivatableWidgetStack`) per `resources/layout.md`.
3. **Main screen widget** — create `WB_MainMenu` per `resources/main-menu-widget.md`; Play/Continue/Settings/Quit buttons.
4. **Settings sub-panel** — push `WB_SettingsMenu` onto the stack when Settings is selected; back button pops it.
5. **Save slot list** — create `WB_SaveSlotList` per `resources/save-slot-list.md`; shown when Play/Continue is selected if multi-slot.
6. **Wwise music state** — set `MusicMode` state to `MainMenu` on entry, restore on exit.
7. **Verify** — launch `L_MainMenu` in PIE; confirm all buttons navigate correctly; ESC / gamepad B pops to previous screen; Quit exits PIE cleanly.

## Resources (read on demand)

- `resources/game-mode.md` — `AMainMenuGameMode` setup.
- `resources/layout.md` — `WBP_MainMenuLayout` CommonActivatableWidgetStack configuration.
- `resources/main-menu-widget.md` — `WB_MainMenu` widget with button bindings and transitions.
- `resources/save-slot-list.md` — `WB_SaveSlotList` widget and slot tile pattern.

## Success Criteria

- [ ] `L_MainMenu` level opens with `WB_MainMenu` active, cursor visible, game input suppressed
- [ ] "Continue" disabled / hidden when no save exists
- [ ] Settings pushes `WB_SettingsMenu`; ESC/Back pops back to main screen
- [ ] Save slot list shows correct timestamps from `UMyGameSave.SaveTimestamp`
- [ ] Selecting a slot loads that slot and opens the game level
- [ ] Quit button exits the game (PIE stops in editor; `FPlatformMisc::RequestExit` in shipping)
- [ ] Wwise `MusicMode.MainMenu` state active while in main menu; transitions on level load

## What to Commit

```
Source/<Project>/UI/Menus/MainMenuGameMode.h
Source/<Project>/UI/Menus/MainMenuGameMode.cpp
Content/UI/Menus/WBP_MainMenuLayout.uasset
Content/UI/Menus/WB_MainMenu.uasset
Content/UI/Menus/WB_SettingsMenu.uasset
Content/UI/Menus/WB_SaveSlotList.uasset
Content/UI/Menus/WB_SaveSlotTile.uasset
Content/Levels/L_MainMenu.umap
```
