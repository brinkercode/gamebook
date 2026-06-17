---
paths:
  - "Content/VFX/**"
  - "Source/**/VFX/**"
---

# UE5 Niagara Rules

## Stack

- **Niagara for all new VFX** — no new Cascade emitters. Legacy `P_` Cascade assets may remain in the Content Browser until explicitly migrated; do not create new ones.
- **Emitter (`NE_`)** is a reusable building block. **System (`NS_`)** is a collection of emitters that play together. Always ship `NS_` assets to gameplay code; never spawn a raw emitter.
- **GPU simulation** for large particle counts (>10,000 simultaneous particles). CPU simulation for particles that need precise gameplay callbacks or collision with dynamic objects.

## Naming and content layout

```
Content/VFX/
├── Impacts/
│   ├── NS_Impact_Bullet_Concrete.uasset
│   ├── NS_Impact_Bullet_Metal.uasset
│   └── NS_Impact_Explosion.uasset
├── Abilities/
│   ├── NS_AbilityActivate_PrimaryFire.uasset
│   └── NS_AbilityActivate_Dash.uasset
├── Environment/
│   ├── NS_Ambient_Dust.uasset
│   └── NS_Fog_LocalVolume.uasset
├── Weapons/
│   ├── NS_MuzzleFlash_Rifle.uasset
│   └── NS_Casing_Ejection.uasset
└── Emitters/                     # Shared NE_ building blocks
    ├── NE_Spark.uasset
    ├── NE_SmokeTrail.uasset
    └── NE_Debris.uasset
```

## Spawning from C++ and Blueprint

```cpp
// One-shot at a world location (fire and forget)
UNiagaraFunctionLibrary::SpawnSystemAtLocation(
    GetWorld(),
    MuzzleFlashSystem,       // TObjectPtr<UNiagaraSystem> — UPROPERTY on the actor
    MuzzleSocket.GetLocation(),
    MuzzleSocket.GetRotation().Rotator()
);

// Attached to a component (looping, e.g. thruster flame)
UNiagaraComponent* NiagaraComp = UNiagaraFunctionLibrary::SpawnSystemAttached(
    ThrusterSystem,
    ThrusterMesh,            // Attach parent component
    FName("ThrusterSocket"),
    FVector::ZeroVector,
    FRotator::ZeroRotator,
    EAttachLocation::SnapToTarget,
    true   // bAutoDestroy when system completes
);
```

- **Store `NS_` references as `UPROPERTY(EditDefaultsOnly)`** on the actor — set in Blueprint CDO. Never hard-code asset paths as string references.
- **Never `LoadObject<UNiagaraSystem>` at spawn time** — async-load on actor initialization using `FStreamableManager`. Synchronous loads on the game thread stall for hundreds of milliseconds.
- **`bAutoDestroy = true` for one-shots** — avoids orphaned NiagaraComponents. For looping systems, destroy explicitly via `NiagaraComp->DeactivateImmediate()`.

## Performance rules

### Particle count

| Effect type | Max particles (CPU) | Max particles (GPU) |
|---|---|---|
| Muzzle flash | 500 | N/A — CPU only |
| Impact (bullet) | 200 | N/A |
| Explosion (world) | 2,000 | 50,000 |
| Ambient (background) | 500 | 20,000 |
| Ability (player) | 1,000 | N/A — needs collision |

- **GPU sim for pure visual effects** — fire, smoke, large debris clouds. GPU particles have no C++ callback and cannot collide with dynamic actors.
- **CPU sim for gameplay-relevant particles** — particles that trigger events on collision, deal damage, or need `OnSystemFinished` callbacks.

### Budget per frame

- **`stat niagara`** shows per-system cost. Any emitter exceeding 0.5 ms/frame is a candidate for optimization.
- **Maximum 200 active `UNiagaraComponent` instances at once** in the scene. Pool or cull beyond this.
- **Cull distance per system** — set `Niagara System Fixed Bounds` and configure `Visibility Culling` per system. Emitters 40m+ from the camera should not run at full rate.

### Pooling

Enable Niagara System pooling in `DefaultEngine.ini`:

```ini
[NiagaraSettings]
bSystemPoolingEnabled=True
SystemPoolBudget=200
```

With pooling enabled, `SpawnSystemAtLocation` recycles inactive systems from the pool instead of allocating fresh objects. Critical for high-frequency effects (bullet impacts, footsteps).

- **Set `PoolMethod = Deactivate and Return` on one-shot systems** — the system returns to the pool when it completes. `Kill` destroys it; never use `Kill` on pooled systems.
- **Confirm systems are actually returning to the pool** — `stat niagara` shows pool hit rate. A low hit rate means systems are being destroyed before the pool can reclaim them.

## LOD (Niagara Scalability)

All `NS_` systems must have at least two scalability levels configured:

| Level | Max particles | Spawn rate |
|---|---|---|
| Epic (default) | 100% | 100% |
| Medium | 50% | 60% |
| Low | 20% | 30% |
| Off (background) | 0 | 0 — system disabled |

- **Tie Niagara scalability to Unreal's Engine Scalability settings** — `Niagara Component` `Scalability Culling` respects the `Effects Quality` cvar. Set this up in the scalability profiles, not in individual systems.
- **`sg.EffectsQuality 0` for minimum-spec** — verify all `NS_` systems degrade without crashing or leaving orphaned components.

## Data interfaces

- **`Skeletal Mesh Data Interface` for bone-attached emissions** — blood from a wound site, dust from feet. Avoids per-frame socket queries in C++.
- **`Collision Query Data Interface` for terrain-conforming particles** — ground fog, decal-style VFX. Do not use CPU collision against dynamic objects — too expensive at scale.
- **`Audio Output Data Interface` for procedural audio** — Wwise RTPC driven by particle density. See [wwise.md](wwise.md) for the coupling pattern.
- **Never use `Blueprint Callable Node` inside a Niagara module** — Niagara modules run on a HLSL-compiled path; Blueprint nodes are stripped. Use Data Interfaces for external data.

## Material guidelines for Niagara

- **`M_Particle_Unlit` base for all non-reactive particles** — avoids lighting calculations. Impact sparks, smoke trails, ambient dust do not need to respond to light.
- **`M_Particle_Lit` only when the effect must respond to world lighting** — fire, glowing energy effects, bioluminescence.
- **Two-sided materials for flat sprite particles** — `bTwoSided = true` on the material, no backface culling cost penalty for sprites.
- **Avoid runtime texture samples with `TexCoord` randomization inside Niagara** — pre-bake flipbooks. Texture array sampling is cheaper than UV-animated single textures.
