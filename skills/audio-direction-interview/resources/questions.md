# Audio Direction Interview — Question Bank

---

## Section 1: Tone and References

1. **Name three games or films whose audio you want to borrow from.** (Game title + the specific element: "DOOM Eternal — guitars and percussion that sync to kill pace"; not just "DOOM Eternal")
2. **Describe the music in one sentence from the player's perspective.** ("The music makes me feel like I am always two seconds from death" is more useful than "action music")
3. **Is music reactive to gameplay, or is it a static score?** (Reactive: Wwise State/Switch-driven layers. Static score: streamed music cues with crossfades.)
4. **What emotion should the ambient sound create between combat encounters?** (Dread, curiosity, relief, isolation — name it)
5. **What is the most important single sound effect in the game?** (The sound that must feel perfect — usually the primary weapon fire or footsteps. This sets the production tier for all other SFX.)

---

## Section 2: Music

6. **Genre and instrumentation of the primary combat music?** (Electronic / orchestral / hybrid / acoustic / diegetic-only / no music during combat)
7. **Genre and instrumentation of exploration music?** (Can be the same genre at lower intensity, or a completely different palette)
8. **Is there a main theme?** (A melodic motif that recurs — affects music budget and composer brief)
9. **Are there any areas where music must be completely absent?** (Horror-adjacent games often cut music to heighten tension in specific rooms)
10. **What is the target dynamic range?** (Loud and punchy / cinematic broad / lo-fi compressed / quiet with spikes)

---

## Section 3: SFX Language

11. **Are weapon sounds synthesized or recorded?** (Synthesized = more stylized control; recorded = grounded realism — both can be pitched/layered)
12. **Describe the SFX tone in three words.** (e.g., "punchy metallic visceral", "soft organic haunting", "clean clinical precise")
13. **How loud and present are enemy vocalizations?** (Critical gameplay read vs. ambient flavor)
14. **Is there a UI/HUD sound design language?** (Minimal / arcade-punchy / diegetic / silent)

---

## Section 4: Ambience and Foley

15. **Describe the primary ambience layer in one sentence.** (What the player hears when they stop and listen in the default environment)
16. **How many distinct ambience zones are in the vertical slice?** (Each zone = one Wwise Ambient Bus channel or one MetaSound graph)
17. **Is there foley?** (Footstep material variation, cloth rustle, gear rattle — yes adds significant authoring time; no is a valid scoping decision)
18. **Are there diegetic music sources?** (Radios, PA systems, jukeboxes in the level — these are actors with `UAkComponent` playing Wwise Events)

---

## Section 5: Middleware and Technical

19. **Wwise or MetaSounds?** (Wwise is default and mandatory for projects using the narrative state machine. MetaSounds is valid for solo/tiny team with no Wwise license budget — confirm understanding of the trade-offs before changing.)
    - Wwise: professional mixing, RTPC, state machines, Spatial Audio, Wwise Reflect for reverb. Requires Wwise license (free for indie under revenue threshold).
    - MetaSounds: built into UE5, no license, excellent procedural SFX synthesis, limited mixing control vs Wwise.
20. **If Wwise: what Wwise version?** (Match the integration plugin version to the UE5 version — Wwise 2023.1.x for UE5.4)
21. **Is Wwise Spatial Audio (room acoustics + portals) needed?** (Yes adds reverb zones, portal occlusion — significant setup but transforms interior audio)
22. **Mixing philosophy: how should combat audio duck ambience?** (Side-chain ducking on Combat RTPC: ambience Bus -12 dB during combat, recovery 2 seconds after last hit)
