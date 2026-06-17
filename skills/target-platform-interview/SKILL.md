---
name: target-platform-interview
description: Use when a UE5 FPS project needs to lock target platforms, minimum spec, input paradigm (controller-first vs KBM-first), store configuration, and console certification requirements before any packaging or build pipeline work. Invoke when the user says "do the platform interview", "what platforms are we targeting", or "define the release target".
version: "1.0.0"
---

# Target Platform Interview

> Conversational intake that captures platform targets, minimum hardware spec, input paradigm, store/certification requirements, and accessibility baseline — then writes `docs/TARGET_PLATFORM.md`.

## When to use

Invoke before any packaging configuration, `.uproject` target file setup, or store page creation. Also invoke when `project.config.json` does not yet have a `platforms` key. Skip when `docs/TARGET_PLATFORM.md` exists and only adding one new platform — update in place.

## How it works

1. **Open the question bank** — read `resources/questions.md`; start with platform targets, then minimum spec, then input.
2. **Lock the minimum spec** — the performance baseline is GTX 1060 / PS5-equivalent at 60 FPS (from locked decisions). Confirm with the user — if they want to push specs higher or lower, note the trade-offs.
3. **Lock the input paradigm** — controller-first (console shipping, couch play, gamepad feel must be polished first) vs KBM-first (PC-native, mouse aiming, keyboard bindings primary). This affects Enhanced Input mapping context priority.
4. **Map to configuration** — read `resources/config-mapping.md`; translate platform choices to `.Target.cs` build targets, `DefaultEngine.ini` platform sections, and store configuration steps.
5. **Write `docs/TARGET_PLATFORM.md`** — use `resources/output-template.md`.
6. **Hand off** — give `build-release-engineer` the platform list and min spec; they configure cook targets and CI.

## Resources (read on demand)

- `resources/questions.md` — all interview questions.
- `resources/config-mapping.md` — maps platform decisions to `.Target.cs`, `DefaultEngine.ini`, Steam Depot config, EOS artifact config, and console SDK setup notes.
- `resources/output-template.md` — `docs/TARGET_PLATFORM.md` template.

## Output

A populated `docs/TARGET_PLATFORM.md` with platform targets, minimum hardware spec, input paradigm, store config notes, and accessibility baseline. `build-release-engineer` and `blueprint-feature-builder` (for input) read this.
