# Design

> Game design pillars, feel targets, and UX conventions for {{PROJECT_NAME}}.

## Design Pillars

_(3–5 one-sentence pillars that every design decision is measured against)_

1. **Pillar 1** — _(description)_
2. **Pillar 2** — _(description)_
3. **Pillar 3** — _(description)_

## Player Fantasy

> One sentence: what does the player feel like they are?

_(populate)_

## Core Loop

```
[enter encounter] → [read threats] → [choose ability] → [execute] → [loot/progress] → [repeat]
```

_(replace with the actual loop for this project)_

## Feel Targets

| System | Target feel | Tuning levers |
|---|---|---|
| Movement | _(e.g., weighty, responsive)_ | `CM_Character.ini` — MaxWalkSpeed, JumpZVelocity |
| Primary fire | _(e.g., punchy, precise)_ | `DA_Weapon_*` — FireRate, Spread, Recoil curve |
| Ability activation | _(e.g., snappy, commitment)_ | `GA_*` — Montage length, effect duration |

## Camera

- FOV: _(default)_
- Head bob: _(on/off, intensity)_
- Aim assist (gamepad): _(friction / magnetism settings)_

## HUD / UMG Conventions

- Widget hierarchy root: `WB_HUD_Root` always present in viewport during gameplay.
- Common UI focus system enabled — all menu widgets must be `UCommonActivatableWidget` subclasses.
- Health / ammo widgets read from `ULocalPlayerSubsystem` — never poll `ACharacter` directly.

## Difficulty Design

_(easy/normal/hard scaling — which Data Assets change, which don't)_

## Accessibility

- Subtitles: _(on/off default, font size options)_
- Colorblind modes: _(planned/none)_
- Controller remapping: _(Input Mapping Context saved to `USaveGame` slot)_

## Out of Scope

_(features explicitly excluded from the vertical slice — prevents scope creep)_
