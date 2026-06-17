# Free UE5 Assets Catalog

> Curated list of free assets indie teams should grab on day 1. Sourced from Epic Games Launcher (Marketplace + Permanent Free Collection), Quixel, and reputable external free libraries. Verified as free at time of last update — confirm in the launcher before adding to project.

**Last verified:** 2026-06. Asset availability and licensing terms change; double-check before shipping.

---

## 1. FPS Sample Projects (pick at most one as your starter)

| Asset | Source | What you get | When to pick it |
|---|---|---|---|
| **Lyra Starter Game** | Epic Marketplace (free) | Full modern FPS framework — GAS abilities, Common UI menus, online subsystem, weapon swapping, character animation. Modular and modern. | You want a working FPS to gut and refactor. Best starting point in 2024+. |
| **ShooterGame** | Epic Marketplace (legacy, free) | Older FPS sample — simpler, less GAS, more "vanilla" C++ patterns. | Reference only. Don't ship from this — it's a teaching artifact. |
| **Action RPG Sample** | Epic Marketplace (free) | Third-person but the canonical **GAS reference**. Best resource for understanding ability/effect/attribute patterns. | Read alongside Lyra if you're new to GAS. |

**Recommendation:** Lyra as starter. Read Action RPG for GAS patterns.

---

## 2. Characters (rigged, animated, ready to drop in)

| Asset | Source | Notes |
|---|---|---|
| **Paragon: Character Packs** (~40 characters) | Epic Marketplace (permanently free) | Fully rigged, animated, with VFX/SFX. AAA quality. Different art styles — pick by aesthetic. Heroes: Aurora, Belica, Crunch, Dekker, Drongo, Fey, Gadget, Gideon, Greystone, Grim.exe, Howitzer, Iggy & Scorch, Khaimera, Kwang, Lt Belica, Morigesh, Muriel, Murdock, Narbash, Phase, Rampage, Revenant, Riktor, Sevarog, Shinbi, Sparrow, Steel, Terra, The Fey, TwinBlast, Wraith, Yin, Zinx. |
| **MetaHuman Creator** | Free with Epic ID (in-browser) | Photoreal human creator. Export as MetaHuman Asset for UE5. Best for realistic protagonists/NPCs. |
| **MetaHuman Sample** | Epic Marketplace (free) | Several pre-made MetaHumans + face/body animation samples. |
| **Mixamo** | mixamo.com (free) | Adobe's free character + animation library. ~100 characters, ~2500 animations. Retarget to UE5 skeletons. |
| **DAZ Studio Genesis 8/9** | daz3d.com (free base, paid morphs) | Industry standard character bases. Free Genesis 8/9 starter essentials. Export to UE5 via Diffeomorphic Daz to Blender pipeline. |
| **Quixel Megascans Humans** (limited) | Quixel Bridge (free with Epic ID) | A handful of scanned human/clothing assets. |

**Recommendation:**
- Stylized aesthetic → Paragon characters.
- Realistic protagonist + NPCs → MetaHuman Creator.
- Need lots of cheap enemies → Mixamo.

---

## 3. Environments

| Asset | Source | What you get |
|---|---|---|
| **Quixel Megascans** | Quixel Bridge (free with Epic ID) | 18,000+ photo-scanned assets: meshes, materials, decals, brushes. The single most valuable free resource for UE5. Always say yes. |
| **City Sample** | Epic Marketplace (free) | The Matrix Awakens city — huge urban environment. Heavy. |
| **City Sample Vehicles** | Epic Marketplace (free) | 17 driveable vehicles. |
| **City Sample Crowds** | Epic Marketplace (free) | 1000+ procedural pedestrians. |
| **Electric Dreams Environment** | Epic Marketplace (free) | Forest demo from State of Unreal 2023. Heavy nature scene with Nanite + Lumen. |
| **Valley of the Ancient** | Epic Marketplace (free) | Desert/canyon demo from State of Unreal 2021. Showcases Nanite/Lumen/World Partition. |
| **Soul: City** | Epic Marketplace (free) | Stylized Asian city environment, ~50 modular assets. |
| **Soul: Cave** | Epic Marketplace (free) | Cave environment, modular. |
| **Modular Asian Restaurant** | Epic Marketplace (free) | Single interior, fully dressed. |
| **Modular Building Set: Industrial Apocalypse** | Epic Marketplace (free) | Modular industrial pieces. |
| **Old Garage** | Epic Marketplace (free) | Single interior, well-detailed. |
| **Bunker** | Epic Marketplace (free) | Underground bunker environment. |
| **Showdown VR Demo** | Epic Marketplace (free) | Sci-fi battlefield diorama. |
| **Stylized Egypt** | Epic Marketplace (free) | Hand-painted Egyptian environment. |
| **Stack O Bot** | Epic Marketplace (free) | Stylized platformer environment + bot character + gameplay sample. |

