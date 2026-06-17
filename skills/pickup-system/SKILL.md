---
name: pickup-system
description: Use when adding collectible pickups (health, ammo, weapons, audio logs, cosmetics) to a UE5 FPS project. Creates BP_PickupBase, DA_PickupData, and applies GAS attribute effects on overlap. Invoke when the user says "add a pickup", "create a health pack", "add collectibles", or "make items the player can pick up".
version: "1.0.0"
---

# Pickup System

> Creates `BP_PickupBase` (abstract Blueprint base), `UDA_PickupData` (Primary Data Asset for pickup stats and effects), and overlap-driven GAS attribute application. New pickup types are `DA_PickupData` + `BP_Pickup_<Name>` child class — no new C++ per type.

## When to use

Invoke once to establish the system. After that, adding a new pickup type is a `/fix` — create `DA_Pickup_<Name>` and `BP_Pickup_<Name>`. Depends on the `interaction-system` skill (pickups implement `IInteractableInterface`) and the `gas-ability` skill (pickups apply GAS `GameplayEffect`s to the player).

## How it works

1. **Data asset** — create `UDA_PickupData` per `resources/data-asset.md`.
2. **C++ base class** — create `APickupBase` per `resources/pickup-base.md`; handles overlap, GE application, destruction/respawn.
3. **Blueprint child** — create `BP_Pickup_<Name>` child of `APickupBase`; set `PickupData` asset reference; add mesh and `NS_PickupIdle` Niagara effect.
4. **Audio** — add `UAkComponent`; post `Play_Pickup_<Type>` Wwise event on pickup.
5. **Respawn** — configure `RespawnDelay` on `DA_PickupData` if needed (arena game respawning ammo/health); `APickupBase` handles timer.
6. **Verify** — place in PIE, overlap; confirm GAS attribute increases, actor hidden, respawn timer fires.

## Resources (read on demand)

- `resources/data-asset.md` — `UDA_PickupData` C++ class.
- `resources/pickup-base.md` — `APickupBase` C++ actor implementation.

## Success Criteria

- [ ] Player overlaps pickup: GAS `GameplayEffect` applied (health/ammo attribute increases)
- [ ] Pickup mesh/VFX hidden on collection; actor not destroyed (kept for respawn or pooling)
- [ ] Wwise pickup sound plays on collection
- [ ] Respawn timer fires after `RespawnDelay` seconds; mesh/VFX re-shown
- [ ] `IInteractableInterface::CanInteract` returns false when player attribute is already full
- [ ] `WB_InteractionPrompt` shows "Pick Up [Item Name]" when player approaches

## What to Commit

```
Source/<Project>/Pickups/PickupBase.h
Source/<Project>/Pickups/PickupBase.cpp
Source/<Project>/Pickups/DA_PickupData.h
Content/Pickups/BP_PickupBase.uasset
Content/Pickups/BP_Pickup_<Name>.uasset
Content/Data/Pickups/DA_Pickup_<Name>.uasset
Content/GAS/Effects/GE_Pickup_<Name>.uasset
```
