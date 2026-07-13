# Job Scheduler, Work Loops, Fatigue, and UI

> Read this when implementing `UWorkSchedulerSubsystem`, the BT job-loop task set, creature vitals, or `WB_AssignmentBoard`.

## `UWorkSchedulerSubsystem`

`UWorldSubsystem`, not a singleton — one scheduler per level/persistent world, matching the subsystem pattern in `agents/_shared/PATTERNS.md#subsystem`. Owns two pools: idle creatures (`UWorkAssignableComponent` registered on `BeginPlay`) and open slots (registered by stations, see `work-slots.md`).

```cpp
// Source/<Project>/Public/CreatureWork/WorkSchedulerSubsystem.h
UCLASS()
class MYGAME_API UWorkSchedulerSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Tick(float DeltaTime); // driven by FTickableGameObject or a throttled FTimerHandle, not per-frame

    void RegisterCreature(UWorkAssignableComponent* Creature);
    void UnregisterCreature(UWorkAssignableComponent* Creature);
    void RegisterStationSlots(AActor* Station, TArray<FWorkSlot>& Slots);

    // Manual override entry point — UI and gameplay code both call this.
    UFUNCTION(BlueprintCallable, Category = "Work")
    void PinCreatureToSlot(UWorkAssignableComponent* Creature, FWorkSlot* Slot);

    UFUNCTION(BlueprintCallable, Category = "Work")
    void UnpinSlot(FWorkSlot* Slot);

private:
    void RunAssignmentPass();      // called on tick + whenever a creature/slot becomes idle/open
    void AssignCreatureToSlot(UWorkAssignableComponent* Creature, FWorkSlot& Slot);
    void VacateSlot(FWorkSlot& Slot);

    UPROPERTY() TArray<TWeakObjectPtr<UWorkAssignableComponent>> IdleCreatures;
    UPROPERTY() TArray<AActor*> RegisteredStations; // slots live on the station actors themselves

    UPROPERTY(EditDefaultsOnly) UDA_WorkSchedulerConfig* Config; // holds AptitudeEfficiencyCurve, tick interval, priority table ref
};
```

Server-authoritative: `RunAssignmentPass`, `AssignCreatureToSlot`, `VacateSlot`, `PinCreatureToSlot` only ever execute with `HasAuthority()` true (call from the subsystem only on the server world; clients get replicated `FWorkSlot.OccupantCreature` for UI read-only). Treat manual pin/unpin from `WB_AssignmentBoard` as a `Server_PinCreatureToSlot` RPC with `WithValidation` — reject if the creature is ineligible or the slot doesn't exist, per `SECURITY_CHECKLIST.md`'s RPC-trust rule even in single-player-default projects (protects against replay/save-edit abuse and keeps the code multiplayer-ready).

## Priority rules

`RunAssignmentPass` iterates open, unpinned slots in priority order, not slot-registration order. Priority is data (`DT_WorkPriorityRules`), not hardcoded:

```
Row: JobTag | Priority (int, higher = filled first) | MinAptitudeTier
Work.Crafting.Smelting | 100 | Skilled
Work.Mining            | 80  | Untrained
Work.Transport         | 50  | Untrained
```

Within a slot, eligible idle creatures are ranked: highest aptitude tier first, then lowest current Fatigue, then a deterministic tiebreak via `FRandomStream` seeded `Hash(WorldSeed, SlotID, AssignmentPassIndex)` — never `FMath::Rand()`, so a fixed seed replays the same assignment for automation and for save/load determinism (same convention as `[[procgen-world]]`'s per-chunk streams).

Pinned slots (`bPinned == true`) are skipped by `RunAssignmentPass` entirely — a manual pin removes the slot from auto-assignment until explicitly unpinned, even if the pinned creature is fatigued. That's the intentional escape hatch for "I always want my best miner on this vein."

## `UWorkAssignableComponent`

Attached to any tameable creature pawn that can work. Caches the owning `UDA_CreatureDefinition`'s `WorkAptitudes`, tracks current `FWorkSlot*` (or none), and exposes the BT the assignment state it needs.

```cpp
UCLASS(ClassGroup = (Work), meta = (BlueprintSpawnableComponent))
class MYGAME_API UWorkAssignableComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    virtual void BeginPlay() override; // registers with UWorkSchedulerSubsystem

    UPROPERTY(BlueprintReadOnly) FWorkSlot* CurrentSlot = nullptr;
    UPROPERTY(EditAnywhere) UDA_CreatureDefinition* CreatureDef;

    bool IsEligibleFor(const FGameplayTag& JobTag) const;
    EAptitudeTier GetAptitudeTier(const FGameplayTag& JobTag) const;
};
```

## Work loop (BT task set)

One `BT_CreatureWork_<Job>` per job family, sharing a common task set keyed by `JobTag` on the Blackboard:

1. `BTTask_MoveToWorkSlot` — `AIMoveTo` the creature to `CurrentSlot->SlotSocketName` on the station actor. Fails gracefully back to the scheduler (`VacateSlot`) if unreachable after N retries — a blocked path should not soft-lock the slot forever.
2. `BTTask_PerformWorkLoop` — plays the job's `AM_Work_<Job>` anim montage in a loop; each loop tick calls `Station->AddProductionOutput(JobTag, BaseOutputRate * EfficiencyMultiplier * DeltaTime)` feeding the station's production buffer that `crafting-system`'s `UCraftingComponent` reads from (this is the concrete implementation of crafting-system's "creature-work hook"). Also applies the periodic `GE_Work_Fatigue` GameplayEffect (see below) while active.
3. `BTService_MonitorFatigue` — ticks on the work-loop branch; when `UCreatureVitalsAttributeSet::GetFatigue()` crosses the `State.Exhausted.Work` threshold tag, aborts the branch and calls `UWorkSchedulerSubsystem::VacateSlot` so the creature returns to the idle pool (and, if unpinned, a fresh assignment pass can back-fill the slot with another eligible creature).