**Recommendation:** Megascans always. Then pick 1–2 of the above that match the aesthetic paragraph. Don't grab all of them — disk space matters.

---

## 4. Weapons, Props, Items

| Asset | Source | Notes |
|---|---|---|
| **Infinity Blade: Weapons** | Epic Marketplace (free) | 130+ melee weapons, mostly fantasy. |
| **Infinity Blade: Adversaries** | Epic Marketplace (free) | Enemy character meshes + rigs. |
| **Infinity Blade: Effects** | Epic Marketplace (free) | VFX prefabs (Cascade — old but convertible). |
| **Infinity Blade: Hideout / Fire Lands / Grass Lands / Ice Lands / Plain Lands** | Epic Marketplace (free) | Modular fantasy environments. |
| **Game Animation Sample** | Epic Marketplace (free) | Motion matching sample with locomotion + gunplay animations. |
| **FPS Weapon Bundle** | Epic Marketplace (occasional free promo) | Modern weapon kits. Check current free-of-the-month. |

**Recommendation:** For modern FPS, Lyra weapons are best starting point. Infinity Blade if going fantasy/melee.

---

## 5. VFX (Niagara)

| Asset | Source | Notes |
|---|---|---|
| **Particle Effects Pack** | Epic Marketplace (free) | 80+ particle systems. Cascade-era; some need Niagara port. |
| **Niagara Fluids Plugin** | Bundled with UE5 | Fluid sim — fire, smoke, liquid. Free, in-engine. |
| **VFX Tutorial Samples** | Epic Marketplace (free, various) | Search "Niagara" in Marketplace. Several free educational packs. |

**Recommendation:** Start with Niagara built-in templates (New Niagara System → from Template). Free Marketplace packs are mostly Cascade-era.

---

## 6. Animation

| Asset | Source | Notes |
|---|---|---|
| **Animation Starter Pack** | Epic Marketplace (free) | Idle/walk/run/jump/death — basic locomotion suite. Mannequin-compatible. |
| **Game Animation Sample** | Epic Marketplace (free) | Motion matching sample. Modern AAA-quality locomotion. |
| **Paragon Animations** (per character) | Bundled with Paragon character packs | Hero-specific anim sets. |
| **Mixamo** | mixamo.com (free) | 2500+ free animations. Auto-rigger included. |

**Recommendation:** Game Animation Sample for modern locomotion. Mixamo for one-offs.

---

## 7. Audio

| Asset | Source | Notes |
|---|---|---|
| **Freesound.org** | freesound.org (CC licensed, free) | 500k+ user-uploaded sounds. Check license per sound (CC0, CC-BY, CC-BY-NC, CC-Sampling). |
| **Pixabay Audio** | pixabay.com/sound-effects (free, royalty-free) | ~30k SFX + music. Pixabay license = free commercial use, no attribution. |
| **YouTube Audio Library** | youtube.com/audiolibrary (free, royalty-free) | Music + SFX. Check per-track license. |
| **Soundly Free Tier** | getsoundly.com (free tier) | 4k free SFX, paid tier has more. |
| **Wwise Free Tier** | audiokinetic.com (free under $200k revenue + first 8000 sound IDs) | Industry-standard audio middleware. |
| **FMOD Free Tier** | fmod.com (free under $200k revenue) | Alternative middleware. Wwise is more common in UE5. |
| **MetaSounds** | Bundled with UE5 (free) | UE5's built-in audio system. No middleware license needed. Sufficient for most indies. |
| **Boom Library Free Pack** | boomlibrary.com (occasional free packs) | Pro-quality SFX. Check site for current freebies. |

