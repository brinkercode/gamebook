# Performance Budgets

> 60 FPS target on GTX 1060 / PS5-equivalent for the vertical slice. Hard numbers, Stat commands to measure them, and how to investigate when you miss them.

---

## Frame Budget Overview

**Target:** 16.6ms per frame (60 FPS).
**Hard floor:** 33.3ms (30 FPS) is never acceptable during the vertical slice.
**Nanite/Lumen:** Off by default. Traditional LODs + baked lighting until post-vertical-slice.

| Budget Slice | Allocation | Notes |
|---|---|---|
| Total frame | 16.6 ms | Wall-clock at 60 FPS |
| CPU game thread | ≤ 6.0 ms | Gameplay, GAS, AI, physics tick |
| CPU render thread | ≤ 6.0 ms | Draw call submission, culling |
| GPU | ≤ 12.0 ms | Actual rendering work |
| Overhead / margin | ~2.6 ms | OS, driver, sync |

Game thread and render thread run in parallel. The critical path is whichever is longer — aim to keep both under 6ms so the GPU is the bottleneck.

---

## Platform Targets

| Platform | GPU | RAM | Target FPS | Frame Budget |
|----------|-----|-----|-----------|--------------|
| PC Low (minimum) | GTX 1060 6GB | 8 GB system | 60 FPS @ 1080p | 16.6ms GPU |
| PC Recommended | RTX 3070 | 16 GB | 60 FPS @ 1440p | 16.6ms GPU |
| Console (PS5 / Series X) | ~RDNA2 12 TF | 16 GB unified | 60 FPS @ 4K (or 1440p+RT) | 16.6ms GPU |
| Steam Deck (stretch) | RDNA2 1.6 TF | 16 GB unified | 30 FPS @ 720p | 33.3ms GPU |

All development profiling is done against the GTX 1060 budget. Anything that passes GTX 1060 will pass PS5.

---

## Draw Call and Triangle Budgets

| Category | Budget |
|----------|--------|
| Total draw calls per frame | ≤ 1,500 |
| Translucent draw calls | ≤ 150 |
| Shadow casting meshes on screen | ≤ 200 |
| Character skeletal mesh triangles | ≤ 80,000 (hero), ≤ 50,000 (enemy) |
| Weapon mesh triangles (first-person) | ≤ 40,000 |
| Environment static mesh triangle total (visible) | ≤ 1,500,000 |
| Niagara particle GPU count | ≤ 100,000 per system |
| Active Niagara systems in viewport | ≤ 20 |
| Dynamic shadow casting lights | ≤ 4 |
| Overlapping translucent layers (overdraw) | ≤ 3 |

These are per-frame in a live combat scenario (worst case), not in a loading screen.

---

## Memory Budgets

| Category | PC Minimum (GTX 1060) | Console (PS5) |
|----------|----------------------|---------------|
| Total VRAM in use | ≤ 4.5 GB | ≤ 6.5 GB |
| Streamed texture pool | ≤ 2.5 GB | ≤ 4.0 GB |
| Static mesh pool | ≤ 500 MB | ≤ 1.0 GB |
| Animation assets (resident) | ≤ 300 MB | ≤ 500 MB |
| Audio (loaded) | ≤ 300 MB | ≤ 400 MB |
| UObject count per level | ≤ 15,000 | ≤ 20,000 |
| System RAM (total process) | ≤ 6 GB | ≤ 10 GB |

Wwise banks for a level must be sized and audited before milestone delivery. A single uncompressed cinematic music track can blow the audio budget alone.

---

## Level Streaming Rules

- Max objects in a persistent level: 500. Everything else in sublevels streamed by `ULevelStreamingDynamic` or World Partition cells.
- No static meshes with > 250k triangles that aren't LOD'd to at least 3 levels.
- LOD distances: LOD0 to LOD1 transition at 10m. LOD1 to LOD2 at 40m. LOD2 to culled at 100m. Override per-asset for hero props.
- Lightmaps: 512×512 max per architectural mesh. 128×128 for props. Use `Lightmap Resolution` = 0 for small decorative objects and let them receive from volume lighting.

---

## Stat Commands (know these cold)

### Immediate on-screen diagnostics

```
stat fps              — Frame rate and frame time (ms) on screen
stat unit             — Game thread, render thread, GPU time split
stat unitgraph        — Scrolling graph of unit times
stat game             — Game thread breakdown by subsystem
stat scenerendering   — Draw calls, primitives, shadow depth
stat memory           — Memory categories at a glance
stat streaming        — Texture streaming pool: size, budget, miss count
stat particles        — Niagara emit/tick counts
stat slate            — UMG/Slate render time (widget overhead)
stat anim             — Animation evaluation time
stat ai               — Behavior Tree / EQS tick time
```

### GAS-specific

```
showdebug abilitysystem    — Active abilities, applied GEs, attribute values overlay
showdebug attributes       — Raw attribute set values for the viewed pawn
AbilitySystem.Debug.RecordAbilityFailures 1   — Log every blocked activation with reason
```

### Detailed profiling

```
stat startfile / stat stopfile    — Record .uestats file for Unreal Insights
ProfileGPU                        — One-frame GPU timing tree in editor
r.ProfileGPU 1                    — Same as console command outside editor
r.RenderTargetPoolMin 400         — Log render target memory pool
memreport -full > MemReport.txt   — Dump full memory report to log
```

