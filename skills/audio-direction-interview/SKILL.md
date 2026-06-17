---
name: audio-direction-interview
description: Use when a UE5 FPS project needs to lock music tone, SFX language, ambience strategy, and Wwise vs MetaSounds choice before any audio assets are imported — or when the user says "do the audio interview", "define the sound design", or "what should the game sound like".
version: "1.0.0"
---

# Audio Direction Interview

> Conversational intake that captures music tone, SFX language, ambience layers, audio middleware choice (Wwise primary / MetaSounds fallback), and mixing philosophy, then writes `docs/AUDIO.md`.

## When to use

Invoke after the narrative interview (`docs/NARRATIVE.md` exists, Wwise state names defined) and before any Wwise project is created or MetaSound graphs are authored. Skip when `docs/AUDIO.md` exists and only one audio element is changing.

## How it works

1. **Open the question bank** — read `resources/questions.md`; start with emotional tone references, then move to technical choices.
2. **Lock the audio middleware** — Wwise is default. Confirm the user's preference; if MetaSounds-only, note that Wwise state machine integration (from narrative interview) must be replaced with Blueprint-driven MetaSound parameter changes.
3. **Name Wwise objects** — if Wwise: capture Bus hierarchy, State Groups (carry over from `docs/NARRATIVE.md`), RTPC names, and Wwise event naming convention.
4. **Map to implementation** — read `resources/implementation-mapping.md`; translate audio choices to concrete Wwise/MetaSound setup steps.
5. **Write `docs/AUDIO.md`** — use `resources/output-template.md`.
6. **Hand off** — give `narrative-content-author` the Wwise state list and event naming convention.

## Resources (read on demand)

- `resources/questions.md` — all interview questions.
- `resources/implementation-mapping.md` — maps audio decisions to Wwise hierarchy, Bus chain, RTPC list, and MetaSound graph patterns.
- `resources/output-template.md` — `docs/AUDIO.md` template.

## Output

A populated `docs/AUDIO.md` with music tone, SFX language, ambience layer plan, Wwise Bus hierarchy, RTPC list, State Groups, event naming convention, and mixing philosophy. `narrative-content-author` reads this before any Wwise event hookup work.
