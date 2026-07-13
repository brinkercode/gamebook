# Work Slots & Aptitude

> Read this when authoring the `FWorkSlot` struct (if the project doesn't already have it from `crafting-system`), extending the creature Data Asset with aptitude, or wiring the efficiency curve.

## `FWorkSlot`

`crafting-system`'s `AStation` already declares `TArray<FWorkSlot> WorkSlots` as its staffing hook — this skill fills that array, it does not redeclare the station side. If a project has creature-work in scope *before* crafting stations exist, author the struct here and have `AStation` (or any `IWorkSlotOwner`-implementing actor) consume it.

```cpp
// Source/<Project>/Public/CreatureWork/WorkSlotTypes.h
USTRUCT(BlueprintType)
struct FWorkSlot
{
    GENERATED_BODY()

    // Which job this slot needs — Work.Mining, Work.Crafting, Work.Transport, ...
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Work")
    FGameplayTag JobTag;

    // World-space socket/marker the creature paths to and plays its loop at.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Work")
    FName SlotSocketName;

    // Currently assigned creature, or nullptr if open. Server-authoritative.
    UPROPERTY(BlueprintReadOnly, Category = "Work")
    TWeakObjectPtr<APawn> OccupantCreature;

    // Manual override: if true, the scheduler never auto-vacates or reassigns
    // this slot even on fatigue rotation — a designer/player pin.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Work")
    bool bPinned = false;

    // Base output rate (units/sec) before aptitude multiplier is applied.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Work")
    float BaseOutputRate = 1.f;

    // Owning station/building — set when the slot is registered with the scheduler.
    UPROPERTY(BlueprintReadOnly, Category = "Work")
    TWeakObjectPtr<AActor> OwningStation;
};
```

Stations register/unregister their slot array with `UWorkSchedulerSubsystem` in `BeginPlay`/`EndPlay`:

```cpp
void AStation::BeginPlay()
{
    Super::BeginPlay();
    if (UWorkSchedulerSubsystem* Scheduler = GetWorld()->GetSubsystem<UWorkSchedulerSubsystem>())
    {
        Scheduler->RegisterStationSlots(this, WorkSlots);
    }
}
```

## Aptitude schema on the creature Data Asset

Extend the project's tameable-creature Primary Data Asset (however it's named — `UDA_CreatureDefinition` below is the convention) with an aptitude map. One entry per job tag the creature species can perform; omit tags the species can never do (no entry = ineligible, not just low tier).

```cpp
// Source/<Project>/Public/Data/DA_CreatureDefinition.h
UENUM(BlueprintType)
enum class EAptitudeTier : uint8
{
    Untrained UMETA(DisplayName = "Untrained"),  // eligible but poor — 0.5x
    Novice    UMETA(DisplayName = "Novice"),     // 0.8x
    Skilled   UMETA(DisplayName = "Skilled"),    // 1.0x
    Expert    UMETA(DisplayName = "Expert"),     // 1.3x
    Master    UMETA(DisplayName = "Master")      // 1.6x
};

UCLASS(BlueprintType)
class MYGAME_API UDA_CreatureDefinition : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere) FName SpeciesID;

    // Job tag -> aptitude tier. Designers fill per species; empty = cannot work that job.
    UPROPERTY(EditAnywhere, Category = "Work")
    TMap<FGameplayTag, EAptitudeTier> WorkAptitudes;
};
```

The tier→multiplier mapping is data, not a hardcoded enum switch — pull it from a curve table so design-technical can retune without a recompile:

```cpp
// CT_AptitudeEfficiency: single float curve keyed 0..4 = Untrained..Master
float UWorkSchedulerSubsystem::GetEfficiencyMultiplier(EAptitudeTier Tier) const
{
    if (!AptitudeEfficiencyCurve) return 1.f;
    return AptitudeEfficiencyCurve->GetFloatValue(static_cast<float>(Tier));
}
```

`AptitudeEfficiencyCurve` is a `UCurveFloat*` set on the subsystem's config Data Asset (`UDA_WorkSchedulerConfig`), never a magic number in code — see `resources/job-scheduler.md` for how the multiplier feeds `BaseOutputRate`.

## Matching rule

A creature is *eligible* for a slot iff `WorkAptitudes.Contains(Slot.JobTag)`. Eligible creatures are ranked by tier (Master beats Skilled beats Untrained); ties are broken deterministically — see `resources/job-scheduler.md#priority-rules`. Ineligible creatures are never assigned even if idle and the slot stays open — the scheduler does not silently downgrade to "any warm body."

## Cross-reference

- `[[crafting-system]]` — owns `AStation`/`FWorkSlot` declaration when a project builds crafting first; this skill is the consumer that fills slots.
- `[[resource-gathering]]` — harvest nodes can also expose `FWorkSlot`s (e.g. an ore vein with a "chief miner" slot) using the same struct and scheduler, not a parallel system.
