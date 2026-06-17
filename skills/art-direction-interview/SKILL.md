---
name: art-direction-interview
description: Use when a new UE5 FPS project needs to lock visual style, palette, reference imagery, mood, and material/lighting strategy before any art assets are imported — or when the user says "do the art interview", "define the visual style", or "what should the game look like".
version: "1.0.0"
---

# Art Direction Interview

> Conversational intake that captures visual style, palette, reference images, mood board priorities, and UE5 material/lighting strategy, then writes `docs/ART_DIRECTION.md`.

## When to use

Invoke after the concept interview (`docs/CONCEPT.md` exists) and before any art assets are imported or materials are created. Also invoke when the user mentions visual style without a settled direction. Skip when `docs/ART_DIRECTION.md` already exists and only one element is changing — update in place.

## How it works

1. **Open the question bank** — read `resources/questions.md`; run conversationally, starting with references and mood before moving to technical constraints.
2. **Gather references** — ask the user to share image URLs, Artstation links, or game screenshots; record them verbatim.
3. **Lock palette** — derive a four-to-six color palette from the references plus the tone words from `docs/CONCEPT.md`; confirm with the user.
4. **Map to pipeline** — read `resources/pipeline-mapping.md`; translate style choices into concrete UE5 decisions (Nanite on/off, Lumen vs baked, material complexity tier, Megascans filter tags).
5. **Write `docs/ART_DIRECTION.md`** — use `resources/output-template.md`.
6. **Hand off** — note which asset folders in `Content/` need placeholder creation before the first level blockout.

## Resources (read on demand)

- `resources/questions.md` — all interview questions grouped by section.
- `resources/pipeline-mapping.md` — maps style decisions to UE5 pipeline choices (Nanite, Lumen, material complexity, Megascans tags, LOD strategy).
- `resources/output-template.md` — the full `docs/ART_DIRECTION.md` template.

## Output

A populated `docs/ART_DIRECTION.md` with locked palette, reference list, mood priorities, material complexity tier, lighting strategy, and asset pipeline notes. `blueprint-feature-builder` and `level-encounter-designer` read this doc when creating materials and dressing levels.
