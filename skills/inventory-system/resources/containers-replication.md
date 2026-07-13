# Containers, Replication, View Models, Persistence

`UInventoryComponent` is the single container class. A player backpack, a creature's carry pack,
a chest, and a crafting station's input/output buffer are all the same C++ class with different
`EditAnywhere` configuration (capacity model, `bIsPlayerOwned`, `bRequiresProximityToAccess`,
optional `AllowedItemTags` filter for recipe-bound buffers). Do not create per-container
subclasses unless a container needs genuinely new *behavior* (a crafting station's "consume on
tick" logic belongs in a thin `UCraftingStationComponent` that *holds two* `UInventoryComponent`
references — input buffer, output buffer — rather than subclassing inventory itself).

---

## `UInventoryComponent`

```cpp
// Source/<Project>/Public/Inventory/InventoryComponent.h
UENUM(BlueprintType)
enum class EInventoryCapacityModel : uint8 { SlotCount, Weight, Hybrid, RecipeBound };

UCLASS(ClassGroup = (Inventory), meta = (BlueprintSpawnableComponent))
class MYGAME_API UInventoryComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UInventoryComponent();

    UPROPERTY(EditAnywhere, Category = "Capacity")
    EInventoryCapacityModel CapacityModel = EInventoryCapacityModel::Hybrid;

    UPROPERTY(EditAnywhere, Category = "Capacity")
    int32 NumSlots = 24;

    UPROPERTY(EditAnywhere, Category = "Capacity")
    float MaxWeight = 100.f;

    // RecipeBound containers (crafting station buffers) only accept these tags. Empty = accepts
    // anything the capacity model allows.
    UPROPERTY(EditAnywhere, Category = "Capacity")
    FGameplayTagContainer AllowedItemTags;

    UPROPERTY(ReplicatedUsing = OnRep_Entries, BlueprintReadOnly)
    TArray<FInventoryEntry> Entries;

    // --- Server-authoritative mutation surface. All of these run their real logic on the
    // authority only; call sites route through the RPCs below when crossing net boundary. ---
    bool CanAccept(const FInventoryEntry& Entry) const;
    bool TryAddItem(const FInventoryEntry& Entry);          // authority-only
    bool TryRemoveItem(const FGuid& InstanceID, int32 Count); // authority-only

    // Server RPC: attempt to move Count units of SourceInstanceID from Source component to this
    // component. Validates capacity + ownership/proximity before mutating either side.
    UFUNCTION(Server, Reliable, WithValidation)
    void Server_TransferItem(UInventoryComponent* Source, FGuid SourceInstanceID, int32 Count);

    UPROPERTY(BlueprintAssignable)
    FOnInventoryChanged OnInventoryChanged;

protected:
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    UFUNCTION()
    void OnRep_Entries();
};
```

**Rules:**
- `Entries` replicates as a full `TArray` by default; for containers with high churn (a busy
  crafting station buffer) prefer `FFastArraySerializer` (`FInventoryEntryArray : public
  FFastArraySerializerItem` wrapper) so only changed stacks retransmit, not the whole array. Start
  with plain `TArray` replication; upgrade to `FastArray` only when profiling shows it matters —
  do not pre-optimize every container.
- `TryAddItem`/`TryRemoveItem` are **authority-only** (`GetOwner()->HasAuthority()` asserted at
  entry, or simply never called from a non-authority code path — enforce via the `Server_*` RPC
  boundary, not a runtime branch inside the function). Never allow a client-owned
  `UInventoryComponent` to mutate `Entries` directly.
- `Server_TransferItem` is `WithValidation` — reject if `Source` is null, if the caller doesn't
  own or isn't within interaction range of `Source`, or if `SourceInstanceID` doesn't resolve to
  an entry with `Count >=` the requested amount. A failed validation silently drops the RPC per
  engine convention; a failed *business* check (would overflow capacity) still executes but is a
  no-op and relies on `OnRep_Entries` telling the client nothing changed.
- Same pattern as GAS ability activation (see `gas-ability` / `PATTERNS.md#replication`): server
  is truth, client predicts, server reconciles via replication. Do not reinvent a bespoke
  inventory-specific network protocol.

---

## Prediction-friendly client UX

Full server round-trip for every drag-and-drop feels laggy. Predict optimistically, reconcile on
the authoritative `OnRep_Entries`:

1. On drag-drop in UMG, the client immediately calls a *local, non-authoritative* preview mutation
   on a client-side shadow copy the `UInventoryViewModel` holds (`PredictedEntries`), and fires
   `Server_TransferItem`.
2. The widget renders `PredictedEntries`, not `Entries`, while a transfer is in flight (track with
   a `PendingTransferCount` on the view model).
