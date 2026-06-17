# FPS Feature Triage Checklist

> Walk every section with the user. For each feature, mark **IN** (vertical slice), **LATER** (post-vertical-slice), or **OUT** (not this game). Effort scale: **S** = days, **M** = weeks, **L** = month+, **XL** = multi-month / risky for indie.
>
> The IN list should be ≤ 5 features total. Anything more = forced re-cut.

---

## Core Player Movement

| Feature | Effort | Notes |
|---|---|---|
| Walk / run / crouch / jump | S | Always IN for FPS. |
| Sprint with stamina | S | Optional — only if it shapes pacing. |
| Sliding (Apex/Titanfall style) | M | Defining mechanic if IN; cuts otherwise. |
| Wall-running / wall-jumping | M | Risky — needs animation polish to feel right. |
| Mantling / vaulting | M | Modern AAA standard but big anim cost. |
| Climbing | M | Only if level design depends on it. |
| Crouch-only stealth | S | If stealth is a pillar. |
| Prone | M | Niche — usually OUT for indie. |
| Swimming | L | OUT unless it's a pillar. |
| Vehicles (drive-only) | L | OUT for vertical slice. Big effort. |
| Vehicles (combat) | XL | OUT — entire game's worth of work. |
| Grappling hook | M | Defining mechanic if IN. |
| Double-jump / dash | S | Cheap, defining. |
| Headbob / footstep cam | S | IN — adds 50% of "feel" for ~1 day. |

---

## Combat — Shooting

| Feature | Effort | Notes |
|---|---|---|
| Hitscan weapons (instant) | S | Default for most FPS. Cheap. |
| Projectile weapons (bullets travel) | M | Slightly more cost; required for slow projectiles like grenades, rockets. |
| Hitbox damage zones (headshots) | S | Standard. |
| Recoil / spread patterns | M | Tuning-heavy; budget time for iteration. |
| Aim-down-sights (ADS) | S | Standard. |
| Weapon sway | S | Adds feel. |
| Hipfire spread vs ADS accuracy | S | Tuning. |
| Reload animations | S | Per weapon. Multiply by weapon count. |
| Weapon swap (1-2-3 keys) | S | Standard. |
| Quick-melee | S | Standard. |
| Throwables (grenades) | M | Per type. |
| Bullet penetration | M | Only if cover gameplay matters. |
| Ricochet | M | OUT unless defining. |
| Bullet-time / slo-mo | L | Defining mechanic. Big animation/audio cost. |
| Akimbo / dual wield | M | OUT for vertical slice unless defining. |
| Weapon attachments (scopes, mags, etc.) | L | LATER — feature creep magnet. |
| Weapon customization (paint, skins) | M | LATER. Cosmetic monetization tie-in. |
| Weapon levelling / XP | M | LATER. |

---

## Combat — Abilities (GAS-driven)

| Feature | Effort | Notes |
|---|---|---|
| Cooldown abilities (Q/E keys) | M | Per ability. GAS makes this clean. |
| Resource ability (mana, energy, charges) | M | Per ability. |
| Passive abilities (always-on bonuses) | S | Cheap via GameplayEffect. |
| Ultimate / signature ability | M | Per character if multiple. |
| Active reload (gear of war) | S | Cheap if you have one weapon to start. |
| Healing / regen | S | Standard. |
| Shields (regenerating overshield) | S | Standard. |
| Stealth / cloaking | M | Material work + audio cues. |
| Dash / blink / teleport | M | Per ability. |

---

## Enemies / AI

| Feature | Effort | Notes |
|---|---|---|
| 1 enemy archetype (e.g. grunt) | M | Required for vertical slice. |
| 2 enemy archetypes | L | OK for vertical slice if simple. |
| 3+ enemy archetypes | XL | LATER. Each is significant work. |
| Boss encounter | L | One boss is achievable in vertical slice if you cut elsewhere. |
| Patrol / waypoint AI | S | Behavior Tree standard. |
| Cover-using AI | L | Reactive cover is expensive. |
| Squad AI / coordination | XL | OUT for vertical slice. |
| Dynamic spawning (encounter director) | M | Worth IN if pacing matters. |
| Stealth detection (vision/hearing cones) | M | Needed if stealth is a pillar. |
| Civilian / non-combatant NPCs | M | LATER unless narrative requires. |

---

## Levels / Worldbuilding

| Feature | Effort | Notes |
|---|---|---|
| 1 hand-crafted level | L | Required for vertical slice. ≈ 6-10 weeks for 2-min playable level. |
| 2-3 levels | XL | LATER. |
| Level streaming (sublevels) | M | IN if level is large enough to need it. |
| World Partition (open world) | XL | OUT unless it's the entire game's pitch. |
| Procedural generation | XL | OUT — multi-month feature. |
| Interactive props (doors, levers, hackable terminals) | M | IN if the design needs it. |
| Destructible environment (Chaos) | L | LATER. Cool but expensive. |
| Day/night cycle | M | LATER unless it shapes gameplay. |
| Weather systems | L | OUT for vertical slice. |
| Physics objects (kickable, throwable) | S | Standard, cheap. |
| Audio occlusion / reverb zones | M | IN if audio is a pillar. |

---

## UI / UX

