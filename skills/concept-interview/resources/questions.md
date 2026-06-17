# Concept Interview — Question Bank

Run conversationally. One section at a time, adapt follow-ups based on answers. Do not batch all questions into a single list — wait for the user to answer before continuing.

---

## Section 1: Genre and Player Fantasy

Ask in prose, not multiple-choice. Listen for the real answer buried in description.

1. **Describe the game in one sentence from the player's perspective.** (Not "it's an FPS" — "you are X doing Y in a world where Z")
2. **What is the core loop?** (Encounter → combat → reward → next encounter, or something else?)
3. **What is the genre subtype?**
   - Tactical / mil-sim (slow, deliberate, team-coordinated)
   - Arena shooter (fast, skill-expression, ranked)
   - Immersive sim (systemic, emergent, environmental storytelling)
   - Extraction / looter-shooter (risk-reward, inventory economy)
   - Campaign / narrative FPS (story-first, linear or open)
   - Hybrid — describe the blend
4. **What is the player fantasy — the feeling the game must deliver?** ("Power", "paranoia", "mastery", "survival horror", "heist thrill" — ask them to name it)
5. **Name three games this borrows from.** (Direct references, not inspirational vague)
6. **Name one game that is close but wrong.** (The "anti-reference" — what to avoid)

---

## Section 2: Scope and Team

7. **Team size?** (Solo / 2–3 / 4–5 / larger?)
8. **Timeline for the vertical slice?** (3 months / 6 months / 12 months — one shippable scenario)
9. **What is "done" for the vertical slice?** (One level playable start-to-finish? A specific boss encounter? A timed tournament match?)
10. **What is explicitly out of scope for the vertical slice?** (This is as important as what is in scope)
11. **Is anyone on the team a dedicated artist?** (Affects asset strategy — Megascans-only vs custom art pipeline)

---

## Section 3: Design Pillars

After hearing the genre, fantasy, and references, propose three candidate pillars as terse phrases ("readable engagement", "lethal economy", "environmental agency"). Ask the user to react — replace, rename, or add until three to five pillars are locked.

12. **Do these three pillars capture the game?** (Read proposed pillars back; iterate until confirmed)
13. **Which pillar is the tiebreaker?** (When two features compete for scope, this pillar wins)

---

## Section 4: Multiplayer Stance

14. **Single-player only, multiplayer optional later, or multiplayer from day one?**
    - Single-player: no replication needed; GAS can skip net relevancy setup.
    - Optional later: design GAS attributes and abilities as replicated from the start; don't paper over it.
    - Multiplayer day one: dedicated server, Replication Graph, network prediction — scope increases significantly.
15. **If multiplayer: how many players per session?** (2v2, 4v4, 16v16 — each tier changes the Replication Graph config)
16. **If multiplayer: cooperative or competitive or both?**

---

## Section 5: Tone and Conflict

17. **Describe the visual tone in three words.** (e.g., "grimy brutalist neon", "sunbleached southwestern gothic", "clean corporate horror")
18. **What is the primary conflict driver?** (Human vs human, human vs environment, human vs self, human vs AI/machine)
19. **Is violence stylized or grounded?** (This affects hit-react animations, blood VFX budget, and platform rating targets)

---

## Design Pillars Locking Exercise

After all sections, write the five-column decision matrix:

| Decision | Chosen | Rationale | Pillar it serves | Revisit trigger |
|---|---|---|---|---|
| Genre subtype | | | | |
| Core loop | | | | |
| Multiplayer stance | | | | |
| Vertical slice definition | | | | |
| Tiebreaker pillar | | | | |

Confirm every row before writing `docs/CONCEPT.md`.