3. When `OnRep_Entries` fires with the authoritative result, the view model diffs it against
   `PredictedEntries`: if they match, nothing visible changes. If they diverge (server rejected or
   adjusted), snap `PredictedEntries = Entries` and play a short UI "correction" flash — never a
   silent teleport of the item that looks like a bug.
4. Never predict destructive results (item destroyed, durability hitting zero) — only predict
   moves/merges where a rollback is visually cheap.

---

## `UInventoryViewModel` — the eng-ui seam {#viewmodel}

Widgets never read `UInventoryComponent` directly. A thin, engine-owned view model translates
component state into widget-friendly, delegate-driven data. This is the handoff boundary between
`eng-gameplay` (owns the component) and `eng-ui` (owns the widget).

```cpp
// Source/<Project>/Public/Inventory/InventoryViewModel.h
UCLASS(BlueprintType)
class MYGAME_API UInventoryViewModel : public UObject
{
    GENERATED_BODY()
public:
    void Initialize(UInventoryComponent* InComponent); // binds OnInventoryChanged

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    TArray<FInventorySlotView> GetSlotViews() const;    // BP-friendly flattened view, not FInventoryEntry directly

    UFUNCTION(BlueprintCallable, Category = "Inventory")
    void RequestTransfer(UInventoryViewModel* SourceVM, FGuid InstanceID, int32 Count);

    UPROPERTY(BlueprintAssignable)
    FOnSlotsChanged OnSlotsChanged; // widgets bind here, never poll in Tick
};
```

**Rules:**
- `FInventorySlotView` (a display-only `USTRUCT`, resolved `DisplayName`/`Icon`/`Count`/
  `WeightContribution` — not the raw `FInventoryEntry`) is what widgets bind to. Keeps
  `UDA_ItemDefinition` resolution and formatting out of UMG.
- `RequestTransfer` is the *only* mutation entry point widgets call; it forwards to
  `Server_TransferItem` under the hood. Widgets never call component RPCs directly.
- One view model instance per open inventory screen (player backpack screen, chest screen,
  crafting station screen) — spawned by the widget's `NativeOnInitialized`, torn down on close.
  Do not make it a subsystem-owned singleton; it holds per-screen prediction state.

---

## Persistence — save delta log {#persistence}

Inventory does not get its own save file. It serializes into the project's save delta log
alongside every other mutable-state system (matches `[[procgen-world]]`'s world-delta model and
the `save-system` skill's `USaveGame` schema):

```cpp
// Appended into UMyGameSave (see save-system skill) as one entry per persistent
// UInventoryComponent instance in the world/save.
USTRUCT()
struct FInventorySaveDelta
{
    GENERATED_BODY()
    UPROPERTY() FGuid OwnerPersistentID;   // stable actor ID, not a raw AActor* — see save-system
    UPROPERTY() TArray<FInventoryEntry> Entries;
};

// UMyGameSave
UPROPERTY() TArray<FInventorySaveDelta> InventoryDeltas;
```

**Rules:**
- `FInventoryEntry` is already a POD-ish struct (see `item-data.md`), so it serializes with plain
  `UPROPERTY()` reflection — no custom `Serialize()` override needed.
- Only *placed/persistent* containers (player, tamed creatures, player-built chests) write a
  delta. World-spawned loot containers that reset on session/seed regeneration do **not** persist
  — they re-roll deterministically from the seed per `item-data.md`'s determinism notes, same as
  `[[procgen-world]]` world content.
- `OwnerPersistentID` resolves back to the owning actor via whatever stable-ID scheme
  `save-system` already uses for actor persistence (do not invent a second ID scheme here).
- Load order: `UInventoryComponent::BeginPlay` on a persistent owner queries
  `USaveGameSubsystem` for its `OwnerPersistentID`'s delta and repopulates `Entries` *before* any
  gameplay tick that might read inventory state (e.g. before GAS grants abilities gated on
  possessed items).

---

## Interlock with `pickup-system`

World pickups are the *inbound* edge of inventory; this skill is the *storage* edge. Division of
responsibility:

- `pickup-system`'s `APickupBase` owns the world actor, overlap detection, and (for simple
  attribute pickups like health/ammo) applies a `GameplayEffect` directly — that path never
  touches `UInventoryComponent`.
- For pickups that become **inventory items** (resources, tools, weapons the player can drop and
  re-place), `APickupBase::OnPickedUp` calls `PlayerInventoryComponent->TryAddItem(...)` via the
  `Server_TransferItem`-equivalent authority path, constructing an `FInventoryEntry` from the
  pickup's `UDA_ItemDefinition` reference (pickups reference the *same* `UDA_ItemDefinition`
  asset this skill defines — do not duplicate item data between the two skills).
- Dropping an item from inventory back into the world is the reverse: `UInventoryComponent`
  removes the entry server-side, then spawns a `BP_Pickup_<Name>` (from `pickup-system`) at the
  drop location using `WorldMesh`/`ItemID` from the same `UDA_ItemDefinition`.