**Recommendation:** Default to MetaSounds + Freesound/Pixabay for indie. Wwise if you have a dedicated sound designer who knows it.

---

## 8. UI

| Asset | Source | Notes |
|---|---|---|
| **Common UI Plugin** | Bundled with UE5 (free) | The modern UE5 widget framework. Use this, not vanilla UMG. |
| **Lyra UI** | Bundled with Lyra Starter Game (free) | Production-quality menu stack, settings screen, input glyphs. Best reference for indie. |
| **UI Material Lab** | Epic Marketplace (free, occasional) | Material-based UI effects. |
| **Game UI Database** | gameuidatabase.com (reference only) | Screenshots of shipped game UIs. Reference, don't copy. |

**Recommendation:** Common UI + reference Lyra's menu stack. Don't reinvent the menu system.

---

## 9. AI / Bots

| Asset | Source | Notes |
|---|---|---|
| **AI Sample Project** | Epic Marketplace (free) | Behavior Tree + Blackboard examples. |
| **Stack O Bot** | Epic Marketplace (free) | Includes one simple bot to study. |
| **Action RPG** | Epic Marketplace (free) | Enemy AI using GAS + BT. |
| **EQS (Environment Query System)** | Bundled with UE5 (free) | AI spatial reasoning. Enable in plugin settings. |

---

## 10. Engine Tools (Free / Built-in)

| Tool | Source | Use for |
|---|---|---|
| **Unreal Insights** | Bundled with UE5 | Performance profiling, frame timing, GPU/CPU traces. |
| **Quixel Bridge** | Bundled with UE5 + free Epic account | Browse and import Megascans. |
| **Niagara** | Bundled with UE5 | VFX. |
| **Sequencer** | Bundled with UE5 | Cinematic editor. |
| **Chaos** | Bundled with UE5 | Physics + destruction. |
| **World Partition** | Bundled with UE5 | Large-world streaming. |
| **MetaHuman Creator** | Free (browser) | Realistic character creation. |
| **RenderDoc** | renderdoc.org (free) | GPU frame capture / debug. |
| **PIX (Windows)** | devblogs.microsoft.com/pix (free) | GPU debugging on Windows. |

---

## 11. External (non-Epic) free tools

| Tool | Source | Use for |
|---|---|---|
| **Blender** | blender.org (free, open source) | 3D modeling, rigging, animation. |
| **Quixel Mixer** | quixel.com (free) | Material creation. |
| **Krita** | krita.org (free) | 2D painting, textures, UI art. |
| **GIMP** | gimp.org (free) | 2D editing. |
| **Audacity** | audacityteam.org (free) | Quick audio editing. |
| **DaVinci Resolve** | blackmagicdesign.com (free tier) | Video editing for trailers. |
| **OBS Studio** | obsproject.com (free) | Capture playtest sessions. |
| **HandBrake** | handbrake.fr (free) | Video transcoding for trailers. |

---

## Watch list (paid but cheap)

These aren't free but pay for themselves quickly for indie teams:

- **Rider for Unreal Engine** — $149/yr indie. Massively better than Visual Studio for UE5 C++.
- **Substance Painter** — $20/mo Indie. Industry standard texture painting.
- **Synty Studios POLYGON packs** — $10–40 each. Best low-poly art library. (Some demo packs free.)
- **Marketplace Mega Bundle** sales — Epic runs them quarterly.

---

## Asset onboarding workflow

1. Open Epic Games Launcher → Unreal Engine → Marketplace → "My Library."
2. For each asset on the shopping list: click "Add to Project" → select `{{PROJECT_NAME}}` → wait for the launcher to copy into `Content/<PackName>/`.
3. For Megascans: open editor → Quixel Bridge tab → browse → download to local cache → drag into Content Browser.
4. Run `git add Content/<PackName>` and let LFS pick up the binaries (your `.gitattributes` should cover `.uasset`/`.umap`/`.fbx`/`.png`/`.wav`).
5. Move imported assets into `Content/Marketplace/<PackName>/` — never mix marketplace content with your own. Easier to delete later.
6. Update `docs/PRE_PRODUCTION.md` Asset Shopping List section with checkmarks for what's actually imported.

**Never edit a marketplace asset in place.** Duplicate first (`Cmd/Ctrl+D`), then edit the copy. Keeps future re-imports clean.
