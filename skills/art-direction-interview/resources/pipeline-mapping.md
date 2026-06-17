# Art Decisions → UE5 Pipeline Implications

Read at step 4.

---

## Rendering mode

| Choice | Setting | Notes |
|---|---|---|
| Baked lighting (default) | `DefaultEngine.ini`: `r.DynamicGlobalIlluminationMethod=0` | Best perf on GTX 1060; use Lightmass for interiors, Sky Atmosphere + directional for exteriors |
| Lumen (opt-in) | `r.DynamicGlobalIlluminationMethod=1` | Requires DX12/Vulkan; ~30% GPU overhead; revisit post-vertical-slice |
| Nanite (opt-in) | `r.Nanite=1` | Requires DX12; high poly Megascans rocks at zero perf cost; still needs LODs for foliage/characters |

Default for vertical slice: both off. If user explicitly chooses Lumen/Nanite, add a performance-risk note to `docs/ART_DIRECTION.md`.

---

## Material complexity tier

| Style | Tier | Master Material setup |
|---|---|---|
| Hyper-realistic | High | Five-layer blend material; parallax occlusion mapping; detail normal overlay |
| Stylized-realistic | Medium | Three-layer blend; stylized normal intensity; rim light pass |
| Cel-shaded | Low-medium | Custom shading model or post-process outline; flat diffuse + strong normal bake |
| Painterly | Medium | High-frequency albedo with suppressed specularity; brush-stroke normal map |

---

## Megascans filter tags

Based on dominant surfaces answer:

| Surface type | Megascans search tags |
|---|---|
| Stone / rock | `rock`, `stone`, `cliff`, `gravel` |
| Concrete / industrial | `concrete`, `asphalt`, `plaster`, `metal` |
| Wood / organic | `wood`, `bark`, `moss`, `soil` |
| Sci-fi / manufactured | `metal`, `plastic`, `ceramic`, `carbon fiber` |

Download Surface + Decal + Atlas packs for the top two tags. Import via Bridge → UE5 direct link.

---

## LOD strategy (Nanite off)

- Static meshes: LOD0 (full), LOD1 (50%), LOD2 (25%), LOD3 (10%) — UE5 auto-generates from import dialog
- Skeletal meshes: hand-craft LOD1 and LOD2 (auto-LOD on skeletons is poor quality)
- Foliage: use `UHierarchicalInstancedStaticMeshComponent` with screen-size thresholds; cull at 3000 UU

---

## Palette → Material Parameter Collection

Create `M_MPC_GamePalette` (Material Parameter Collection):
- `ColorBackground` (LinearColor)
- `ColorMid` (LinearColor)
- `ColorHighlight` (LinearColor)
- `ColorAccent` (LinearColor)
- `ColorDanger` (LinearColor)
- `ColorNeutral` (LinearColor)

Every master material references this MPC for tint overrides. Changing global palette = one asset change.
