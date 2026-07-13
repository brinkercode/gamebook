---
name: survival-stats
description: Use when a survival/crafting/civilization project needs hunger, thirst, temperature, stamina, or health as GAS-driven vitals with periodic drain, threshold debuffs, and biome/weather modifiers. Invoke when the user says "add survival stats", "hook up hunger and thirst", "make cold damage the player", "add stamina drain", or "wire vitals to the HUD". Reusable across any gamebook project with a survival-mechanics scope, not limited to Palworld/Anno-shaped games.
version: "1.0.0"
---

# Survival Stats

> One `UPlayerSurvivalAttributeSet` carrying Hunger, Thirst, Temperature, Stamina, and Health, driven entirely by infinite `UGameplayEffect`s with `FScalableFloat` rates from `CurveTable`s. Thresholds are `FGameplayTag`s, not magic numbers, and they drive both debuff `GameplayEffect`s and HUD state.

## When to use

Invoke for any project with a survival-mechanics scope (hunger/thirst/temperature/exposure/stamina). Covers the AttributeSet, the periodic drain effects, threshold tag flips, and environment hooks. For the ability that lets the player *eat* or *drink* (consuming an item to restore a stat), use `gas-ability` — this skill only owns the vitals and their passive drain. For the numbers displayed on screen, use `hud-widget`. Escalate to `/ship` if adding vitals requires new inventory/crafting systems beyond the attribute wiring.

## How it works

1. **AttributeSet** — create `UPlayerSurvivalAttributeSet` (one set, five clamped attributes + meta attribute) per `resources/attribute-set.md`.
2. **Gameplay Tags** — add `State.Starving`, `State.Dehydrated`, `State.Freezing`, `State.Overheating`, `State.Exhausted` to `Config/DefaultGameplayTags.ini`.
3. **Drain effects** — create `GE_Hunger_Drain`, `GE_Thirst_Drain`, `GE_Stamina_Regen`, `GE_Temperature_Drift` as `Infinite` GEs with `Period` per `resources/periodic-effects.md`; rates pull from `CT_SurvivalRates` via `FScalableFloat`.
4. **Environment modifiers** — biome/weather/activity feed `SetByCaller` magnitudes into the drift effects at apply time (see `resources/periodic-effects.md#environment-hooks`); [[day-night-weather]] owns the source data, this skill only consumes it.
5. **Threshold reaction** — a `UGameplayEffect` bound to a `GameplayCue`/`AbilityTask_WaitAttributeChangeThreshold` (or a lightweight tick in the AttributeSet's `PostGameplayEffectExecute`) grants/removes the `State.*` tag and applies the matching debuff GE (e.g. `State.Starving` → `GE_Starvation_HealthDrain`).
6. **HUD binding** — wire `WB_SurvivalHUD` per the `hud-widget` skill pattern, subscribing to `GetGameplayAttributeValueChangeDelegate` for each vital plus the `State.*` tag delegates for icon/vignette state.
7. **Verify** — Functional Tests per `resources/periodic-effects.md#tests` prove drain rate, clamp bounds, and threshold tag flips.

## Rules

- **GAS is the only path.** No `Tick()`-based stat drain, no hand-rolled timers. Every drain/regen is an `Infinite` `UGameplayEffect` with `Period`; every threshold reaction is a tag, not a raw float compare scattered across gameplay code.
- **Clamp in `PreAttributeChange`**, never in the effect or in BP. Damage-from-starvation/dehydration/exposure routes through a meta attribute (`Damage`) converted to `Health` loss in `PostGameplayEffectExecute` — vitals never directly subtract `Health`.
- **Server-authoritative.** All drain/regen effects apply on the server (`AbilitySystemComponent` on the authoritative actor); clients only predict cosmetic feedback (vignette, icon pulse), never the underlying value.
- **Deterministic-by-seed** where drain/threshold behavior depends on procedurally generated biome/weather data — the modifier magnitude must be a pure function of `[[procgen-world]]`'s seeded delta log, not client-side randomness. Re-simulating the same seed + delta log must reproduce identical vital curves.
- **Replication**: Health/Stamina are `COND_None` (visible to all, needed for other players' HUD/animation); Hunger/Thirst/Temperature are `COND_OwnerOnly` (private to the owning client) unless the project's design calls for visible status icons to other players.

## Resources (read on demand)

- `resources/attribute-set.md` — full `UPlayerSurvivalAttributeSet` C++ (header + `PreAttributeChange` + `PostGameplayEffectExecute` + replication setup), meta-attribute damage conversion, threshold-tag reaction pattern.
- `resources/periodic-effects.md` — `GE_*_Drain`/`GE_*_Regen` Infinite-GE configuration, `FScalableFloat`/`CurveTable` setup, biome/weather/activity `SetByCaller` environment hooks, and the Functional Test specs (drain rate, clamp bounds, threshold flips).

## UE5 context

- Modules affected: `Source/<Project>/Public/Abilities/` (AttributeSet header), `Source/<Project>/Private/Abilities/` (.cpp), `Source/<Project>Tests/` (Functional Tests).
- Asset paths: `Content/GAS/Effects/Survival/` (drain/threshold GEs), `Content/Data/CT_SurvivalRates.uasset` (CurveTable), `Content/UI/HUD/WB_SurvivalHUD.uasset`.
- Config files: `Config/DefaultGameplayTags.ini` (State.* tags, SetByCaller.* tags).

## Output

A wave run using this skill delivers: `UPlayerSurvivalAttributeSet` (C++), the four-plus periodic `GE_*` assets wired to `CT_SurvivalRates`, the `State.*` threshold tags with their debuff GEs, and a `systems_surface[]` handoff entry per attribute/effect (see below) so `design-technical` can bind `WB_SurvivalHUD` without re-deriving the schema.

**`systems_surface[]` entries this skill produces** (written to `.claude/handoffs/systems.json` by `eng-gameplay`):
- `type: "attribute"` — one per vital (`Hunger`, `Thirst`, `Temperature`, `Stamina`, `Health`), `header_path` → `PlayerSurvivalAttributeSet.h`, `blueprint_consumers: ["WB_SurvivalHUD", ...]`, `replication` per the rule above.
- `type: "effect"` — one per `GE_*_Drain`/`GE_*_Regen`/`GE_*_Debuff`, `gameplay_tags` listing the `SetByCaller.*` and `State.*` tags it reads/grants.
- `type: "subsystem"` (optional) — if the project centralizes environment sampling in a `UWorldSubsystem` (e.g. `USurvivalEnvironmentSubsystem` bridging [[day-night-weather]] into `SetByCaller` calls), list it here so `design-technical` knows where to wire biome/weather data.

**Proven by**: `Survival.AttributeSet.Hunger.DrainsAtCurveRate`, `Survival.AttributeSet.ClampBounds.NeverExceedMax`, `Survival.Thresholds.Starving.TagGrantedBelowZeroHunger` — see `resources/periodic-effects.md#tests` for the full list and pass/fail criteria.
