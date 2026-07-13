---
name: day-night-weather
description: Use when a project needs a server-authoritative game-time clock (day/night cycle, calendar/seasons) plus a seeded regional weather state machine — survival/crafting/civilization games with movable-sun lighting, temperature/production modifiers, and weather VFX/audio. Invoke when the user says "add a day-night cycle", "add weather", "make it snow", "add seasons", or when eng-gameplay needs a UDayNightSubsystem. Skip for indoor-only or fixed-time-of-day projects with no calendar/weather scope.
version: "1.0.0"
---

# Day-Night & Weather

> `UDayNightSubsystem` owns one replicated game-time clock (time scale, day length, calendar/season) and drives a movable sun. Weather is a seeded per-region state machine — deterministic from the world seed and day index, never `FMath::Rand`. Both broadcast delegates that survival stats, production chains, VFX, and audio subscribe to; neither system reaches into those consumers directly.

## When to use

Invoke for any project with a day/night cycle, seasons/calendar, or weather scope. Covers the clock subsystem, the movable-sun lighting rig (the locked no-Nanite/no-Lumen baseline's one lighting exception — see `resources/time-subsystem.md#lighting`), and the regional weather state machine. Escalate to `/ship` when this is the first time/weather pass on a project (new subsystem + replication + save schema is multi-surface). Use `/fix` for a single weather-type addition or a season-length tweak to an existing table. Skip entirely for interiors-only or always-daytime projects.

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Game-time clock** — one `UDayNightSubsystem` (`UWorldSubsystem`) owns `CurrentTimeOfDay`, `DayIndex`, `Season`, and `TimeScale`; server-authoritative and replicated to clients. See `resources/time-subsystem.md#clock`.
2. **Movable sun** — a `ADirectionalLight` actor rotated from the clock each tick (throttled), distance-field shadows only, no baked lightmaps. See `resources/time-subsystem.md#lighting`.
3. **Seeded weather state machine** — per-region weather transitions on a biome-weighted table, derived deterministically from `Hash(WorldSeed, RegionID, DayIndex)` — never a shared `FRandomStream`. See `resources/weather-effects.md#state-machine`.
4. **Delegate fan-out, not direct coupling** — `OnWeatherChanged`/`OnTimeOfDayChanged` delegates drive `SetByCaller` magnitudes into survival-stats temperature GEs, production-chain yield modifiers, VFX spawns, and Wwise RTPCs. This skill never calls into those systems' internals. See `resources/weather-effects.md#consumers`.
5. **Season hooks** — `Season` enum changes broadcast `OnSeasonChanged`, consumed by the civ/production layer for harvest-cycle gating. See `resources/weather-effects.md#seasons`.
6. **Determinism test** — a Functional Test replays the same seed + day index twice and asserts identical weather sequence per region; CI fails on mismatch.

## UE5 context

- Modules affected: `Source/<Project>/Public/World/` (`UDayNightSubsystem`, `UWeatherSubsystem`), `Source/<Project>/Public/Save/` (time/weather save fields), `Source/<Project>Tests/` (determinism Functional Test).
- Asset paths: `Content/World/DA_WeatherProfile_<Biome>.uasset` (weather transition tables per biome), `Content/World/BP_Sun.uasset`, `Content/VFX/Weather/` (Niagara systems, see `[[niagara-effect]]`).
- Config files: `Config/DefaultGame.ini` (day-length default, debug time-scale override), `project.config.json` (`perf.dynamic_lighting = true` — shared flag with `[[procgen-world]]`).

## Rules

- Never `FMath::Rand`/`FMath::RandRange` for weather transitions. Weather is a pure function of `Hash(WorldSeed, RegionID, DayIndex)` — see `resources/weather-effects.md#determinism`.
- Time and weather state are server-authoritative and replicated (`ReplicatedUsing`); clients never advance the clock or pick weather locally, only predict cosmetic interpolation.
- No baked lightmaps on the sun-lit level — this is the locked no-Nanite/no-Lumen baseline's explicit exception. Budget distance-field shadows against `quality/performance-budgets.md`'s GTX 1060 numbers; see `resources/time-subsystem.md#budget`.
- Weather never mutates gameplay attributes directly. It writes `SetByCaller` magnitudes into effects owned by `[[survival-stats]]` (temperature) and the civ/production layer (crop yield) — this skill owns the signal, not the consumer's GE.
- VFX for rain/snow/fog goes through `[[niagara-effect]]`'s GameplayCue pattern, keyed off `GameplayCue.Weather.<Type>`, not ad-hoc `SpawnSystemAtLocation` calls scattered in BP.
- Audio state (rain loop, wind intensity, thunder stingers) goes through `[[wwise-event-pipeline]]` RTPCs (`RTPC_Weather_Intensity`) — never raw `PostEvent` volume hacks.
- World-gen deltas (terrain) and time/weather deltas are separate logs; cross-reference `[[procgen-world]]`'s delta-log pattern for how both regenerate-and-replay identically on load.

## Resources (read on demand)

- `resources/time-subsystem.md` — `UDayNightSubsystem` C++ (clock replication, calendar/season enum, time-scale), movable-sun actor and lighting budget notes.
- `resources/weather-effects.md` — seeded regional weather state machine, biome-weighted transition tables, and the consumer wiring (survival-stats temperature, production-chain modifiers, Niagara VFX, Wwise RTPCs, season/harvest hooks).

## Output

A `UDayNightSubsystem` + `UWeatherSubsystem` (C++, `UWorldSubsystem`) exposing time/season/weather query APIs and change delegates, plus per-biome `DA_WeatherProfile_*` Data Assets — with `systems_surface[]` entries below written to `.claude/handoffs/systems.json`:

- `type: "subsystem"` — `UDayNightSubsystem`, `UWeatherSubsystem`; `blueprint_consumers` list every content-side listener (`BP_Sun`, `WB_SurvivalHUD`, weather VFX actors); `replication: "server"`.
- `type: "data_asset"` — one per `DA_WeatherProfile_<Biome>`; consumed by `design-technical` and `art-vfx`.
- `type: "effect"` (optional, if this project also owns the temperature GE) — `GE_Temperature_EnvironmentDrift`, `SetByCaller` tags listed for `[[survival-stats]]` to bind.

**Proven by**: `<Project>.World.Weather.Determinism.SameSeedSameSequence` — a Functional Test that replays a seed/day-index pair twice per region and asserts the weather sequence hash matches, gating `make automation-critical`. A second test, `<Project>.World.Clock.ReplicatesTimeOfDay`, proves client `CurrentTimeOfDay` matches server within one tick after a time-scale change.