| Feature | Effort | Notes |
|---|---|---|
| Crosshair + hit markers | S | IN. |
| Ammo counter | S | IN. |
| Health / shield HUD | S | IN. |
| Minimap | M | OUT unless level needs it. |
| Objective markers | S | IN. |
| Damage indicators (directional) | S | IN. |
| Compass | S | OUT for small levels. |
| Inventory screen | M | Only if loot/items matter. |
| Skill tree / progression UI | L | LATER. |
| Settings menu (full) | M | IN — but use Lyra's as the template. |
| Main menu | M | IN. |
| Pause menu | S | IN. |
| Death screen | S | IN. |
| Mission start / end screens | S | IN. |
| Accessibility options (colorblind, subtitles, etc.) | M | LATER but plan for it. |
| Localization framework | M | LATER. Hook it now if international launch matters. |
| Controller glyphs (Xbox/PS5/Switch) | M | IN if controller support is real. |
| Input remapping UI | M | LATER. Lyra has one — adapt it. |

---

## Audio

| Feature | Effort | Notes |
|---|---|---|
| Weapon SFX (per weapon) | M | IN — every weapon needs at least fire, reload, equip. |
| Footstep SFX (per surface) | M | IN — sells movement feel. |
| Ambient soundscape (per level) | M | IN if audio is a pillar. |
| Music — combat/exploration states | M | IN — Wwise State or MetaSound state graph. |
| Music — dynamic intensity layers | L | LATER. |
| Voice acting | M-XL | LATER unless narrative-driven. Recording + processing is significant. |
| Subtitles + closed captions | M | LATER but plan. |
| 3D spatial audio | M | IN — use UE5 built-in or Wwise spatial. |

---

## Save / Load / Progression

| Feature | Effort | Notes |
|---|---|---|
| Checkpoint auto-save | S | IN. |
| Manual save (slot system) | M | LATER unless required by genre. |
| Save/load full game state | L | LATER — design save schema early to avoid pain. |
| Run-based persistence (roguelite) | M | Defining if IN. |
| Cloud save (Steam Cloud) | S | LATER — flip a switch in Steamworks. |

---

## Multiplayer / Networking

| Feature | Effort | Notes |
|---|---|---|
| **Anything multiplayer in vertical slice** | XL | Strong default OUT. Multiplayer = entire game project's worth of work on top of the game. |
| Listen-server co-op | L | LATER. |
| Dedicated server | XL | LATER. Needs ops + matchmaking. |
| Matchmaking | XL | LATER. EOS / Steam matchmaking. |
| Cross-platform play | XL | LATER. EOS. |
| Replay system | L | LATER. |
| Voice chat | M | LATER. EOS / Steam voice. |

---

## Monetization (in-game microtransactions)

| Feature | Effort | Notes |
|---|---|---|
| Cosmetic skins (weapons) | M | LATER. Plan in `STORE_DESIGN.md`. |
| Cosmetic skins (characters) | M | LATER. |
| Soft currency (earned in-game) | M | LATER. |
| Hard currency (purchased) | M | LATER. Requires Steam IAP / EOS Ecom + server-side validation. |
| Battle pass | XL | OUT for vertical slice. |
| Loot boxes | L | Generally avoid — legal risk + reputation. |
| DLC packs | L | LATER. Steam depot system. |

---

## Online services / platform

| Feature | Effort | Notes |
|---|---|---|
| Steam achievements | S | LATER. Trivial via Steamworks. |
| Steam leaderboards | S | LATER. |
| Steam workshop (mod support) | L | LATER. |
| EOS auth | M | LATER unless cross-platform. |
| EOS Ecom (microtransactions) | L | LATER. |
| Analytics (GameAnalytics, Unity, custom) | M | IN if you want telemetry from playtests. |
| Crash reporting (Sentry, BugSplat, built-in CRC) | S | IN — set up day 1. |

---

## Polish / Game Feel

| Feature | Effort | Notes |
|---|---|---|
| Hitstop / freeze frames on impact | S | IN — huge feel boost for cheap. |
| Screen shake on impact | S | IN. |
| Controller rumble | S | IN if controller is primary. |
| Camera FOV scaling (sprint, ADS) | S | IN. |
| Motion blur | S | IN (toggleable). |
| Chromatic aberration / film grain | S | Optional. |
| Speedlines / damage vignette | S | Cheap polish. |
| Bullet impact decals | S | IN. |
| Blood / damage particles | S | IN — tune to aesthetic. |
| Bullet shell ejection | S | Cheap polish. |
| Casing physics | S | Cheap polish. |
| Reactive ragdolls | M | LATER. Animation-blended is cheaper. |

---

## Effort summary cheat sheet

Default IN list for a tight vertical slice:
1. **Movement** — walk/run/jump/crouch + 1 signature mechanic (sprint, slide, dash, OR grapple)
2. **Combat** — 2 weapons (1 hitscan, 1 projectile/throwable), ADS, recoil, reload
3. **One ability** (Q-key cooldown via GAS) — sells the GAS plumbing
4. **One enemy archetype** + simple BT
5. **One level** with one encounter director triggering 2-3 waves + 1 mini-boss

Everything else: LATER or OUT. Resist the urge to add a sixth.