### Texture / LOD inspection

```
r.Streaming.PoolSize 2048     — Set texture pool to 2048 MB (match target platform)
r.Streaming.LimitPoolSizeToVRAM 1  — Enforce the cap
stat texturegroup             — Per-group streaming stats
r.LODScale 1.0                — Validate LOD distances at 1:1 scale
ShowFlag.LODColoration 1      — Colorize by LOD level
```

### Niagara / VFX

```
fx.NiagaraMaxSimulationsPerUpdate 3   — Default; raise during perf test to find headroom
stat Niagara                          — Per-system GPU/CPU particle counts
FX.NiagaraDumpSystemStats 1           — Full Niagara performance dump to log
```

---

## Unreal Insights Workflow

Unreal Insights is the primary profiling tool. Use it for any frame budget miss that `stat unit` alone can't explain.

```bash
# Start Insights server before launching the game
"$UE_ROOT/Engine/Binaries/Win64/UnrealInsights.exe"

# Launch game with Insights trace enabled
"$PROJECT-Win64-DebugGame.exe" \
  -trace=cpu,gpu,memory,frame \
  -tracehost=127.0.0.1

# Or capture in-session
stat startfile
# ... reproduce perf issue ...
stat stopfile
# Open the .uestats file in Insights
```

### What to look for

| Symptom | Where to look in Insights |
|---------|--------------------------|
| Game thread spike | Timing Insights → `GameThread` track — find the tall bar, drill to `UWorld::Tick` |
| GAS overhead | `FActiveGameplayEffectsContainer::ExecuteActiveEffectsFrom` in game thread |
| Draw call burst | GPU track — look for sudden increase in `BasePass` or `ShadowDepth` |
| Stall at frame start | `FRenderingThread` waiting on game thread — check for blocking game thread calls |
| Memory leak over session | Memory Insights → `UObject` allocation track growing monotonically |
| Texture streaming stutter | `r.Streaming` group in Timing Insights — `RequestIORead` spikes |

---

## Per-System Budgets

### GAS

| Metric | Budget |
|--------|--------|
| Active `UGameplayEffect` instances per character | ≤ 20 |
| `UGameplayAbility` activations per second (all characters combined) | ≤ 60 |
| Attribute evaluation time per tick | ≤ 0.3ms game thread |
| `UAttributeSet::PreAttributeChange` complexity | O(1) — clamp only, no loops |

### AI

| Metric | Budget |
|--------|--------|
| Active Behavior Tree evaluations per tick | ≤ 10 |
| EQS (Environment Query System) queries per second | ≤ 5 |
| Navigation mesh update time | ≤ 1ms (triggered by dynamic obstacles) |
| Perceivable AI characters on screen simultaneously | ≤ 8 |

### Audio (Wwise)

| Metric | Budget |
|--------|--------|
| Simultaneously active Wwise voices | ≤ 64 |
| Audio thread CPU | ≤ 1.5ms |
| Wwise bank size loaded per level | ≤ 100 MB |
| Per-event memory (SFX) | ≤ 512 KB per one-shot; loop sources streamed |

### UI (UMG / Common UI)

| Metric | Budget |
|--------|--------|
| `stat slate` total | ≤ 1.0ms |
| Widget Blueprint tick count | 0 — no widget tick unless reviewed and approved |
| Widgets with `bCanTick = true` | 0 in shipping |
| Full widget tree invalidation per frame | 0 — use `Invalidate()` on dirty nodes only |

---

## Performance Gates

These run as part of `make gate` (Phase 3 of /ship) and block shipping if failed:

1. `make cook-smoke` Functional Tests pass (catches obvious crashes or hangs).
2. 30-second Gauntlet perf capture in `CombatArena_Perf`: average frame time ≤ 16.6ms, P99 ≤ 33.3ms.
3. `memreport` shows texture streaming pool not exceeding platform budget.
4. `stat scenerendering` draw call count ≤ 1,500 in the combat scenario.

Record baseline numbers in `docs/PERF_BASELINE.md` after each milestone. A regression is a delta > 10% on any tracked metric.

---

## Quick Remediation Lookup

| Symptom | Likely cause | First action |
|---------|-------------|-------------|
| Game thread > 8ms | GAS per-tick work, AI BT evaluation, physics | `stat game` to identify subsystem; check `FActiveGameplayEffectsContainer` cost |
| Render thread > 8ms | Too many draw calls, complex material | `stat scenerendering`; check `r.OptimizeForUAVPerformance`, merge static meshes |
| GPU > 14ms | Overdraw, shadow resolution, unculled foliage | `ProfileGPU`; check `ShadowDepth` and `BasePass` cost; reduce `r.Shadow.RadiusThreshold` |
| Texture pool overflow | Oversized lightmaps or uncompressed textures | `stat streaming`; find `TextureStreaming.WantedMipCount != ResidentMipCount` culprits |
| Memory growing per level | Leaked `UObject` or UMG widgets not GC'd | Insights memory track + `obj list class=UTexture2D` in console |
| Niagara spikes | GPU particle simulate call too broad | `FX.NiagaraDumpSystemStats 1`; reduce `MaxGPUParticleCount` on offending system |
