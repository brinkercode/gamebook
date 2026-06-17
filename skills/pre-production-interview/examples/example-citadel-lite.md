# Example — Pre-Production Plan for "Citadel Lite"

> Reference example of a populated `docs/PRE_PRODUCTION.md`. Showcases tight scope and aggressive cutting.

---

# Citadel Lite — Pre-Production Plan

**Status:** Locked
**Owner:** brinkercode
**Last updated:** 2026-06-16

---

## 1. Aesthetic Paragraph

Citadel Lite is a tactical single-player FPS set inside a derelict orbital station during a forced evacuation. The player feels alone, low on ammo, and chased — every encounter is a resource puzzle, not a power fantasy. Visually: cold sodium-lit corridors, harsh contrast, sparse particles, Wwise reverb-heavy spatial audio. Think Dead Space's mood with Titanfall 2's movement (slide + double-jump), styled like Control's brutalist architecture. Reference film: *Alien* (1979) — for lighting and pacing.

**Reference games:**
- Dead Space (1) — for mood and resource scarcity
- Titanfall 2 single-player — for movement feel (slide + double-jump)
- Control — for visual style (brutalist concrete, sodium-orange light)

**Reference film:** *Alien* (1979) — for hallway lighting, deliberate pacing, off-camera threat

---

## 2. Free Asset Shopping List

### 2.1 FPS sample / starter project
- [x] **Lyra Starter Game** — GAS + Common UI + Enhanced Input, gut the team-deathmatch mode

### 2.2 Characters
- [x] **MetaHuman Sample** (player + 1 enemy variant)
- [x] **Paragon: Shinbi** — repurpose as enemy "ghost" type (stylized but works with retexture)

### 2.3 Environments
- [x] **Quixel Megascans** — concrete, metal, decals (orbital station detailing)
- [x] **Modular Building Set: Industrial Apocalypse** — corridor base kit
- [x] **Old Garage** — single set piece (cargo bay)

### 2.4 Weapons / props
- [ ] Custom — Lyra's pistol + assault rifle retextured

### 2.5 VFX
- [x] **Niagara Fluids** (sparks, electrical arcs)
- [x] **Particle Effects Pack** — for muzzle flashes (port from Cascade)

### 2.6 Animation
- [x] **Game Animation Sample** — motion-matched locomotion
- [x] **Mixamo** — enemy stagger/death anims

### 2.7 Audio
- [x] **Freesound.org curated set** — initial weapon + ambient
- [x] Decision: **Wwise** (free tier) — chosen for spatial reverb requirements; sound designer (Mia) knows it

### 2.8 UI
- [x] **Common UI Plugin** (enabled)
- [x] **Lyra UI** as menu stack reference

### 2.9 External free tools
- [x] Blender (model adjustments)
- [x] Quixel Mixer (material variants)
- [x] OBS Studio (weekly playtest capture)
- [x] Audacity (SFX trimming)

---

## 3. Vertical Slice Feature Set

### 3.1 IN — vertical slice (5 features)
1. **Movement: walk + crouch + slide + double-jump** — sells the "Titanfall in a horror setting" hook
2. **Combat: 1 pistol (hitscan) + 1 assault rifle (hitscan, recoil) + ADS + reload** — minimum viable gunplay
3. **One GAS ability: "EMP Pulse" (Q-key)** — stuns enemies briefly, proves GAS plumbing works
4. **One enemy archetype: "Husk" — patrols, hears, charges in melee** — Behavior Tree + UE Perception
5. **One level: cargo bay corridor + control room** — ~3-min playable, one encounter director triggering 2 waves + 1 mini-boss

### 3.2 LATER
- Second weapon (shotgun)
- Save/load (checkpoint only for slice)
- Second enemy type (ranged)
- Ability variants
- Steam Cloud save
- Achievements
- Localization

### 3.3 OUT
- Multiplayer / co-op
- Procedural generation
- Vehicles
- Crafting / inventory beyond ammo
- Skill tree / progression
- Microtransactions (vertical slice is launch-content-only)

---

## 4. Day-1 Test Loop (2-minute proof)

**Loop:**
1. Player spawns in cargo bay, dim sodium lighting, alarm distant
2. Player picks up pistol (highlighted) — tutorial prompt: "RMB to ADS, LMB to fire"
3. Player slides under a half-closed bulkhead to enter the corridor
4. First Husk appears at the corridor end — charges
5. Player either: kills it with pistol headshot (success), or uses EMP Pulse to stun + melee (alt success), or dies (re-spawn at cargo bay)
6. After Husk dies, audio cue + door opens revealing the control room
7. Player enters control room → mini-encounter ends → screen fades to "Vertical Slice Complete"

**Success signal:** 80% of first-time playtesters reach the control room within 3 minutes WITHOUT verbal hints from the dev.

**Tuning targets (week 1):**
- Time-to-first-shot < 10 seconds from spawn
- Slide-under-bulkhead discovery rate > 70% (otherwise add a louder visual cue)
- Husk kills feel "earned" (not too easy / not frustrating) — measure via post-test 1-5 rating

---

## 5. Tooling Confirmations

| Tool | Choice |
|---|---|
| IDE | Rider for UE (paid, indie license) |
| Controller | Xbox Wireless (primary), KBM (secondary) |
| Capture | OBS Studio |
| Playtest cadence | Weekly Friday 4pm |
| Playtester pool | 4 friends in Discord + 1 external (Tom from work) |
| Crash reporting | Built-in CRC for now; Sentry post-vertical-slice |
| Source control host | GitHub (private) |
| LFS storage | GitHub LFS data pack ($5/mo, 50GB) |
| Task tracking | Linear (free tier) |

---

## 6. Risk Flags

- ⚠️ **Wwise** — Mia (sound) knows it, Brent (programmer) doesn't. Decision: Mia owns all Wwise project work; Brent gets a 1-day Wwise integration crash course in week 2.
- ⚠️ **Sodium-orange lighting** — risk of looking muddy. Decision: lock palette in art-direction-interview before any level dressing; reject pieces that don't fit.
- ⚠️ **Slide-under-bulkhead mechanic** — discovery rate is a known unknown. Decision: if first playtest < 50% discovery, add an audio breadcrumb + bigger visual cue before iterating further.
- ⚠️ **Husk AI feel** — charge-into-melee can feel cheap. Decision: add stagger window + audible footsteps before contact so player can react.

---

## 7. Next Interviews to Run

1. [x] `concept-interview` — confirmed pillars (tension, agency, mastery)
2. [x] `art-direction-interview` — palette locked (sodium #FFA640 / concrete #5C5C5C / blood #8B1A1A)
3. [ ] `narrative-interview` — schedule for 2026-06-18
4. [x] `audio-direction-interview` — Wwise locked
5. [ ] `monetization-interview` — SKIP (no monetization in vertical slice)
6. [ ] `target-platform-interview` — schedule for 2026-06-19
7. [ ] `project-scaffolder` — after target-platform interview

---

## 8. Locked decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-06-16 | Lyra as starter | GAS + Common UI pre-wired; saves ~3 weeks |
| 2026-06-16 | Single-player only | Multiplayer is a separate game's worth of work |
| 2026-06-16 | Wwise over MetaSounds | Spatial reverb is core to mood; Mia knows Wwise |
| 2026-06-16 | One level, ~3 min playable | Anything more = scope bleed |
| 2026-06-16 | No monetization in slice | Validate game feel first; store comes post-slice |
