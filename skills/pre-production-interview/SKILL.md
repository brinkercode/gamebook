---
name: pre-production-interview
description: Use BEFORE deep concept/art/narrative interviews to lock the cheapest possible vertical-slice direction — aesthetic vibe in one paragraph, a curated free-asset shopping list from the UE Marketplace / Quixel / Epic Free Collection, the gameplay feature wish list triaged into IN/OUT/LATER, and the day-1 test loop. Invoke when the user says "kick off the project", "let's plan the game", "do the pre-production interview", or when starting a brand-new project before any deep interview or scaffold has run.
version: "1.0.0"
---

# Pre-Production Interview

> The first interview that runs on a new gamebook project. Captures aesthetic intent, free-asset shopping list, feature wish list (triaged into vertical-slice IN / OUT / LATER), and the day-1 test loop. Writes `docs/PRE_PRODUCTION.md` — the document every other interview, the scaffolder, and the build pipeline read first.

## When to use

- **At project birth** — before `concept-interview`, `art-direction-interview`, or `project-scaffolder`. The deeper interviews refine what this one sketches; running them blind wastes the user's time.
- **When the user wants to start shopping for free assets** — this interview maps aesthetic intent to a real list of grabbable packs so they can populate `Content/Marketplace/` before any custom art work begins.
- **When triaging scope** — even mid-project, re-run the FEATURE WISH LIST section to re-cut IN/OUT/LATER if scope is drifting.

Skip when `docs/PRE_PRODUCTION.md` already exists AND the user is not asking for a re-cut.

## How it works

Run conversationally — **prose-driven, not multi-choice batches**. The user describes their vision; you confirm understanding, push back on scope, and write the doc.

1. **Read `resources/questions.md`** — the conversation script. Walk through sections in order; don't batch.
2. **The Aesthetic Paragraph (5 min)** — one paragraph capturing genre + mood + visual reference. Quote at least two reference games and one film/show if relevant. This paragraph is the single source of truth that downstream interviews refine.
3. **Free Asset Shopping List (15 min)** — read `resources/free-assets-catalog.md`. Walk the catalog by category (FPS sample, characters, environments, weapons, VFX, audio). For each, recommend the specific free pack(s) that match the aesthetic paragraph, and capture user approval. Output: a checklist of asset packs to grab from Epic Games Launcher, Quixel Bridge, and external free sources.
4. **Gameplay Feature Wish List (20 min)** — read `resources/feature-checklist.md`. Walk the FPS feature catalog. For each, the user says: vertical-slice IN, post-vertical-slice LATER, or OUT entirely. Aggressive cutting is the default — challenge any IN that isn't core to the design pillars.
5. **Day-1 Test Loop (10 min)** — what's the smallest playable thing that proves the core fantasy? Two-minute loop max. Capture how the team will know it's working (playtest cadence, telemetry, manual checklist).
6. **Tooling Confirmations (5 min)** — IDE, controller for testing, capture/streaming setup, who playtests and when.
7. **Write `docs/PRE_PRODUCTION.md`** — use `resources/output-template.md`. Populate every section from the conversation.
8. **Hand off** — tell the user which interviews to run next (concept → art-direction → narrative → audio-direction → monetization → target-platform → project-scaffolder). Note that `concept-interview` and `art-direction-interview` will refine but not contradict the aesthetic paragraph.

## Resources (read on demand)

- `resources/questions.md` — the conversation script with prose prompts per section.
- `resources/free-assets-catalog.md` — curated list of known-good free UE5 assets (Epic Permanent Collection, Quixel Megascans, third-party free, sample projects). Updated periodically.
- `resources/feature-checklist.md` — comprehensive FPS feature catalog for triage. Includes typical effort estimates so the user can scope realistically.
- `resources/output-template.md` — the `docs/PRE_PRODUCTION.md` template to populate.

## Output

A populated `docs/PRE_PRODUCTION.md` containing:
- Aesthetic Paragraph (the bible — every other doc must align)
- Free Asset Shopping List (checkboxes, by source)
- Vertical Slice Feature Set (IN / OUT / LATER triage)
- Day-1 Test Loop (the 2-minute proof)
- Tooling Confirmations
- Risk Flags (anything user said that sounds expensive / out of indie scope)
- Next Interviews to Run

`project-scaffolder` and every other interview reads this doc before running. `code-reviewer` references the feature triage when flagging scope creep.

## Rules

1. **Prose, not multi-choice.** The user describes their vision in their own words. Only use AskUserQuestion for binary confirmations like "single-player or multiplayer" or "Steam-first or console-first".
2. **Aggressive cutting.** Vertical slice IN list should be ≤ 5 features. Anything else is LATER or OUT. If the user resists, name a real reference game's vertical slice for scale.
3. **Real asset links.** When recommending a free pack, give the exact name as it appears in the Epic Games Launcher / Marketplace search. No "I think there's a pack called…" — read the catalog.
4. **Risk flags are mandatory.** Anything that says "we'll need a custom shader / mocap / dedicated server / online matchmaking / procedural generation" goes in the Risk Flags section even if user wants it IN.
5. **One paragraph aesthetic limit.** If the user gives you three paragraphs, distill it to one and confirm. The aesthetic paragraph is a compass, not a manifesto.
