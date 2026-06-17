# Level Structure and Naming Convention

## Directory Layout

```
Content/Levels/
├── L_MainMenu.umap                    -- main menu level
├── L_<GameMap>.umap                   -- persistent level (thin shell, no gameplay content)
└── Sub/
    ├── <GameMap>_Zone_Entry.umap      -- entry corridor
    ├── <GameMap>_Zone_Combat01.umap   -- first combat arena
    ├── <GameMap>_Zone_Combat02.umap
    ├── <GameMap>_Zone_Hub.umap        -- hub/safe zone
    └── <GameMap>_Zone_Boss.umap       -- boss arena
```

## Persistent Level Contents

The persistent level (`L_<GameMap>.umap`) contains only:
- `AWorldSettings` (game mode, lighting settings)
- `ASkyAtmosphere` and `ADirectionalLight` (if exterior)
- `APlayerStart` actors
- `ALevelStreamingVolume` actors (the triggers)
- `ABP_GameMode_<GameMap>` (game mode specific to this map)
- NavMesh bounds volume (spans entire playable area)
- `APostProcessVolume` (global settings, unbound)

**No** static mesh geometry, no enemies, no interactive actors — those all go in sub-levels.

## Sub-Level Contents

Each sub-level contains:
- Static mesh environment (geometry, props)
- Enemy spawn points (`BP_EnemySpawnPoint`)
- Interactive actors, pickups
- Sub-level-specific lighting (point/spot lights, sky light overrides)
- Local `APostProcessVolume` (bounded, for zone-specific look)
- Navmesh data (auto-generated from geometry in this level)

## Sub-Level Streaming Method

In the Levels panel, set each sub-level's **Streaming Method** to `Blueprint`. This gives C++ or Blueprint full control over when the level loads and unloads — no automatic triggers unless explicitly placed.

## World Settings

In `L_<GameMap>_Persistent`:
- Enable `bStreamingHandledByGameMode = true` (custom flag on `AMyGameMode`)
- This prevents clients from individually triggering streaming — server game mode is authoritative

## Level Transitions

For a level transition with loading screen:
1. Show `WB_LoadingScreen` widget (full screen, covers transition)
2. Call `UGameplayStatics::LoadStreamLevel(this, LevelName, true, true, FLatentActionInfo())`
3. On load complete delegate: hide `WB_LoadingScreen`, teleport player
