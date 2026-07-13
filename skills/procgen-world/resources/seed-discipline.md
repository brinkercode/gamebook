# Seed Discipline

> The world seed is the single source of truth. Every random decision in world-gen must be traceable back to `(WorldSeed, ChunkCoord, LayerID)` — nothing is allowed to depend on call order, thread scheduling, or wall-clock time.

## Banned APIs

Never use these inside `Source/<Project>/Public/WorldGen/` or `Private/WorldGen/`:

- `FMath::Rand()`, `FMath::RandRange()`, `FMath::RandHelper()` — global, non-reseedable, order-dependent.
- A single `FRandomStream` member reused across chunks, layers, or feature types. It creates a hidden dependency on generation order — generate chunk (3,4) before (1,1) and you get a different world.
- `FGuid::NewGuid()` or any wall-clock/`FPlatformTime` seed source for gameplay-visible content. Fine for pure cosmetic jitter that never needs to reproduce (e.g., a one-off UI particle), never for terrain/loot/features.

## The rule

**One `FRandomStream` per (chunk, layer) pair, derived by hash — never shared, never mutated across calls that need to be independent.**

```cpp
// Source/<Project>/Public/WorldGen/WorldGenHash.h
#pragma once
#include "CoreMinimal.h"

namespace WorldGenHash
{
    // Stable, platform-independent hash — do NOT use GetTypeHash/PointerHash,
    // they are not guaranteed stable across engine versions or platforms.
    inline uint64 HashCombine64(uint64 A, uint64 B)
    {
        // 64-bit mix (SplitMix64-style), deterministic across platforms.
        uint64 X = A ^ (B + 0x9E3779B97F4A7C15ULL + (A << 6) + (A >> 2));
        X ^= X >> 30; X *= 0xBF58476D1CE4E5B9ULL;
        X ^= X >> 27; X *= 0x94D049BB133111EBULL;
        X ^= X >> 31;
        return X;
    }

    enum class ELayer : uint8
    {
        Elevation = 0,
        Moisture  = 1,
        Temperature = 2,
        Biome       = 3,
        FeaturePlacement = 4,
        RegionAssignment = 5,
    };

    // The ONLY entry point for a seeded stream in world-gen code.
    inline FRandomStream MakeStream(int64 WorldSeed, int32 ChunkX, int32 ChunkY, ELayer Layer)
    {
        uint64 ChunkKey = (static_cast<uint64>(static_cast<uint32>(ChunkX)) << 32)
                         | static_cast<uint32>(ChunkY);
        uint64 Combined = HashCombine64(static_cast<uint64>(WorldSeed), ChunkKey);
        Combined = HashCombine64(Combined, static_cast<uint64>(Layer));
        // FRandomStream takes an int32 seed — fold the 64-bit hash down.
        const int32 FoldedSeed = static_cast<int32>(Combined ^ (Combined >> 32));
        return FRandomStream(FoldedSeed);
    }
}
```

Usage inside a chunk generator:

```cpp
// Never: static FRandomStream SharedStream; // BANNED — order-dependent, shared mutable state
void UChunkGenerator::GenerateElevation(int64 WorldSeed, int32 ChunkX, int32 ChunkY, FChunkData& Out)
{
    FRandomStream ElevJitter = WorldGenHash::MakeStream(WorldSeed, ChunkX, ChunkY, WorldGenHash::ELayer::Elevation);
    // ElevJitter is local, fresh, and depends ONLY on (seed, chunk, layer) — safe to
    // call from any thread, in any order, any number of times, with the same result.
    ...
}
```

## Why this matters

- **Any-order generation** — chunks can generate in parallel task graph nodes, streamed in on-demand as the player walks, or regenerated years later for a screenshot; the result is bit-identical because nothing depends on "what generated before this."
- **Region graph and chunk noise use different `ELayer` values** even when they cover the same chunk coordinate, so a region-scale reroll never perturbs the fine noise pass and vice versa.
- **Feature placement (`ELayer::FeaturePlacement`) is seeded separately from biome lookup** — changing a Poisson-disc radius tuning value later doesn't reshuffle biome boundaries.
- **Determinism testing** (see the Functional Test in the top-level SKILL.md Output section) directly validates this contract: generate seed `12345` twice, hash the resulting `FChunkData` array, assert equality. Any accidental `FMath::Rand()` call anywhere in the pipeline will make that test flaky first, then fail outright under `-deterministic` test running with randomized task graph ordering.

## Multiplayer note

Server generates authoritatively from `WorldSeed` on session start and never trusts a client-supplied seed or client-generated stream — see `resources/delta-saves.md` for the seed-once, deltas-only replication contract.
