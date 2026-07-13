# Delta Saves

> The save file never contains terrain. It contains the seed that regenerates the terrain, and an ordered log of everything the player did to change it. Loading a save means regenerating the world from scratch and replaying the log — not decompressing a world snapshot. Builds directly on `[[save-system]]`'s `USaveGame` + async + encryption pattern; this is that pattern applied to world state specifically.

## Why deltas, not snapshots

A heightmap-scale world (or worse, a voxel one) is enormous if serialized directly. Since generation is a pure, deterministic function of `(WorldSeed, ChunkCoord)` (see `resources/seed-discipline.md`), the save only needs to capture the *deviations* from what generation would produce anyway — a felled tree, a mined vein, a placed foundation, an NPC settlement claim. Everything else regenerates identically every time.

## Save schema

```cpp
// Source/<Project>/Public/Save/WorldSaveGame.h
USTRUCT()
struct FWorldDelta
{
    GENERATED_BODY()

    UPROPERTY() int64 SequenceIndex = 0;      // strictly increasing, defines replay order
    UPROPERTY() FIntPoint ChunkCoord;
    UPROPERTY() FGameplayTag DeltaType;       // Delta.Feature.Destroyed, Delta.Actor.Placed, Delta.Voxel.Edited...
    UPROPERTY() FVector LocalPosition;
    UPROPERTY() FGameplayTag PayloadTag;      // e.g. the feature/building type involved
    UPROPERTY() TArray<uint8> ExtraPayload;   // small, delta-specific blob (rotation, voxel material id, etc.)
};

UCLASS()
class MYGAME_API UWorldSaveGame : public USaveGame
{
    GENERATED_BODY()
public:
    UPROPERTY() int32 SchemaVersion = 1;
    UPROPERTY() int64 WorldSeed = 0;
    UPROPERTY() FString RegionGraphVersion;      // bump if region-graph algorithm changes; see migration note below
    UPROPERTY() TArray<FWorldDelta> DeltaLog;    // ordered, append-only during a session
};
```

This follows the standard save pattern in `agents/_shared/PATTERNS.md#save`: `SchemaVersion` first, async I/O only (`AsyncSaveGameToSlot`/`AsyncLoadGameFromSlot`), slot bytes encrypted with `FAES` per `[[save-system]]`'s `resources/encryption.md` — the delta log gets the exact same encryption treatment as any other save field, no special-casing.

## Save subsystem responsibilities

```cpp
// Source/<Project>/Public/WorldGen/WorldGenSubsystem.h (extends the API in resources/region-graph.md)
UFUNCTION(BlueprintCallable, Category = "WorldGen")
void RecordDelta(const FWorldDelta& Delta);   // called by feature-destroy, build-placement, mining etc.

UFUNCTION(BlueprintCallable, Category = "WorldGen")
void RegenerateAndReplay(const UWorldSaveGame* Save);  // called on load
```

```cpp
void UWorldGenSubsystem::RecordDelta(const FWorldDelta& Delta)
{
    // Server-authoritative: only the server appends to the canonical delta log.
    check(GetWorld()->GetNetMode() != NM_Client);
    FWorldDelta Stamped = Delta;
    Stamped.SequenceIndex = NextSequenceIndex++;
    PendingDeltaLog.Add(Stamped);
    // Flushed to UWorldSaveGame::DeltaLog by USaveGameSubsystem::SaveAsync at the next checkpoint.
}

void UWorldGenSubsystem::RegenerateAndReplay(const UWorldSaveGame* Save)
{
    InitializeWorld(Save->WorldSeed);           // pure regeneration from seed, see region-graph.md
    for (const FWorldDelta& Delta : Save->DeltaLog)
    {
        ApplyDelta(Delta);                        // destroy the tree, spawn the foundation, edit the voxel, in SequenceIndex order
    }
}
```

## Rules

- **Never write partial/derived terrain state to the save.** No cached heightmap arrays, no biome grids, no feature-actor transforms outside of what a delta implies. If it can be recomputed from `(WorldSeed, ChunkCoord)` plus replaying deltas, it does not belong in `UWorldSaveGame`.
- **Deltas are append-only and ordered by `SequenceIndex`**, never reordered or coalesced silently — replay must reproduce the same sequence of world mutations that produced the current state, in case later deltas depend on earlier ones (e.g., a foundation placed on a tile only cleared by an earlier chop delta).
- **Schema migration**: if the region-graph or biome-lookup algorithm changes between versions, `RegionGraphVersion` mismatch means "old deltas may reference chunk coordinates that no longer resolve to the same biome" — `USaveGameSubsystem::PostLoad`-equivalent migration must be explicit here, not silently trusted; a bumped `RegionGraphVersion` should route through a migration path (re-validate deltas against the new region graph, or refuse to load with a clear error) rather than replaying blind.
- **Delta payloads stay small.** `ExtraPayload` is for a handful of bytes (rotation, voxel material index), not for re-serializing an entire actor. Anything more complex references a `TSoftObjectPtr`/Data Asset by tag, same as `agents/_shared/PATTERNS.md#data`.

## Multiplayer replication

- The server owns `WorldSeed` and the canonical `DeltaLog`. On session join, the server sends the seed **once** — the client runs the exact same deterministic generation locally from that seed (identical result, per `resources/seed-discipline.md`), so no terrain data crosses the network.
- After the initial seed handshake, only new deltas replicate — as they occur, via a `Reliable` multicast RPC or a replicated `DeltaLog` array (`ReplicatedUsing`) depending on scale, per `agents/_shared/PATTERNS.md#replication`. Never re-send the full log; late joiners get the current `DeltaLog` snapshot once, then incremental deltas after.
- Clients **never author deltas locally and trust them.** A mining/building action is a `Server, Reliable, WithValidation` RPC (per the standard replication pattern); the server validates the action against its own generated world state, appends the delta, and only then replicates it back down. This is the same server-authoritative posture as `agents/_shared/SECURITY_CHECKLIST.md` requires for any state-mutating RPC.

## Handoff surface

`eng-gameplay` exposes `RecordDelta`/`RegenerateAndReplay` in `systems_surface[]` as `type: "subsystem"`, `replication: "server"`, with `blueprint_consumers` covering the harvest/mining/building interaction Blueprints (`[[crafting-system]]`, `[[interaction-system]]`) that call `RecordDelta` on a successful world-mutating action. `qa-lead` writes the save/load round-trip Functional Test (save mid-session, reload, assert delta count and world hash match) alongside the determinism test from the top-level SKILL.md.
