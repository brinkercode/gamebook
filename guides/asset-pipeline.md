# Asset Pipeline — Quixel Megascans, Marketplace, Import, Naming, Git LFS

> All art begins as external source (Quixel Megascans or Marketplace) and lands in the project's Content/ tree under the naming conventions below. No hand-crafted in-house art for the vertical slice. Every binary asset over 100 KB is tracked via Git LFS. This guide covers the full path from Bridge download to committed, named, properly attributed asset.

---

## Source Priority

| Source | When | Cost |
|--------|------|------|
| Quixel Megascans (Bridge) | Terrain, rocks, props, surfaces — photogrammetry assets | Free with UE license |
| Fab / Unreal Marketplace | Character rigs, weapon kits, VFX packs, environment sets | Purchase per asset pack |
| In-house | Absolutely nothing for vertical slice | — |

Megascans and Marketplace assets are the **only** approved art sources until the project passes its vertical-slice milestone. Any in-house art request goes to the lead and is deferred.

---

## Git LFS Setup

All binary asset types must be tracked via Git LFS. Set this up before the first `git commit`.

### .gitattributes

```
# Unreal Engine binary assets
*.uasset filter=lfs diff=lfs merge=lfs -text
*.umap   filter=lfs diff=lfs merge=lfs -text
*.ubulk  filter=lfs diff=lfs merge=lfs -text
*.uptnl  filter=lfs diff=lfs merge=lfs -text
*.uexp   filter=lfs diff=lfs merge=lfs -text

# Textures
*.png  filter=lfs diff=lfs merge=lfs -text
*.tga  filter=lfs diff=lfs merge=lfs -text
*.psd  filter=lfs diff=lfs merge=lfs -text
*.exr  filter=lfs diff=lfs merge=lfs -text
*.hdr  filter=lfs diff=lfs merge=lfs -text

# Audio
*.wav  filter=lfs diff=lfs merge=lfs -text
*.mp3  filter=lfs diff=lfs merge=lfs -text
*.ogg  filter=lfs diff=lfs merge=lfs -text
*.wem  filter=lfs diff=lfs merge=lfs -text

# 3D
*.fbx  filter=lfs diff=lfs merge=lfs -text
*.obj  filter=lfs diff=lfs merge=lfs -text
*.abc  filter=lfs diff=lfs merge=lfs -text

# Video
*.mp4  filter=lfs diff=lfs merge=lfs -text
*.mov  filter=lfs diff=lfs merge=lfs -text

# Packages / archives
*.zip  filter=lfs diff=lfs merge=lfs -text
*.7z   filter=lfs diff=lfs merge=lfs -text
```

```bash
# Initialize LFS in the repo
git lfs install
git lfs track "*.uasset"    # (or add all at once via .gitattributes above)
git add .gitattributes
git commit -m "chore: configure Git LFS for binary assets"
```

Set the LFS server in `.gitconfig` for the project:
```bash
git config lfs.url https://git-lfs.github.com/spec/v1  # or your self-hosted endpoint
```

**LFS storage cost:** Budget ~5 GB/month for a 1–5 dev team at standard GitHub LFS pricing. Use `git lfs ls-files --size` to audit the current footprint monthly.

---

## Naming Conventions

Follow the UE5 community standard prefixes exactly. The Content Browser's filter expects them.

| Prefix | Asset Type | Example |
|--------|-----------|---------|
| `SM_` | Static Mesh | `SM_Rock_Large_01` |
| `SK_` | Skeletal Mesh | `SK_Hero_Body` |
| `T_` | Texture (any) | `T_Rock_D`, `T_Rock_N`, `T_Rock_R` |
| `M_` | Material | `M_Rock_Surface` |
| `MI_` | Material Instance | `MI_Rock_Brown` |
| `MF_` | Material Function | `MF_TriplanarBlend` |
| `S_` | Sound Wave | `S_Footstep_Concrete_01` |
| `Cue_` | Sound Cue | `Cue_Footstep_Concrete` |
| `ABP_` | Anim Blueprint | `ABP_Hero` |
| `A_` | Anim Sequence | `A_Hero_Idle` |
| `NS_` | Niagara System | `NS_MuzzleFlash` |
| `NE_` | Niagara Emitter | `NE_Spark_Burst` |
| `BP_` | Blueprint class | `BP_WeaponRifle` |
| `WB_` | Widget Blueprint | `WB_HUD` |
| `DA_` | Data Asset (Primary) | `DA_Weapon_Rifle_AK47` |
| `DT_` | Data Table | `DT_DamageMultipliers` |
| `E_` | Enum | `E_WeaponType` |
| `LT_` | Level (streaming) | `LT_Zone_Warehouse` |
| `GA_` | Gameplay Ability (BP) | `GA_Sprint` |
| `GE_` | Gameplay Effect (Blueprint) | `GE_DamageBase` |
| `GAS_` | AttributeSet (C++ naming) | `GAS_CombatAttributeSet` |

Texture suffix convention (after base name):
- `_D` = Diffuse/Albedo
- `_N` = Normal map
- `_R` = Roughness
- `_M` = Metallic
- `_AO` = Ambient Occlusion
- `_E` = Emissive
- `_ORM` = Occlusion/Roughness/Metallic packed

---

## Content Folder Layout

