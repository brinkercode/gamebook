# Item Data — definitions and instances

Two layers, deliberately separate: **definitions** are shared, designer-authored, immutable at
runtime (`UDA_ItemDefinition`, one asset per item type). **Instances** are cheap, per-owner,
mutable (`FInventoryEntry`, a struct — never a `UObject`). A stack of 40 Iron Ore in a chest and
40 Iron Ore in a backpack both point at the same `DA_Item_IronOre` definition asset.

---

## `UDA_ItemDefinition` (Primary Data Asset)

```cpp
// Source/<Project>/Public/Data/DA_ItemDefinition.h
UCLASS(BlueprintType)
class MYGAME_API UDA_ItemDefinition : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    // Stable ID used in save files and network payloads — never the asset path (renaming the
    // asset must not break existing saves). Set once, never change after first ship.
    UPROPERTY(EditDefaultsOnly, Category = "Identity")
    FName ItemID;

    UPROPERTY(EditDefaultsOnly, Category = "Identity")
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, Category = "Stacking")
    int32 MaxStackSize = 1;

    UPROPERTY(EditDefaultsOnly, Category = "Capacity")
    float Weight = 1.f;         // per unit; 0 for weightless capacity models

    UPROPERTY(EditDefaultsOnly, Category = "Capacity")
    int32 SlotsConsumed = 1;    // per stack (not per unit) for slot-model containers

    // Category / rarity / equip-domain tags. Reuse the GameplayTags system so item filters,
    // crafting recipe inputs, and GAS cost effects (e.g. "consumes 1 Item.Consumable.Ration")
    // all read the same taxonomy — do not invent a parallel enum.
    UPROPERTY(EditDefaultsOnly, Category = "Classification")
    FGameplayTagContainer ItemTags;

    UPROPERTY(EditDefaultsOnly, Category = "Presentation")
    TSoftObjectPtr<UTexture2D> Icon;

    // World-drop representation. Soft reference — never LoadObject<> from gameplay code, the
    // Asset Manager resolves on demand when a drop actor spawns. See pickup-system.
    UPROPERTY(EditDefaultsOnly, Category = "Presentation")
    TSoftObjectPtr<UStaticMesh> WorldMesh;

    // Optional: for items with rolled/instance-specific data (durability, socketed mods,
    // procedurally rolled affixes). Null for plain stackables (Wood, Stone, Ore).
    UPROPERTY(EditDefaultsOnly, Category = "Instance Data")
    TSubclassOf<UObject> InstancePayloadClass;

    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId(TEXT("ItemDefinition"), ItemID);
    }
};
```

**Rules:**
- `ItemID` (`FName`), not the `UDA_ItemDefinition*` pointer or asset path, is what gets persisted
  and sent over the wire. Resolve `ItemID → UDA_ItemDefinition*` via
  `UAssetManager::GetPrimaryAssetIdList(FPrimaryAssetType("ItemDefinition"))` at runtime.
- Register `ItemDefinition` as a Primary Asset Type in `Config/DefaultGame.ini` under
  `[/Script/Engine.AssetManagerSettings]` so the Asset Manager can enumerate and preload it.
- `MaxStackSize = 1` marks a non-stacking item (weapons, tools, anything with instance data).
  `SlotsConsumed` and `Weight` still apply per unit for those.
- Naming: `DA_Item_<Name>` under `Content/Data/Items/`, grouped into subfolders by category
  (`Content/Data/Items/Resources/`, `Content/Data/Items/Tools/`, `Content/Data/Items/Consumables/`).

---

## `FInventoryEntry` (instance struct)

```cpp
// Source/<Project>/Public/Inventory/InventoryEntry.h
USTRUCT(BlueprintType)
struct MYGAME_API FInventoryEntry
{
    GENERATED_BODY()

    // Matches UDA_ItemDefinition::ItemID. Resolved to the definition asset via UAssetManager,
    // never stored as a pointer — pointers don't survive save/load or replication cleanly.
    UPROPERTY(BlueprintReadOnly)
    FName ItemID;

    UPROPERTY(BlueprintReadOnly)
    int32 Count = 0;

    // Stable per-stack identity (not per-unit) — lets UI diff "which slot changed" without
    // relying on array index, and lets crafting stations target a specific input stack.
    UPROPERTY(BlueprintReadOnly)
    FGuid InstanceID;

    // Present only for non-stacking / rolled items (durability 0..1, affix rolls, etc). Kept as
    // a small tagged union of primitive fields rather than a UObject* — UObject* instance payload
    // means custom replication and custom save serialization; a POD payload rides for free on
    // both. Add fields here as new item mechanics need them; do not reintroduce a UObject* here
    // without a documented reason.
    UPROPERTY(BlueprintReadOnly)
    float Durability01 = 1.f;

    UPROPERTY(BlueprintReadOnly)
    TArray<FGameplayTag> RolledAffixes;

    bool IsValid() const { return !ItemID.IsNone() && Count > 0; }
};
```

**Rules:**
- `FInventoryEntry` is a value type. Copy it freely; never hold a persistent pointer/reference
  into a container's array (the array reallocates on `Add`/`RemoveAt`).
- Stack-splitting (partial withdraw) creates a new `InstanceID`; merging two stacks of the same
  `ItemID` with default instance data (no durability/affix divergence) keeps the destination's
  `InstanceID` and discards the source's.

---

## Capacity model {#capacity-model}

Pick per-container, exposed as `EditAnywhere` on the `UInventoryComponent` instance (see
`containers-replication.md`) — not a global project setting:

| Model | Use for | Rule |
|---|---|---|
| **Slot-count** | Player backpack, hotbar | Fixed `NumSlots`; each stack consumes `ItemDefinition->SlotsConsumed` slots regardless of `Count`. Simple, readable UI grid. |
| **Weight-cap** | Creature/mount carry, Anno-style hauling | `MaxWeight` float; `Sum(Entry.Count * Definition->Weight) <= MaxWeight`. No slot grid — UI shows a weight bar. |
| **Hybrid** | Player backpack in a survival-crafting game (the default recommendation for this genre shape) | Both caps active simultaneously; a transfer is rejected if it would violate either. Prevents "infinite bricks" (weightless slot spam) and "infinite feathers" (weight-only stacking) failure modes independently. |
| **Buffer (unbounded slots, bounded per-recipe)** | Crafting station input/output | No global cap; instead each buffer only accepts `ItemID`s present in the station's active `DA_Recipe`'s inputs/outputs, and per-recipe quantities cap it implicitly. Model as `SlotCount = Recipe->Inputs.Num()` set at station configuration time. |

Encode the chosen model as an `enum class EInventoryCapacityModel { SlotCount, Weight, Hybrid,
RecipeBound }` field on `UInventoryComponent`, checked once in the shared
`CanAccept(const FInventoryEntry&) const` gate used by every transfer path (see
`containers-replication.md`) — never duplicate the capacity check per container type.

---

## Deterministic-by-seed notes

Any item instance with **rolled** data (procedurally generated affixes, quality tier, loot-table
selection) must derive its randomness from the world/run seed, not `FMath::Rand()`:

- Loot rolls use `FRandomStream(WorldSeed ^ SpawnID)` — same seed + same spawn point always
  produces the same item roll, matching `[[procgen-world]]`'s determinism contract.
- Never seed from `FDateTime::Now()` or `FPlatformTime` for anything that affects saved item
  state — that breaks reproducible seeds and makes bug reports non-repro.
- Server is the sole roller. Rolls happen in the `UInventoryComponent`/loot-table code running on
  the authority; clients receive the resolved `FInventoryEntry`, never roll locally and reconcile.
