---
name: concept-interview
description: Use when starting a new UE5 FPS game project and need to capture genre subtype, fantasy, design pillars, scope, and multiplayer intent before any system design — or when the user says "do the concept interview", "let's define the game", or "start the project interview".
version: "1.0.0"
---

# Concept Interview

> Conversational intake that locks in genre subtype, player fantasy, design pillars, team scope, and multiplayer intent, then writes `docs/CONCEPT.md` before any C++ or Blueprint work begins.

## When to use

Invoke when the user is starting a new UE5 FPS project or explicitly asks for the concept interview. Also invoke when `project.config.json` is missing and the scaffolder is about to run. Skip when `docs/CONCEPT.md` already exists and only incremental updates are needed — update in place.

## How it works

1. **Open the question bank** — read `resources/questions.md`; run the interview conversationally, section by section, adapting follow-ups based on answers.
2. **Lock design pillars** — confirm three to five pillars from the user's prose; these become the filter for every future feature decision.
3. **Scope the vertical slice** — size team headcount, timeline, and the one scenario that must be shippable.
4. **Map to architecture** — read `resources/architecture-mapping.md`; call out any flags (multiplayer, GAS complexity, platform count, AI density) before leaving the concept domain.
5. **Write `docs/CONCEPT.md`** — use the template in `resources/output-template.md`; populate every section from the interview answers.
6. **Hand off** — note which sibling interviews remain (art-direction, narrative, audio-direction, monetization, target-platform) and flag whether the scaffolder should run next.

## Resources (read on demand)

- `resources/questions.md` — read at step 1; all interview questions grouped by section plus the pillar-locking exercise.
- `resources/architecture-mapping.md` — read at step 4; maps each concept decision to concrete UE5 architecture implications (GAS complexity, replication graph, AI budget, streaming strategy).
- `resources/output-template.md` — read at step 5; the full `docs/CONCEPT.md` template to populate and write.

## Output

A populated `docs/CONCEPT.md` covering game type, player fantasy, design pillars, scope constraints, multiplayer stance, vertical slice definition, and a locked decisions log. `project-scaffolder` reads this doc during setup.