```
Content/
├── Core/                       # Engine defaults, base materials, global data
│   ├── GAS/
│   │   ├── Abilities/          # GA_ Blueprint assets
│   │   ├── Effects/            # GE_ Blueprint assets
│   │   ├── Cues/               # GameplayCue Notifies
│   │   └── AttributeSets/      # GAS_ (C++ only, no Blueprint subclassing here)
│   ├── Materials/
│   │   ├── Master/             # M_ master materials
│   │   └── Functions/          # MF_ material functions
│   └── Data/
│       ├── DA_/                # Primary Data Assets
│       └── DT_/                # Data Tables
├── Characters/
│   ├── Hero/
│   │   ├── Meshes/             # SK_Hero, SM_Hero_accessories
│   │   ├── Animations/         # A_Hero_Idle, ABP_Hero
│   │   └── Materials/          # MI_Hero_Skin_01
│   └── Enemies/
│       └── Grunt/
│           ├── Meshes/
│           ├── Animations/
│           └── Materials/
├── Weapons/
│   └── Rifle/
│       ├── Meshes/             # SM_Rifle_Body, SK_Rifle_Animated
│       ├── Animations/
│       ├── Materials/
│       └── VFX/                # NS_MuzzleFlash, NS_EjectedCasing
├── Levels/
│   ├── Maps/                   # Persistent maps
│   └── Streaming/              # LT_ streaming sub-levels
├── UI/
│   ├── HUD/
│   ├── Menus/
│   ├── Modals/
│   ├── Shared/
│   └── Styles/
├── VFX/
│   ├── Combat/                 # NS_BloodSplat, NS_ExplosionSmoke
│   ├── Environment/            # NS_DustCloud, NS_WaterSplash
│   └── UI/                     # NS_MenuTransition
├── Audio/
│   ├── SFX/                    # S_ (imported), Cue_ (Sound Cues)
│   ├── Music/                  # S_ music stems
│   └── Wwise/                  # Wwise work unit folders (auto-managed)
├── Environment/
│   ├── Megascans/              # Drop Bridge assets here — folder auto-named by Bridge
│   │   ├── Rocks/
│   │   ├── Ground/
│   │   └── Props/
│   └── Props/                  # Marketplace props
└── Blueprints/
    └── Gameplay/               # BP_ actor classes that don't fit the above
```

Never put assets in Content root or in temporary folders (`Content/Test/`, `Content/Temp/`). Temp files must be in a branch-only working folder that is `.gitignore`d.

---

## Quixel Megascans — Bridge Workflow

1. Open **Quixel Bridge** inside the Unreal Editor (Window → Quixel Bridge).
2. Search and filter for the surface or prop needed.
3. Set quality: **High** for hero/foreground assets; **Medium** for background fill.
4. Click **Add to Project** — Bridge places assets in `Content/Megascans/` with its own subfolder naming.
5. After import, **move and rename** according to the content layout above. Bridge names assets with its own UUID scheme; rename them before committing.
   ```
   Bridge output:  Content/Megascans/Natural/Rock/uhsejabq_Rock/
   Rename to:      Content/Environment/Megascans/Rocks/SM_Rock_Large_01
                   Content/Environment/Megascans/Rocks/T_Rock_Large_D_01
                   Content/Environment/Megascans/Rocks/T_Rock_Large_N_01
                   Content/Environment/Megascans/Rocks/M_Rock_Large
   ```
6. Commit the renamed assets with LFS: `git add Content/Environment/Megascans/Rocks/ && git commit`.

---

## Marketplace Assets — Import Workflow

1. Download from Fab / Marketplace to the Vault.
2. In the Launcher, click **Add to Project** → select this project.
3. UE copies assets to `Content/<PackageName>/`.
4. Move assets to the correct Content subfolder using the **Content Browser** (right-click → Move Here). Always move inside the editor, not via OS file copy — moving in the editor updates redirect links.
5. Rename to match conventions (prefix, no spaces, `_01` suffix for first variant).
6. Delete the original Marketplace folder (`Content/<PackageName>/`) if emptied.
7. Commit.

**Marketplace attribution:** Keep a `Content/Licenses/MARKETPLACE_LICENSES.md` listing every purchased pack with asset pack name, purchase date, and Fab product ID. Required for IP audit before commercial launch.

---

## Texture Import Settings

For all Megascans imports, verify these settings in the Texture Editor before committing:

| Texture type | Compression | sRGB | Mip Gen |
|-------------|-------------|------|---------|
| Albedo (`_D`) | BC7 | On | Default |
| Normal (`_N`) | BC5 | Off | Default |
| Roughness/ORM | BC4 / BC7 | Off | Default |
| Emissive (`_E`) | BC6H (HDR) | Off | Default |
| UI textures | BC7 | On | NoMipmaps |
| Heightmaps | G16 | Off | NoMipmaps |

Wrong compression on normals or ORM textures causes visible quality regressions. Set before first commit.

---

## Automated Asset Audit

Run the built-in reference viewer before shipping to catch orphaned assets:

```bash
# In editor commandlet: list all unreferenced assets in Content/
"$(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(PROJECT_UPROJECT)" \
    -run=ResavePackages -verify -NORENDER -unattended -log \
    2>&1 | grep "Unreferenced"
```

Also check LFS budget monthly:
```bash
git lfs ls-files --size | sort -rh | head -20
```

---

## Key Rules

1. **Megascans and Marketplace only** — no in-house art for the vertical slice.
2. **Git LFS for all binary assets** — `.gitattributes` committed before any asset.
3. **Rename before committing** — Bridge and Marketplace use opaque IDs; rename to the convention inside the editor, not via OS.
4. **Move inside the editor** — OS-level file moves break redirectors. Use Content Browser → Move Here.
5. **One folder per concern** — `Characters/Hero/`, not `Characters/HeroAssets/Random/`.
6. **Texture compression before commit** — wrong settings on normals cost quality budget permanently once committed.
7. **MARKETPLACE_LICENSES.md maintained** — required for commercial launch IP audit.
8. **LFS budget audit monthly** — `git lfs ls-files --size`. Over 5 GB/month triggers a team conversation about asset pruning.
