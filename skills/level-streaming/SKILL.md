---
name: level-streaming
description: Use when adding sub-levels, async level loading, or gameplay-driven streaming volumes to a UE5 FPS project. Invoke when the user says "add level streaming", "split the level into sub-levels", "load a level async", or "create a streaming volume".
version: "1.0.0"
---

# Level Streaming

> Sets up sub-level structure, async load/unload via Blueprint or C++, and `ALevelStreamingVolume` triggers. Designed for the standard `Content/Levels/` layout with one persistent level and N sub-levels.

## When to use

Invoke when a single monolithic level needs to be split, or when new content areas need to load without a loading screen. For multiplayer, confirm sub-levels are server-authoritative (streaming is controlled by the server's game mode, not clients). For World Partition (large open worlds), use the World Partition system instead — this skill covers the traditional sub-level streaming approach suitable for corridor/arena FPS games.

## How it works

1. **Structure** — read `resources/level-structure.md`; set up persistent level + sub-level naming convention.
2. **Add sub-level** — in the Levels panel: Window → Levels → Add Existing; set streaming method to `Blueprint` (not Always Loaded or Streaming Volume unless specified).
3. **C++ async load** — implement `ULevelStreamingSubsystem` per `resources/streaming-subsystem.md`; expose `LoadLevel` / `UnloadLevel` Blueprint-callable functions.
4. **Volume triggers** — place `ALevelStreamingVolume` actors per `resources/streaming-volumes.md` for automatic load/unload on player proximity.
5. **Loading screen** — show `WB_LoadingScreen` widget while async load is in progress per `resources/loading-screen.md`.
6. **Verify** — walk through the trigger volume in PIE; confirm sub-level loads without hitch; stat unit shows no frame drops > 16ms during load.

## Resources (read on demand)

- `resources/level-structure.md` — naming convention, directory layout, persistent level setup.
- `resources/streaming-subsystem.md` — `ULevelStreamingSubsystem` C++ implementation.
- `resources/streaming-volumes.md` — `ALevelStreamingVolume` placement and configuration.
- `resources/loading-screen.md` — async loading screen widget pattern.

## Success Criteria

- [ ] Sub-level loads asynchronously (no blocking load on game thread)
- [ ] `WB_LoadingScreen` shown during long loads (> 100ms estimated)
- [ ] Sub-level unloads when player leaves the trigger volume (no memory leak)
- [ ] No nav mesh holes at sub-level boundaries (verify with `Show Navigation` in editor)
- [ ] Lighting is consistent across streaming boundaries (use same directional light in all sub-levels or single sky in persistent level)
- [ ] Multiplayer: streaming controlled by server game mode, not client

## What to Commit

```
Content/Levels/L_<Map>_Persistent.umap
Content/Levels/Sub/<Map>_<Zone>.umap
Source/<Project>/Systems/LevelStreamingSubsystem.h
Source/<Project>/Systems/LevelStreamingSubsystem.cpp
Content/UI/WB_LoadingScreen.uasset     (if not already present)
```
