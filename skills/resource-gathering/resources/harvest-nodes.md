# Harvest Nodes — data, actor, procgen spawn, seeded yield, delta-log persistence

## 1. Node definition (Data Asset per node type)

One `UDA_HarvestNodeDef` instance per resource *type* (oak tree, iron vein, flax cluster). Never
hardcode health/yield/tool values on the actor — the actor is a dumb runtime shell over the
Data Asset, per the [Data-Driven Pattern](../../../agents/_shared/PATTERNS.md#data).

```cpp
// Source/<Project>/Public/Data/DA_HarvestNodeDef.h
UCLASS(BlueprintType)
class MYGAME_API UDA_HarvestNodeDef : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, Category = "Node")
    FName NodeTypeID;                              // "OakTree", "IronVein"

    UPROPERTY(EditAnywhere, Category = "Node")
    float MaxHealth = 100.f;                        // hits-to-deplete via GE_HarvestDamage

    UPROPERTY(EditAnywhere, Category = "Node")
    FGameplayTag RequiredToolTag;                   // "Tool.Axe.Tier1" — see tool-tiers.md

    UPROPERTY(EditAnywhere, Category = "Node")
    TObjectPtr<UDataTable> YieldTable;               // DT_HarvestTable rows: Item, MinCount, MaxCount, Weight

    UPROPERTY(EditAnywhere, Category = "Node")
    TSoftObjectPtr<UStaticMesh> DepletedMesh;        // swapped in on depletion (stump, empty vein)

    UPROPERTY(EditAnywhere, Category = "Respawn")
    EHarvestRespawnPolicy RespawnPolicy = EHarvestRespawnPolicy::FixedTimer;

    UPROPERTY(EditAnywhere, Category = "Respawn", meta = (EditCondition = "RespawnPolicy == EHarvestRespawnPolicy::FixedTimer"))
    float RespawnSeconds = 900.f;                    // in-game seconds; 0/None = never respawns
};
```

`EHarvestRespawnPolicy`: `FixedTimer`, `SeasonalTick` (procgen-world season/day event), `Never`
(finite resources — quarries, one-shot ore pockets).

## 2. Procgen spawn contract — never hand-placed

`AHarvestNode` actors are spawned exclusively by the world's procedural placement pass (PCG
graph or the project's biome-scatter subsystem), driven by [[procgen-world]]'s deterministic
placement stream. The placement pass owns *where*; this skill owns *what happens once placed*.

```cpp
// Called by the procgen placement job, one per placed node
AHarvestNode* Node = World->SpawnActorDeferred<AHarvestNode>(
    AHarvestNode::StaticClass(), SpawnTransform);
Node->InitializeNode(NodeDef, FGuid::NewGuid() /* stable NodeID, see below */);
Node->FinishSpawning(SpawnTransform);
```

**Rules:**
- The `NodeID` (an `FGuid` or a deterministic hash of `(ChunkCoord, LocalIndex)`) must be
  reproducible from world seed + placement pass, not `FGuid::NewGuid()` in shipping — use the
  chunk-coordinate hash so a regenerated chunk (same seed) yields the same NodeIDs and can
  reconcile against the delta log on load. `FGuid::NewGuid()` above is illustrative only for a
  first pass; replace with `UProcgenWorldSubsystem::MakeDeterministicNodeID(ChunkCoord, LocalIndex)`.
- Never place `AHarvestNode` by hand in a level — no BP_Node instances dragged into a map.
  Placement is 100% procgen so world regen from a seed is exact.
- The node actor is otherwise ordinary: registers with the delta-log subsystem in
  `BeginPlay`/`InitializeNode`, not spawn-time-only.

## 3. Node actor

```cpp
// Source/<Project>/Public/World/HarvestNode.h
UCLASS()
class MYGAME_API AHarvestNode : public AActor, public IAbilitySystemInterface
{
    GENERATED_BODY()
public:
    void InitializeNode(UDA_HarvestNodeDef* InDef, const FGuid& InNodeID);
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override { return ASC; }

    UFUNCTION(BlueprintPure) bool IsDepleted() const;

protected:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UAbilitySystemComponent> ASC;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UHarvestNodeAttributeSet> Attributes; // Health

    UPROPERTY() TObjectPtr<UDA_HarvestNodeDef> Def;
    UPROPERTY() FGuid NodeID;

    // Deterministic per-node yield stream: seeded from (WorldSeed, NodeID), NOT FMath::Rand.
    FRandomStream YieldStream;

    UFUNCTION() void OnHealthDepleted(); // bound to Attributes' zero-health delegate
    void RollYield(AController* Harvester);
};
```

```cpp
void AHarvestNode::InitializeNode(UDA_HarvestNodeDef* InDef, const FGuid& InNodeID)
{
    Def = InDef;
    NodeID = InNodeID;
    Attributes->SetMaxHealth(Def->MaxHealth);

    const int32 WorldSeed = UProcgenWorldSubsystem::Get(this)->GetWorldSeed();
    const int32 CombinedSeed = HashCombine(WorldSeed, GetTypeHash(NodeID));
    YieldStream.Initialize(CombinedSeed);

    // Reconcile against the delta log BEFORE presenting full health — a previously
    // depleted node must load depleted, not full, even before its respawn timer fires.
    if (const FResourceNodeDelta* Delta = UProcgenWorldSubsystem::Get(this)->FindNodeDelta(NodeID))
    {
        ApplyDeltaOnLoad(*Delta);
    }
}
```

## 4. Seeded yield rolls (deterministic per world seed + node ID)

Yield must be reproducible for the *same* node across the *same* seed — two players on separate
save files who harvest the same node get the same roll distribution shape (not the same literal
roll each time they harvest, since `YieldStream` advances), but a replay/determinism test that
re-simulates from the same seed and the same harvest order must reproduce identical loot.

```cpp
void AHarvestNode::RollYield(AController* Harvester)
{
    TArray<FInventoryEntry> Yield;
    for (const auto& Row : Def->YieldTable->GetRowMap())
    {
        const FHarvestYieldRow* R = reinterpret_cast<FHarvestYieldRow*>(Row.Value);
        if (YieldStream.FRandRange(0.f, 1.f) <= R->Weight)
        {
            const int32 Count = YieldStream.RandRange(R->MinCount, R->MaxCount);
            Yield.Add({ R->ItemID, Count });
        }
    }
    // Server-authoritative: this function only ever runs on the server in multiplayer builds
    // (see tool-tiers.md §Multiplayer). Grant directly into the harvester's inventory.
    if (UInventoryComponent* Inv = Harvester->FindComponentByClass<UInventoryComponent>())
    {
        Inv->TryAddItems(Yield); // see [[inventory-system]]
    }
}
```

**Never** use `FMath::RandRange`/global RNG for yield — that is neither per-node deterministic
nor reproducible from a saved seed. Always roll through `YieldStream`, which is itself
reconstructed deterministically from `(WorldSeed, NodeID)` on every load — it is never
serialized as raw RNG state, only re-derived.

## 5. Depletion & respawn as world deltas

A chopped tree must stay chopped across save/load. Do **not** save `AHarvestNode` as a full
per-instance actor in the save file — with thousands of procgen nodes that does not scale and
duplicates data the placement pass can regenerate deterministically. Instead, only the *deviation
from the deterministic baseline* is recorded, appended to the [[procgen-world]] delta log:

```cpp
// Source/<Project>/Public/World/ResourceNodeDelta.h
USTRUCT()
struct FResourceNodeDelta
{
    GENERATED_BODY()
    UPROPERTY() FGuid NodeID;
    UPROPERTY() EHarvestNodeState State = EHarvestNodeState::Depleted;
    UPROPERTY() double DepletedAtWorldSeconds = 0.0; // for FixedTimer respawn math
};
```

```cpp
void AHarvestNode::OnHealthDepleted()
{
    SetActorScale3D(FVector::ZeroVector); // or swap DepletedMesh — presentation only
    UProcgenWorldSubsystem::Get(this)->RecordNodeDelta(
        FResourceNodeDelta{ NodeID, EHarvestNodeState::Depleted, GetWorld()->GetTimeSeconds() });
}
```

**Rules:**
- The delta log is the single source of truth for "does this node differ from what the seed
  would generate fresh." Full nodes (never touched) have *no* delta entry at all — this keeps
  the log O(nodes harvested), not O(nodes in world).
- Respawn is re-evaluated on load, not ticked while unloaded: `InitializeNode` compares
  `DepletedAtWorldSeconds + RespawnSeconds` against current world time and flips back to `Full`
  (clearing the delta) if elapsed, rather than a Timer firing while the chunk was streamed out.
- `EHarvestRespawnPolicy::SeasonalTick` nodes clear their delta on a broadcast event from
  [[procgen-world]]'s season/day subsystem, not a per-node timer.
- Functional Test proving this: spawn node with fixed seed → harvest → save → reload → assert
  `IsDepleted() == true` and `YieldStream`'s next roll matches a pre-recorded expected sequence
  for that seed.
