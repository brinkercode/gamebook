# Art Direction

> Visual style, asset conventions, and pipeline for {{PROJECT_NAME}}.

## Visual Style

_(1 paragraph: mood, references, adjectives — e.g., "gritty military realism, desaturated palette, high contrast shadows")_

## Reference Images

_(link to Figma board, Miro, or Google Drive folder)_

## Color Palette

| Role | Hex / Description | Use |
|---|---|---|
| Dominant | _(color)_ | Environment base |
| Accent 1 | _(color)_ | Player team / friendly |
| Accent 2 | _(color)_ | Enemy / threat |
| UI highlight | _(color)_ | HUD active elements |
| Neutral | _(color)_ | Secondary surfaces |

## Lighting Approach

- Renderer: Nanite OFF, Lumen OFF for vertical slice (GTX 1060 target). Traditional LODs + baked Lightmass.
- Primary light direction: _(describe sun angle / time of day)_
- Ambient: `BP_SkyAtmosphere` + `BP_SkyLight` (stationary). No movable directional lights in game levels.
- VFX lighting: movable point/spot lights on `NS_*` Niagara emitters only — budget max 3 simultaneous.

## Character Art

- Protagonist: _(poly budget, LOD counts, skeleton rig name)_
- Enemy archetypes: _(list with poly budgets)_
- Rigging: UE5 Mannequin-compatible skeleton required for all humanoids.
- Cloth / hair: _(groom / cloth sim on/off per character)_

## Environment Art

- Hero assets: in-house or commissioned.
- Background / filler: Quixel Megascans. Import via Bridge → apply auto-LOD.
- Modular kit: `SM_Env_<KitName>_*` — grid-snapped to 100 cm.
- LOD strategy: LOD0 in-editor, LOD1–3 auto-generated. Screen size thresholds in `DefaultEngine.ini`.

## Materials

- Master materials: `M_Master_Opaque`, `M_Master_Translucent`, `M_Master_Decal`.
- Instances: `MI_<Asset>_<Variant>` — all tuning via Material Instances, never duplicate masters.
- Material functions in `Content/Core/Materials/Functions/` — reuse, never inline.

## Asset Naming Conventions

| Prefix | Type |
|---|---|
| `SM_` | Static Mesh |
| `SK_` | Skeletal Mesh |
| `T_` | Texture |
| `M_` | Material |
| `MI_` | Material Instance |
| `MF_` | Material Function |
| `NS_` | Niagara System |
| `NE_` | Niagara Emitter |

See full table in gamebook `CLAUDE.md`.

## VFX (Niagara)

- All gameplay VFX in `Content/VFX/`.
- Spawn from C++ via `UNiagaraFunctionLibrary::SpawnSystemAtLocation` — never Blueprint direct attach in gameplay code.
- Budget: max 200 GPU particles per emitter. Cull distance set in Niagara System properties.

## UI / HUD Art

- Style guide: _(populate from brand interview or Figma)_
- Font family: _(name + import path)_
- Icon style: _(flat / skeuomorphic / outline)_
- HUD safe zone: respect `USafeZone` UMG widget — all elements inside safe zone bounds.
