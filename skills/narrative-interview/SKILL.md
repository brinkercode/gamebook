---
name: narrative-interview
description: Use when a UE5 FPS project needs to lock setting, protagonist, story hook, and story beats before any dialogue trees or audio logs are authored — or when the user says "do the narrative interview", "define the story", or "who is the player character".
version: "1.0.0"
---

# Narrative Interview

> Conversational intake that captures setting, protagonist identity, story hook, act structure, and content rating constraints, then writes `docs/NARRATIVE.md`.

## When to use

Invoke after the concept interview (`docs/CONCEPT.md` exists) and before any dialogue trees or audio logs are created. Skip when `docs/NARRATIVE.md` exists and only one story beat is changing — update in place.

## How it works

1. **Open the question bank** — read `resources/questions.md`; run conversationally, setting and protagonist first.
2. **Lock the hook** — one sentence that explains why the player keeps playing. Confirm explicitly.
3. **Sketch the act structure** — confirm the three-act shape or non-linear structure for the vertical slice only.
4. **Map to systems** — read `resources/systems-mapping.md`; flag which narrative features require which game systems (dialogue tree skill, audio log pickup, level streaming zones, Wwise state changes).
5. **Write `docs/NARRATIVE.md`** — use `resources/output-template.md`.
6. **Hand off** — note which narrative content to author first (opening cinematic, first audio log, first NPC line), and which Wwise states need to be named before audio-direction interview.

## Resources (read on demand)

- `resources/questions.md` — all interview questions.
- `resources/systems-mapping.md` — maps narrative choices to game system requirements.
- `resources/output-template.md` — `docs/NARRATIVE.md` template.

## Output

A populated `docs/NARRATIVE.md` with setting, protagonist, antagonist, hook, act structure, content rating notes, and first-content priority list. `narrative-designer` reads this before authoring any dialogue or audio logs.
