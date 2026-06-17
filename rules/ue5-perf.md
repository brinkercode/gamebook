---
paths:
  - "Source/**"
  - "Content/**"
  - "Config/**"
---

# UE5 Performance Rules

## Baseline target

**60 FPS on GTX 1060 / equivalent console GPU** for the vertical slice. Nanite and Lumen are off by default; revisit after the vertical slice milestone if budget allows.

Frame budget at 60 FPS: **16.67 ms total** — aim for:
- Game thread: ≤8 ms
- Render thread: ≤8 ms
- GPU: ≤12 ms (allowing overlap with other threads)

Never ship a feature without a Stat check confirming it fits within budget on a target-spec machine.

## Essential Stat commands

Run these in PIE or a cooked build before calling any feature complete:

```
stat unit          — game/render/GPU totals + frame time
stat game          — game thread breakdown by tick group
stat gpu           — GPU pass breakdown (draw calls, triangles per pass)
stat scenerendering — draw call counts, shadow map costs
stat streaming     — asset streaming status and memory
stat physics       — physics solver time
stat niagara       — VFX system cost per emitter
stat audio         — active sound counts, concurrency hits
stat memory        — heap, texture, mesh memory totals
```

Always profile with **Shipping build** configuration (or at minimum Development with all debug overhead stripped). PIE numbers are misleading — they include editor overhead.

## Unreal Insights

For frame spikes and hitches, use Insights instead of Stat commands:

```bash
# Start a trace from command line
UnrealInsights.exe -tracehost=127.0.0.1
# In game: `trace.enable cpu,gpu,bookmark,rhicommands`
```

- **CPU trace** for game/render thread breakdown by function.
- **GPU trace** for individual draw calls and render passes.
- **Bookmark trace** for correlating gameplay events (ability activation, level load) to frame spikes.
- Never diagnose a spike longer than 1 frame without an Insights trace. "It seems slow" is not data.

## Tick budget rules

1. **`PrimaryActorTick.bCanEverTick = false`** in every Actor constructor by default. Enable explicitly only for actors that need it.
2. **`SetComponentTickEnabled(false)`** on every `UActorComponent` that doesn't need per-frame work.
3. **`TickInterval` for actors that update rarely** — AI decision ticks at 0.1s–0.5s, UI update ticks at 0.05s. Zero-interval ticks run every frame.

```cpp
AMyActor::AMyActor()
{
    PrimaryActorTick.bCanEverTick = false;  // Disabled by default
}

// Enable only when the actor becomes active
void AMyActor::Activate()
{
    PrimaryActorTick.bCanEverTick = true;
    SetActorTickInterval(0.0f);  // Every frame while active
}
```

4. **Move periodic logic to timers** — `GetWorld()->GetTimerManager().SetTimer(Handle, this, &AMyActor::Poll, 0.2f, true)` instead of counting frames in `Tick`.
5. **Tick groups matter** — `TG_PrePhysics` is the default. Move logic that depends on physics results to `TG_PostPhysics`.

## Draw call budget

| Category | Budget |
|---|---|
| Total draw calls per frame | ≤2000 |
| Dynamic shadows (per light) | ≤500 shadow depth passes |
| Characters on screen simultaneously | ≤8 full-LOD characters |
| VFX particle emitter instances | ≤200 active |

- **Combine static geometry** — use HLOD (Hierarchical LOD) or Merged Actors for background geometry clusters.
- **Instanced Static Mesh (ISM)** for repeated objects — rocks, trees, debris. `UInstancedStaticMeshComponent` submits one draw call per material regardless of instance count.
- **Decals are expensive** — max 20 simultaneous decal actors in a scene. Decals on characters only for hit reactions, removed after 3s.

## LOD requirements

All visible gameplay meshes must have LOD levels configured before the vertical slice:

| Asset type | Required LOD levels | LOD0 triangle budget |
|---|---|---|
| Player character | LOD0–LOD3 | ≤50,000 tris |
| Enemy character | LOD0–LOD3 | ≤30,000 tris |
| Weapon (first-person) | LOD0–LOD2 | ≤20,000 tris |
| Prop (interactive) | LOD0–LOD2 | ≤5,000 tris |
| Background prop | LOD0–LOD2 | ≤2,000 tris |

- **Auto LOD generation is a starting point**, not a shipping deliverable. Review and adjust generated LODs for silhouette fidelity.
- **LOD screen size thresholds** — set in the mesh asset's `LOD Settings`. Don't use project-wide defaults for all asset categories.
- **Cull distance volumes** for background props — actors more than 50m from the player camera with no gameplay relevance should be culled.

## Memory budgets

| Pool | Budget |
|---|---|
| Texture memory (total) | ≤1.5 GB on target GPU |
| Streaming pool | ≤512 MB (`r.Streaming.PoolSize=512`) |
| Single texture max (hero asset) | ≤32 MB (2K or 4K with aggressive compression) |
| Audio in memory | ≤256 MB (streamed audio excluded) |

- **Texture streaming enabled** — `r.Streaming.PoolSize` in `DefaultEngine.ini`. Never disable streaming for shipped builds.
- **BC compression always** — `TC_Default` (BC1/3), `TC_Normalmap` (BC5) for all textures. Uncompressed textures are 4× the memory cost. Only exception: UI textures that show compression artifacts.
- **Mip maps on all world textures** — no mip maps means the GPU samples the full-resolution texture even at distance.
- **Check `stat streaming` regularly** — `Wanted` exceeding `Limit` means textures are dropping to lower mip levels. Increase pool or reduce texture counts.

## Physics budget

- **`CollisionEnabled::QueryOnly` on non-physical objects** — actors that never need physics simulation (triggers, interactable volumes) use `QueryOnly`. `QueryAndPhysics` runs the physics solver every frame, even for static objects.
- **Complex collision is expensive** — use simplified collision (`UCX_` convex hull or primitive shapes) for all non-character meshes. Complex per-polygon collision is only for terrain or mandatory destructibles.
- **`UPhysicsAsset` on Skeletal Meshes** — Physics Asset with minimal capsule/sphere bones for ragdoll. Over 20 physics bodies per character is too many.
- **Max 20 simulating rigid bodies on screen simultaneously** — beyond this, the solver time exceeds 2 ms.

## Blueprint and GC overhead

- **No Blueprint Tick on widgets** — widget's `NativeTick` costs per frame even when invisible. Use C++ delegate bindings.
- **GC spike mitigation** — enable `gc.IncrementalBeginDestroyEnabled=1` in `DefaultEngine.ini` to spread GC work across frames. Monitor with `stat GC`.
- **Asset async loading** — use `FStreamableManager::RequestAsyncLoad` for large assets loaded mid-session (level transition, ability activation). Synchronous `LoadObject` on the game thread stalls for hundreds of milliseconds.

```cpp
// Async load a DA_WeaponData asset
TSharedPtr<FStreamableHandle> Handle = StreamableManager.RequestAsyncLoad(
    WeaponDataPath,
    FStreamableDelegate::CreateUObject(this, &AMyCharacter::OnWeaponDataLoaded)
);
```

## Profiling checklist before any feature ships

- [ ] `stat unit` shows game thread ≤8ms, GPU ≤12ms in the feature's target level
- [ ] `stat game` shows no new tick groups exceeding 1ms for this feature
- [ ] `stat niagara` if VFX was added — emitter count within budget
- [ ] `stat audio` if audio was added — active sounds within concurrency budget
- [ ] Memory: `stat memory` shows no unexpected growth
- [ ] No Tick enabled on actors that don't need it
- [ ] All new meshes have LODs configured