## Creature vitals (fatigue/happiness)

Reuses the `survival-stats` AttributeSet pattern — GAS-driven, infinite periodic effects, clamped in `PreAttributeChange`, tag-driven thresholds instead of magic numbers:

```cpp
// Source/<Project>/Public/CreatureWork/CreatureVitalsAttributeSet.h
UCLASS()
class MYGAME_API UCreatureVitalsAttributeSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    ATTRIBUTE_ACCESSORS(UCreatureVitalsAttributeSet, Fatigue)     // 0..100, rises while working
    ATTRIBUTE_ACCESSORS(UCreatureVitalsAttributeSet, Happiness)   // 0..100, falls with sustained overwork / poor conditions

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Fatigue) FGameplayAttributeData Fatigue;
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Happiness) FGameplayAttributeData Happiness;

    virtual void PreAttributeChange(const FGameplayAttribute& Attr, float& NewValue) override; // clamp 0..100
};
```

- `GE_Work_Fatigue` — `Infinite`, `Period = 1.0s`, applied only while `CurrentSlot != nullptr`; magnitude via `FScalableFloat` on `CT_FatigueRates` (some species tire faster at some jobs — same curve table can key off `JobTag`).
- `GE_Rest_Recovery` — `Infinite`, applied while idle/housed; drains Fatigue back down and slowly restores Happiness.
- Low `Happiness` should reduce `EfficiencyMultiplier` (unhappy workers produce less, not just "eventually quit") — apply as an additional multiplier on `AddProductionOutput`, not a separate system.
- Thresholds are tags (`State.Exhausted.Work`, `State.Unhappy.Work`) granted/removed by the attribute set's `PostGameplayEffectExecute`, exactly like `survival-stats`'s hunger/thirst thresholds — `WB_AssignmentBoard` and the BT service both read tags, never poll floats directly.

## `WB_AssignmentBoard`

`UCommonActivatableWidget` listing two columns: idle/working creatures (with current job, tier, Fatigue/Happiness bars) and open/filled slots (with job tag, occupant, pin toggle). Manual assignment and pin/unpin call the subsystem's `BlueprintCallable` functions (which route through the validated server RPC); the board itself never mutates `FWorkSlot` state directly — it's a thin view, matching the "BP/UI stays thin, systems own state" rule.

```cpp
UCLASS()
class MYGAME_API UWB_AssignmentBoard : public UCommonActivatableWidget
{
    GENERATED_BODY()
protected:
    virtual void NativeOnInitialized() override; // binds to UWorkSchedulerSubsystem's OnAssignmentChanged delegate

    UFUNCTION() void HandleAssignmentChanged(); // refresh list views, never poll in Tick
};
```

Bind to a scheduler-owned multicast delegate (`OnAssignmentChanged`) fired from `AssignCreatureToSlot`/`VacateSlot`/`PinCreatureToSlot` — the same "bind to delegate, don't poll" rule as attribute-change HUD binding.

## Persistence (delta log)

Assignment is world state, not terrain, but it follows the same discipline as `[[procgen-world]]`: never snapshot the full `TArray<FWorkSlot>` wholesale into the save file. Append ordered delta entries instead — `{Op: Assign|Vacate|Pin|Unpin, StationID, SlotIndex, CreatureID, WorldSeed, Tick}` — and replay them on load in order after stations/creatures have spawned. This keeps assignment state consistent with procgen's delta-log convention and makes the save schema forward-compatible when new job types are added later (old deltas replay unchanged; unknown `JobTag`s are skipped with a warning, not a load failure).
