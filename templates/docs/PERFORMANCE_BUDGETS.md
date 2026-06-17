# Performance Budgets

> Hard targets and per-system budgets for {{PROJECT_NAME}}.
> Baseline: 60 FPS on GTX 1060 / equivalent console hardware. Nanite OFF, Lumen OFF for vertical slice.

## Frame Budget (16.6 ms at 60 FPS)

| Thread | Budget | Notes |
|---|---|---|
| Game thread | ≤ 8 ms | AI ticks, GAS evaluation, Blueprint |
| Render thread | ≤ 8 ms | Draw calls, material complexity |
| GPU | ≤ 16.6 ms | Total GPU frame |

Measure with `stat unit` and `stat game` in-editor. Profile before every milestone build.

## Draw Call Budget

| Context | Max draw calls | Notes |
|---|---|---|
| Gameplay (mid-encounter) | 1 500 | Desktop target |
| Gameplay (console) | 800 | PS5 / Xbox Series |
| Menu / lobby | 400 | |

Use `UInstancedStaticMeshComponent` and `HierarchicalInstancedStaticMeshComponent` (HISMC) for repeated props.

## Triangle Budget

| LOD | Distance | Max triangles |
|---|---|---|
| LOD0 | 0–5 m | 50 000 |
| LOD1 | 5–15 m | 15 000 |
| LOD2 | 15–40 m | 5 000 |
| LOD3 | 40+ m | 1 500 |

Hero character (LOD0): max 80 000 triangles. Enemies: max 40 000.

## Texture Budget

- Max texture resolution: 2048×2048 (hero assets), 1024×1024 (environment filler).
- Streaming pool: 1 500 MB (set in `DefaultEngine.ini` → `r.Streaming.PoolSize`).
- Compress all textures: BC7 (color), BC5 (normal), BC4 (single channel mask).

## Audio Voices

| Category | Max simultaneous |
|---|---|
| Total voices | 64 |
| Weapons | 16 |
| Ambient loops | 8 |
| VO | 4 |
| UI | 8 |

## Memory Budget

| Category | Budget | Notes |
|---|---|---|
| Total RAM | 4 GB | GTX 1060 system target |
| VRAM | 3 GB | GTX 1060 VRAM |
| Blueprint VM overhead | < 50 MB | Profile with `MemReport -full` |

## AI Budget

- Max simultaneous AI characters: 12 (managed by `UEncounterDirectorSubsystem`).
- Tick interval: full-rate within 30 m; 500 ms interval beyond.
- EQS queries: max 2 simultaneous per frame. Queue extras.

## Niagara Budget

| System type | Max simultaneous | Max GPU particles |
|---|---|---|
| Weapon impact | 8 | 200 per emitter |
| Environmental (fire, smoke) | 4 | 500 per emitter |
| Ability VFX | 4 | 300 per emitter |

## Network Budget (if multiplayer)

- Max bandwidth per client: 20 KB/s outbound.
- Replication rate: `NetUpdateFrequency = 20` for characters, `5` for non-critical actors.
- Replication Graph: enabled for > 8 players. See `UGameReplicationGraphNode_*`.

## Profiling Commands

```
stat unit           # Frame / game / render / GPU time
stat game           # Game thread breakdown
stat fps            # FPS counter
profilegpu          # One-frame GPU capture (open in RenderDoc / Unreal GPU Visualizer)
memreport -full     # Full memory allocation report
recompileshaders    # Force shader recompile after material changes
```
