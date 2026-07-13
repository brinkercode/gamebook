# Recipe tables

Recipes are data, not Blueprint logic. Every recipe domain (smithing, cooking, alchemy,
building) is one `UDataTable` of `FRecipeRow` rows, generated from CSV via the
`ue5-editor-python` skill so the CSV — not the `.uasset` — is the reviewable artifact.

## `FRecipeRow` struct

```cpp
// Source/<Project>/Public/Data/RecipeRow.h
USTRUCT(BlueprintType)
struct FRecipeIngredient
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FPrimaryAssetId ItemId;          // resolves via UAssetManager, not TSoftObjectPtr

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 Quantity = 1;
};

USTRUCT(BlueprintType)
struct FRecipeRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FRecipeIngredient> Inputs;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FRecipeIngredient> Outputs;       // primary outputs, always granted

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FRecipeIngredient> Byproducts;    // rolled, see Quality rolls below

    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta = (Categories = "Station"))
    FGameplayTag RequiredStationTag;         // e.g. Station.Forge

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float CraftTimeSeconds = 5.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta = (Categories = "Recipe.Unlocked"))
    FGameplayTag UnlockTag;                  // e.g. Recipe.Unlocked.IronIngot

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bInterruptible = true;              // drives ability-vs-timer choice, see stations-queues.md

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BaseQualityMean = 0.7f;            // 0..1, see Quality rolls
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BaseQualityVariance = 0.15f;
};
```

`ItemId` uses `FPrimaryAssetId` (Asset Manager primary asset types), not raw object references —
inventory, crafting, and loot all resolve items the same way. If the project's inventory system
uses a different item-key type, adapt `FRecipeIngredient` to match it; the row shape (inputs,
outputs, station tag, craft time, unlock tag) is the contract, not the exact key type.

## Unlock tags ← tech-progression

`UnlockTag` (`Recipe.Unlocked.<Name>`) is granted to the crafting actor's tag container by
whatever tech/progression system the project uses (skill tree node completion, quest reward,
station tier-up). `UCraftingComponent::GetAvailableRecipes()` filters `DT_Recipes_*` rows to
those whose `UnlockTag` is present AND whose `RequiredStationTag` matches the station the
component is currently interacting with. This is the only coupling to progression — the
crafting system never reads the tech tree directly, it only reads tags. Register the tag
taxonomy in `Config/DefaultGameplayTags.ini`:

```ini
+GameplayTagList=(Tag="Recipe.Unlocked.IronIngot",DevComment="Granted by Tech.Smithing.Tier1")
+GameplayTagList=(Tag="Station.Forge")
+GameplayTagList=(Tag="Station.Smelter")
+GameplayTagList=(Tag="Station.Workbench")
```

## Generating the DataTable

Author `Content/Data/Crafting/CSV/Recipes_Smithing.csv` and run the generator per
`ue5-editor-python`'s convention — one script per row-struct family, parameterized by CSV path
and target DataTable path, idempotent (re-import in place, never duplicate):

```python
# Tools/Python/gen/crafting_recipe_table.py
import unreal

def import_recipe_csv(csv_path: str, dt_path: str, row_struct_path: str):
    factory = unreal.CSVImportFactory()
    factory.set_editor_property("automated_import_settings", unreal.CSVImportSettings(
        import_row_struct=unreal.load_object(None, row_struct_path)
    ))
    if unreal.EditorAssetLibrary.does_asset_exist(dt_path):
        unreal.EditorAssetLibrary.delete_asset(dt_path)  # DataTable reimport-in-place needs the factory path below instead when available
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", csv_path)
    task.set_editor_property("destination_path", dt_path.rsplit("/", 1)[0])
    task.set_editor_property("destination_name", dt_path.rsplit("/", 1)[1])
    task.set_editor_property("factory", factory)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    unreal.EditorAssetLibrary.save_loaded_asset(
        unreal.load_asset(dt_path))
```

Run headless: `UnrealEditor-Cmd <project>.uproject -run=pythonscript -script="Tools/Python/gen/crafting_recipe_table.py" -unattended -nullrhi`.
Record the generated table in the handoff's `assets_authored[]` with the CSV path as the
generator input.

## Quality rolls (seeded)

Craft completion rolls a `Quality` float (0..1) that scales output stats (weapon damage,
durability, food buff magnitude — interpretation is per-project) and decides whether a
`Byproducts` entry is granted. **Never** call `FMath::Rand()` / `FMath::RandRange()` for this —
use a `FRandomStream` seeded deterministically so replays and the world seed reproduce the same
outcome:

```cpp
// In UCraftingComponent, server-side only
const int32 CraftInstanceSeed = HashCombine(
    GetTypeHash(WorldSeed),                 // from the procgen world seed — see [[procgen-world]]
    HashCombine(GetTypeHash(StationInstanceId), CraftSequenceNumber));
FRandomStream Stream(CraftInstanceSeed);

const float Quality = FMath::Clamp(
    Stream.FRandRange(Row->BaseQualityMean - Row->BaseQualityVariance,
                       Row->BaseQualityMean + Row->BaseQualityVariance), 0.f, 1.f);

for (const FRecipeIngredient& Byproduct : Row->Byproducts)
{
    if (Stream.FRand() < ByproductChanceForQuality(Quality))
    {
        GrantItem(Byproduct.ItemId, Byproduct.Quantity);
    }
}
```

`CraftSequenceNumber` is a per-station monotonically incrementing counter (replicated, saved) —
it, plus the world seed and station instance ID, makes every craft's outcome reproducible from
the save file alone, matching the deterministic-by-seed contract in
[[procgen-world]]'s delta log. Log the roll (`CraftInstanceSeed`, `Quality`, byproducts granted)
to the same delta-log mechanism procgen-world uses for world mutations, so a full-seed replay
regenerates identical crafted-item quality.

## Server authority

`UCraftingComponent::RequestCraft(FDataTableRowHandle Recipe)` is a `Server, Reliable,
WithValidation` RPC. `ServerValidate_RequestCraft` re-checks: recipe unlock tag present,
inventory contains inputs, station (if any) tag matches, no craft already in progress for this
component. The client only ever sees the resulting replicated `FCraftQueueEntry` state — it
never rolls quality or decides output locally, even for prediction (show a spinner, not a
guessed result).
