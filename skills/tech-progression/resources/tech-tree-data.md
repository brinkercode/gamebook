# Tech Tree Data

## Schema

`FTechNodeRow` — one row per node in `DT_TechTree_<Domain>` (e.g. `DT_TechTree_Smithing`, `DT_TechTree_Settlement`).

```cpp
// Source/<Project>/Public/Progression/TechNodeRow.h
USTRUCT(BlueprintType)
struct FTechNodeRow : public FTableRowBase
{
    GENERATED_BODY()

    // Stable ID referenced by prerequisites[] and by save data. Never rename after ship.
    UPROPERTY(EditAnywhere) FName NodeID;

    UPROPERTY(EditAnywhere) FText DisplayName;
    UPROPERTY(EditAnywhere) FText Description;

    // Cost in progression points. Some projects also gate on goods (see CostGoods below).
    UPROPERTY(EditAnywhere) int32 CostPoints = 0;

    // Optional secondary cost in crafted/gathered goods, spent alongside points.
    UPROPERTY(EditAnywhere) TMap<FGameplayTag, int32> CostGoods;

    // Node IDs that must already be unlocked before this node can be unlocked.
    // Empty = root node (no prerequisites, always eligible if affordable).
    UPROPERTY(EditAnywhere) TArray<FName> Prerequisites;

    // Tags granted to the target ASC on unlock. This is the entire contract with
    // every consumer system — crafting/building/capture/chain-tier all read these.
    UPROPERTY(EditAnywhere) FGameplayTagContainer Grants;

    // Which tier of the tree this belongs to (UI layout + optional tier-gate rules).
    UPROPERTY(EditAnywhere) int32 TierID = 0;

    // Optional: icon/position hints for WB_TechTree layout.
    UPROPERTY(EditAnywhere) TSoftObjectPtr<UTexture2D> Icon;
    UPROPERTY(EditAnywhere) FVector2D UIPosition;
};
```

**Rules:**
- `NodeID` is the join key everywhere (save data, `Prerequisites[]`, UI selection). Treat it like an enum — add, never rename or reuse after ship.
- `Grants` is a `FGameplayTagContainer`, not a single tag, so one node can unlock multiple related recipes/buildings at once (e.g. `Unlock.Recipe.IronIngot` + `Unlock.Building.Smelter`).
- Never encode a numeric "tier" as a implicit ordering of DataTable rows — `TierID` is explicit and drives production-chain tier gating (`[[production-chains]]`).
- One `DT_TechTree_<Domain>` per tree family (smithing, settlement, taming). A project with multiple parallel trees has multiple tables sharing the same `FTechNodeRow` struct and the same `UProgressionSubsystem` instance, disambiguated by a `TreeID` column if a single subsystem serves more than one tree.

## Generation

Author rows in CSV, generate the DataTable per the `ue5-editor-python` skill:

```python
# Tools/Python/gen/progression_techtree.py
import unreal

def generate(csv_path: str, table_path: str, row_struct: str = "/Script/<Project>.TechNodeRow"):
    factory = unreal.CSVImportFactory()
    task = unreal.AssetImportTask()
    task.filename = csv_path
    task.destination_path = table_path.rsplit("/", 1)[0]
    task.destination_name = table_path.rsplit("/", 1)[1]
    task.replace_existing = True
    task.factory = factory
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
```

Idempotent: re-running with `replace_existing = True` overwrites in place. Commit the CSV and the generator script; the `.uasset` is build output.

## Prerequisite-graph validation

Before content ships, validate the tree is a DAG (no cycles) and every `Prerequisites[]` entry resolves to a real `NodeID` in the same table. Do this once, at data-author time, not at runtime:

```cpp
// Source/<Project>Editor/Private/Progression/TechTreeValidator.cpp
// Editor-only commandlet or automation test — walks every row, DFS with a visiting-set,
// fails the build if a cycle is found or a Prerequisites[] entry has no matching NodeID.
bool ValidateTechTree(UDataTable* Table);
```

Run this as part of `make gate` (or a dedicated `make validate-techtree` target) whenever `DT_TechTree_*` changes — a cyclic or dangling-reference tree fails silently at runtime otherwise (nodes simply never become eligible).

## Currency sources

Progression points (and any secondary goods cost) are added through `UProgressionSubsystem::AddPoints` — never incremented directly by the awarding system. Each source calls the same entry point so the ledger has one write-path:

```cpp
// UProgressionSubsystem
UFUNCTION(BlueprintCallable, Category = "Progression")
void AddPoints(int32 Amount, FGameplayTag SourceTag);
```

| Source | Caller | `SourceTag` example | Notes |
|---|---|---|---|
| Settlement tier-up | settlement-population's tier-transition handler | `ProgressionSource.SettlementTierUp` | Fires once per tier crossed, server-side, on the tick that population/happiness thresholds are met. |
| Exploration POI discovery | the POI's "first discovered" trigger (procgen-world feature actor) | `ProgressionSource.POIDiscovered` | Award once per POI instance — track discovered POI IDs in save data so revisiting doesn't re-award. |
| First-craft bonus | crafting-system's `UCraftingComponent` completion path | `ProgressionSource.FirstCraft.<RecipeID>` | Award once per unique recipe ID the player/settlement has ever completed — track a `TSet<FName> FirstCraftedRecipes` alongside unlocked nodes. |

**Rules:**
- Every award call happens server-side. Clients display a predicted/optimistic total but never author the authoritative point count.
- `SourceTag` is logged with the award (see `resources/unlock-gates.md#persistence`) so the delta log and any analytics/telemetry can distinguish award origin without re-deriving it.
- Award amounts are data (`DT_ProgressionSources` or a similar small table / `UDA_ProgressionConfig`), not hardcoded literals in each calling system — designers tune payout without touching C++.
