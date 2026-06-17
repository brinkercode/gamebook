---
name: gas-ability
description: Use when adding a new Gameplay Ability to a UE5 FPS project — creates a UGameplayAbility subclass, cooldown and cost GameplayEffects, gameplay tags, and wires Enhanced Input to activation. Invoke when the user says "add an ability", "implement sprint", "create the grenade ability", or "add a GAS ability".
version: "1.0.0"
---

# GAS Ability

> Creates a `UGameplayAbility` subclass, `GE_<Name>_Cost`, `GE_<Name>_Cooldown`, gameplay tags, and wires the ability to an Enhanced Input action. Cooldown and cost are data-asset-driven via `ScalableFloat` curve tables.

## When to use

Invoke when any new player or enemy ability is needed. One ability per invocation. If adding a passive (infinite duration GE with no activation), use a GameplayEffect directly — do not create an ability wrapper. Escalate to `/ship` if the ability requires a new AttributeSet (e.g., adding a Shield attribute that does not exist yet).

## How it works

1. **Interview** — ask the scoping questions from `resources/interview.md`.
2. **Gameplay Tags** — add tags to `Config/DefaultGameplayTags.ini` per `resources/tags.md`.
3. **Ability class** — create `UGA_<Name>` using the template in `resources/ability-class.md`.
4. **Cost effect** — create `GE_<Name>_Cost` per `resources/effects.md`.
5. **Cooldown effect** — create `GE_<Name>_Cooldown` per `resources/effects.md`.
6. **Grant ability** — add `FGameplayAbilitySpec` to the character's ASC in `BeginPlay` or on possession.
7. **Input binding** — map the ability to an `IA_<Name>` Input Action per `resources/input-binding.md`.
8. **Verify** — activate in PIE, confirm cost deducted, cooldown blocks re-activation, tag granted during active phase.

## Resources (read on demand)

- `resources/interview.md` — scoping questions.
- `resources/ability-class.md` — `UGA_<Name>` C++ template with `ActivateAbility`, `EndAbility`, and ability task patterns.
- `resources/effects.md` — `GE_Cost` and `GE_Cooldown` setup with SetByCaller and ScalableFloat examples.
- `resources/tags.md` — standard tag taxonomy and `DefaultGameplayTags.ini` entry format.
- `resources/input-binding.md` — how to bind Enhanced Input to `TryActivateAbilityByClass`.

## Success Criteria

- [ ] `GA_<Name>` activates when input action pressed
- [ ] Cost GE deducts from attribute (e.g., Stamina, Ammo) on activation
- [ ] Cooldown GE blocks re-activation; `GetCooldownTimeRemaining()` returns > 0 while active
- [ ] `Ability.<Name>.Active` tag granted on activation, removed on end
- [ ] Ability ends cleanly: `EndAbility(Handle, ActorInfo, ActivationInfo, true, false)` called in all code paths
- [ ] No `check()` failures or ensure warnings in PIE log

## What to Commit

```
Source/<Project>/GAS/Abilities/GA_<Name>.h
Source/<Project>/GAS/Abilities/GA_<Name>.cpp
Content/GAS/Abilities/GA_<Name>.uasset        (Blueprint child if needed)
Content/GAS/Effects/GE_<Name>_Cost.uasset
Content/GAS/Effects/GE_<Name>_Cooldown.uasset
Config/DefaultGameplayTags.ini                (new tags appended)
```
