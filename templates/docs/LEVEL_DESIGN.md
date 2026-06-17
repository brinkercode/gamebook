# Level Design

> Level inventory, encounter structure, streaming setup, and blockout conventions for {{PROJECT_NAME}}.

## Level Inventory

| Level name | Type | Status | Notes |
|---|---|---|---|
| `LT_MainMenu` | Persistent | _(planned/blocked/done)_ | Menu backdrop only |
| `LT_Tutorial` | Persistent | _(planned/blocked/done)_ | _(description)_ |
| `LT_Act1_Hub` | Persistent | _(planned/blocked/done)_ | _(description)_ |
| `LT_SmokeCook` | Test | _(done)_ | Minimal cook validation map |

Streaming levels use prefix `LT_` and live in `Content/Levels/Streaming/`.

## Encounter Structure

Each combat encounter follows this pattern:
1. **Setup trigger** — `ATriggerBox` or `ALevelSequenceActor` fires the encounter start.
2. **Director call** — BP calls `UEncounterDirectorSubsystem::BeginEncounter(FName EncounterId)`.
3. **Spawn phase** — director reads `DT_Encounters` row for spawn groups + budget.
4. **Victory condition** — director evaluates `EEncounterVictory` (AllEnemiesDead / ObjectiveComplete / TimeSurvived).
5. **Reward phase** — Blueprint event `OnEncounterComplete` fires on owning actor.

## Blockout Conventions

- All geometry uses `SM_Blockout_*` materials (solid color, no textures) until art pass.
- Player-traversable ledges: ≥ 50 cm wide, ≤ 45° slope.
- Cover: waist-high (80–110 cm) for crouch cover; shoulder-high (130–160 cm) for stand cover.
- Sightlines: measure at `P_SightlineDebug` Niagara emitter — max 40 m for snipers, 20 m for standard enemies.
- Nav mesh bounds volume covers all traversable areas. Rebuild after every blockout change: `Build > Navigation Only`.

## Level Streaming

- `ALevelStreamingVolume` controls load/unload for `LT_*` streaming levels.
- Never call `LoadStreamLevel` directly from Blueprint — route through `UWorldSubsystem::RequestStreamLevel`.
- Always set `bShouldBeLoaded` and `bShouldBeVisible` via the streaming request, not level Blueprint.

## Set Dressing Guidelines

- Primary asset source: Quixel Megascans. Import via Bridge; apply auto-LOD on import.
- Scatter placement: `UInstancedStaticMeshComponent` for repeat props (rocks, debris, foliage).
- Lighting: baked with Lightmass until post-vertical-slice Lumen evaluation. Movable lights for VFX only.
- Decals: `MD_Decal_*` materials. Max 4 overlapping decals per surface (perf budget).

## AI Placement

- Enemy spawn points: `ATargetPoint` with tag `SpawnPoint.Enemy.<Type>`.
- Patrol routes: `ASplineActor` with component tag `PatrolRoute`.
- Cover nodes: EQS-generated at runtime — no manual placement needed.

## Encounter Data Table

`DT_Encounters` (Data Table, row struct `FEncounterRow`) lives in `Content/Data/Tables/`.
Designers edit this directly — no C++ recompile needed.

| Column | Type | Notes |
|---|---|---|
| `EncounterId` | `FName` | Primary key — matches BP call |
| `SpawnGroups` | `TArray<FSpawnGroup>` | Each group: enemy type + count + delay |
| `EnemyBudget` | `int32` | Max simultaneous enemies |
| `VictoryCondition` | `EEncounterVictory` | Enum |
| `TimeLimit` | `float` | 0 = no limit |
