# Stations, craft queues, and creature work

## `UCraftingComponent`

Attach to any actor that can craft: the player character, or an `AStation` itself (for
autonomous station crafting — see Creature-work below).

```cpp
// Source/<Project>/Public/Crafting/CraftingComponent.h
UCLASS(ClassGroup = (Crafting), meta = (BlueprintSpawnableComponent))
class MYGAME_API UCraftingComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UCraftingComponent();

    UFUNCTION(BlueprintCallable, Category = "Crafting")
    TArray<FDataTableRowHandle> GetAvailableRecipes(AStation* AtStation) const;

    UFUNCTION(Server, Reliable, WithValidation, Category = "Crafting")
    void RequestCraft(FDataTableRowHandle Recipe, AStation* AtStation);

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_ActiveCraft)
    FCraftQueueEntry ActiveCraft;

    UPROPERTY(EditDefaultsOnly, Category = "Crafting")
    UDataTable* RecipeTable;

protected:
    void ServerValidate_RequestCraft(FDataTableRowHandle Recipe, AStation* AtStation, bool& bOutValid);
    void CompleteCraft();      // server-only: deduct inputs already happened at start, grant outputs
    FTimerHandle CraftTimerHandle;
};
```

`FCraftQueueEntry` (replicated struct): `RecipeRowName`, `StartServerTimeSeconds`,
`DurationSeconds`, `CraftSequenceNumber`. Clients compute remaining time locally from
`GetWorld()->GetTimeSeconds() - StartServerTimeSeconds` for UI — never trust a client-ticked
countdown as authoritative.

Inputs are deducted **on craft start** (not completion) so a station can't be raided mid-craft
to duplicate resources; if the craft is cancelled, refund via the same server path that started
it.

## Ability vs. timer — decision rule

