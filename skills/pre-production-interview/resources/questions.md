# Pre-Production Interview — Conversation Script

> Walk these sections in order. Prose-driven. Don't batch into multi-choice.

---

## Section 1 — The Aesthetic Paragraph (5 min)

Open with:

> "Before we touch any system, art, or narrative interview, I want one paragraph that anchors everything. Walk me through the **vibe** of the game — genre, mood, what the player *feels*. Name two or three reference games and one film/show if it helps. Don't write a pitch; describe a moment."

Follow-ups:
- "What's the first 10 seconds of gameplay the player sees?"
- "What's the one screenshot you'd put on the Steam page?"
- "If this game had a soundtrack, what's the headline track — name a real song?"
- "Tactical and slow, or fast and arcade-y? Fragile and grounded, or power-fantasy?"
- "Lighting — overcast and grimy, sun-bleached and stylized, neon and synthetic, dark and contrasty?"

Distill to **one paragraph** (3–5 sentences). Read it back. Confirm. This becomes the bible.

---

## Section 2 — Free Asset Shopping List (15 min)

Open with:

> "Before we build anything custom, let's grab everything Epic and Quixel give us for free. Walk through the catalog with me — for each category, I'll suggest the packs that fit the aesthetic paragraph and you tell me yes/no/maybe."

**READ `resources/free-assets-catalog.md` NOW.** It is grouped by category. Walk each category:

1. **FPS sample project base** — Lyra Starter Game (modern), ShooterGame (legacy reference). Which (if either) becomes the starter?
2. **Characters** — Paragon character packs (free), MetaHuman (free pipeline), DAZ Genesis. Which?
3. **Environments** — Quixel Megascans (always yes — free with Epic ID), Soul: City, Soul: Cave, Electric Dreams, Modular Asian Restaurant, City Sample. Which match the aesthetic?
4. **Weapons & FX** — Infinity Blade Weapons, Particle Effects Pack, Niagara samples. Which?
5. **Animation** — Animation Starter Pack, Game Animation Sample, Paragon animations. Which?
6. **Audio** — Wwise free tier vs MetaSounds + Freesound/Pixabay vs paid SFX library. Confirm direction (this also informs `audio-direction-interview`).
7. **UI** — Common UI sample widgets, Lyra UI as reference. Which?

For each YES, capture the **exact pack name** as it appears in Epic Games Launcher. Output a checklist the user can hand to whoever runs the launcher.

---

## Section 3 — Gameplay Feature Wish List (20 min)

Open with:

> "Now the hard part. I'll walk you through every FPS feature most games ship, and you triage each into one of three buckets — **IN** (vertical slice must have it), **LATER** (post-vertical-slice nice-to-have), **OUT** (this game just doesn't do that). The IN list should be ≤ 5 features. If it grows past 5, we're cutting."

**READ `resources/feature-checklist.md` NOW.** Walk it section by section.

Push back rules:
- If user says IN for matchmaking, dedicated server, procgen, mocap, full save system, achievements, leaderboards, or anything in the "high-effort" tier — challenge: "Is this in the vertical slice or is it LATER?"
- If IN list crosses 5 items, force a re-cut. Quote a comparable vertical slice (e.g. "Hades' vertical slice was one room, one weapon, one boss — what's our equivalent?").
- If user says OUT for a feature that's typically a hard requirement of the genre (e.g. shooting in an FPS), flag it as a risk — it might mean the genre is wrong.

Output: three lists — IN, LATER, OUT — with brief reasoning for each.

---

## Section 4 — Day-1 Test Loop (10 min)

Open with:

> "What's the smallest playable thing that proves the core fantasy? Two minutes of gameplay max. Player spawns, does X, encounters Y, succeeds/fails, sees the result. Walk me through it second by second."

Follow-ups:
- "What's the one button press that has to feel amazing on day 1?"
- "If a playtester quit after this 2-minute loop, what's the one thing we'd want them to say?"
- "How do we know it's working? Telemetry counter, manual checklist, gut feel from playtesters?"

Output: a numbered 5–8 step description of the day-1 loop + the success signal.

---

## Section 5 — Tooling Confirmations (5 min)

Run as quick prose Q&A:

- **IDE:** Rider for UE / Visual Studio 2022 / VSCode+clangd / Xcode?
- **Controller for testing:** Xbox / PS5 / 8BitDo / KBM only?
- **Capture:** OBS / ShadowPlay / Steam's recorder / capture card?
- **Playtest cadence:** weekly / biweekly / on-demand?
- **Playtester pool:** 3 friends / Discord community / Steam Playtest / external (e.g. PlaytestCloud)?
- **Crash reporting:** built-in CRC / Sentry / BugSplat / none for now?

---

## Section 6 — Write the Doc

Read `resources/output-template.md`. Populate every section from the conversation above. Save to `docs/PRE_PRODUCTION.md`. Confirm the doc with the user before declaring done.

Then list the next interviews to run, in order:
1. `concept-interview` (refines the aesthetic paragraph into pillars + multiplayer stance)
2. `art-direction-interview` (refines visual style from the aesthetic paragraph + asset list)
3. `narrative-interview` (story, opening hook, characters)
4. `audio-direction-interview` (refines audio direction from §2.6)
5. `monetization-interview` (in-game microtransactions plan, if any)
6. `target-platform-interview` (Steam / EOS / console specifics, min spec)
7. `project-scaffolder` (writes `project.config.json`, runs `gamebook-init.sh`)
