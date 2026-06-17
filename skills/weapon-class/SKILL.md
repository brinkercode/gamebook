---
name: weapon-class
description: Use when adding a new weapon type to a UE5 FPS project — creates UWeaponBase C++ base class, a DA_WeaponData Primary Data Asset for stats, and a BP_Weapon_* Blueprint subclass. Invoke when the user says "add a weapon", "implement the rifle", "create the weapon class", or "build the weapon system".
version: "1.0.0"
---

# Weapon Class

> Creates `UWeaponBase` (C++ abstract component), `UDA_WeaponData` (data asset for stats), and `BP_Weapon_*` Blueprint subclasses. Ammo, fire rate, and recoil are data-driven — programmers write systems, designers edit data assets.

## When to use

Invoke the first time a weapon type is needed, or when adding a new weapon to an existing system. If `UWeaponBase` already exists and only a new weapon variant is needed, skip to step 4 (create the data asset and BP subclass). Escalate to `/ship` if the weapon requires a new GAS attribute (e.g., special ammo type that modifies player stats).

## How it works

1. **Interview** — ask the four scoping questions from `resources/interview.md` before writing any code.
2. **C++ base class** — create `UWeaponBase` as an `ActorComponent` using the code in `resources/weapon-base.md`.
3. **Data Asset** — create `UDA_WeaponData` and fill it with `resources/data-asset.md`; drop a `DA_Weapon_<Name>` asset in `Content/Data/Weapons/`.
4. **Blueprint subclass** — create `BP_Weapon_<Name>` child of `BP_WeaponBase` (the Blueprint wrapper of `UWeaponBase`); attach mesh, set `WeaponData` reference.
5. **GAS integration** — wire `GE_WeaponCost_Ammo` consume effect and `GE_WeaponCooldown_FireRate` cooldown; details in `resources/gas-integration.md`.
6. **Verify** — attach weapon to character, fire in PIE, confirm ammo decrements, cooldown prevents over-firing, recoil curve plays.

## Resources (read on demand)

- `resources/interview.md` — four scoping questions.
- `resources/weapon-base.md` — full `UWeaponBase` C++ header + implementation.
- `resources/data-asset.md` — `UDA_WeaponData` C++ class + example data asset values.
- `resources/gas-integration.md` — `GE_WeaponCost_Ammo` and `GE_WeaponCooldown_FireRate` setup; how `UWeaponBase::Fire()` calls the GAS.
- `examples/` — example data asset values for a pistol, rifle, and shotgun.

## Success Criteria

- [ ] `UWeaponBase::Fire()` called from character; projectile or hitscan trace fires
- [ ] Ammo GAS attribute decrements on fire
- [ ] Fire rate enforced by GAS cooldown (cannot fire faster than `DA_WeaponData.FireRate`)
- [ ] Recoil curve asset drives camera pitch offset per shot
- [ ] `DA_Weapon_<Name>` data asset exists in `Content/Data/Weapons/`
- [ ] `BP_Weapon_<Name>` compiles with no errors and mesh is correctly attached
- [ ] Reload ability (`GA_Reload`) refills ammo attribute from `MaxAmmo`

## What to Commit

```
Source/<Project>/Weapons/WeaponBase.h
Source/<Project>/Weapons/WeaponBase.cpp
Source/<Project>/Weapons/DA_WeaponData.h
Source/<Project>/Weapons/DA_WeaponData.cpp
Content/Data/Weapons/DA_Weapon_<Name>.uasset
Content/Weapons/Blueprints/BP_Weapon_<Name>.uasset
Content/GAS/Effects/GE_WeaponCost_Ammo.uasset
Content/GAS/Effects/GE_WeaponCooldown_FireRate.uasset
```