| Use `UGA_Craft` (GAS ability) when… | Use `FTimerHandle` on the component when… |
|---|---|
| The craft can be **interrupted** (player takes damage, leaves the station, station is destroyed) and GAS's `EndAbility`/`CancelAbility` cleanup is worth it | The craft always runs to completion once started (e.g. a passive smelter) |
| The craft can be **boosted** by a GameplayEffect (worker skill buff, fuel item, tech upgrade) that should modify `CraftTimeSeconds` via a `ScalableFloat`/`GameplayEffect` the same way ability cooldowns are boosted | Nothing external ever modifies the duration once started |
| The craft consumes an `Attribute` while active (Stamina drain for hand-crafting) or grants an active-state tag (`State.Crafting`) other systems query | The craft is purely data-plumbing — station tick, no attribute interaction |
| Player-initiated, needs `ActivationBlockedTags`/`ActivationOwnedTags` (e.g. can't move while forging) | NPC/creature-staffed or unattended station crafting (see below) |

Rule of thumb: **player-facing, interruptible/boostable crafts are abilities; unattended or
always-completes station crafts are timers.** A single project commonly has both — hand-crafting
at a workbench (`UGA_Craft`) and a staffed forge that keeps producing while the player is away
(timer inside `UCraftingComponent`, ticked by `AStation`).

```cpp
// UGA_Craft — interruptible path
void UGA_Craft::ActivateAbility(...)
{
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo)) { EndAbility(...); return; }
    GetAbilitySystemComponentFromActorInfo()->AddLooseGameplayTag(CraftingTag); // State.Crafting
    UAbilityTask_WaitDelay* Wait = UAbilityTask_WaitDelay::WaitDelay(this, DurationSeconds);
    Wait->OnFinish.AddDynamic(this, &UGA_Craft::HandleCraftComplete);
    Wait->ReadyForActivation();
}
// Movement-away, damage-taken, or station-destroyed events call CancelAbility() —
// EndAbility(..., bWasCancelled=true) refunds inputs; normal completion grants outputs.
```

## `AStation` and `Station.*` tags

```cpp
// Source/<Project>/Public/Crafting/Station.h
UCLASS()
class MYGAME_API AStation : public AActor
{
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, Category = "Station", meta = (Categories = "Station"))
    FGameplayTag StationTag;                    // Station.Forge

    UPROPERTY(EditDefaultsOnly, Category = "Station")
    TArray<FWorkSlot> WorkSlots;                 // creature-work hook, see below

    UPROPERTY(VisibleAnywhere, Category = "Station")
    UCraftingComponent* StationCraftingComponent; // present only on stations that self-craft
};
```

A station only exposes recipes whose `RequiredStationTag == StationTag`. Multiple station
instances can share a tag (three forges all gate `Station.Forge` recipes identically) — tag
matching, not per-actor recipe lists, is what keeps recipe authoring centralized in the
DataTable.

## Creature-work hook {#creature-work}

This is the Palworld-x-Anno differentiator: a **staffed** station crafts autonomously without a
player present. `AStation::WorkSlots` is the seam a separate creature-work-assignment system
fills — this skill only defines and consumes the slot contract, it does not implement
creature AI or assignment UI.

```cpp
USTRUCT(BlueprintType)
struct FWorkSlot
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FGameplayTag RequiredWorkerTag;      // e.g. Worker.Species.Golem — what can fill this slot

    UPROPERTY(BlueprintReadOnly)
    TWeakObjectPtr<AActor> AssignedWorker;   // null when vacant

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float WorkSpeedMultiplier = 1.f;     // applied to CraftTimeSeconds while filled
};
```

Contract between this skill and the creature-work system:

- **Fill**: creature-work-assignment calls `AStation::TryAssignWorker(AActor* Worker, int32 SlotIndex)`
  (server RPC) after its own eligibility check against `RequiredWorkerTag`. `AStation` validates
  the tag again server-side before accepting — never trust the caller.
- **Tick**: while `AssignedWorker.IsValid()` for at least one slot, `AStation::StationCraftingComponent`
  auto-selects the next available recipe (highest-priority unlocked recipe with satisfied
  inputs in the station's linked inventory) and runs the timer path, scaled by
  `WorkSpeedMultiplier`. This never uses `UGA_Craft` — unattended crafting has no player ASC to
  activate an ability on, so it is always the `FTimerHandle` path in `UCraftingComponent`.
  This is the concrete case the ability-vs-timer table above resolves to "timer."
- **Vacate**: `TryUnassignWorker` fires an `OnRep`/multicast event the creature-work system
  listens to (worker died, was reassigned, station destroyed) — this skill owns emitting the
  event, not reacting to why the worker left.
- **Determinism**: which recipe an unattended station auto-selects, and its quality roll, both
  use the same seeded `FRandomStream` convention in `resources/recipe-tables.md#quality-rolls`
  (seed derived from world seed + station instance ID + sequence number) so idle-time production
  while a player is offline replays identically from the delta log — see [[procgen-world]].

## Recipe browser UI

`WB_RecipeBrowser` (`UCommonActivatableWidget`) calls
`UCraftingComponent::GetAvailableRecipes(CurrentStation)` on open and on
`UAbilitySystemComponent`'s tag-changed delegate for any `Recipe.Unlocked.*` tag (so newly
unlocked recipes appear live, e.g. mid-session tech completion) — never poll in Tick. Locked-but-
visible recipes (known but not yet unlocked) are a separate list filtered by `RequiredStationTag`
match only, rendered greyed out, to preview progression.

## Functional Test shape

`<Project>.Crafting.<Domain>.CompletesAndConsumesInputs`: spawn `AStation` with `StationTag`,
grant the actor's ASC/tag container the recipe's `UnlockTag`, seed the world/station with a
known seed, call `RequestCraft`, advance the timer/world via `AutomationDriver` or manual
`Tick`, then assert: input items deducted at start, `ActiveCraft` clears on completion, output
items granted with the exact `Quality` value the fixed seed predicts, and — if `WorkSlots` are
in scope — that filling a slot with a tagged worker starts autonomous crafting without any
player RPC.
