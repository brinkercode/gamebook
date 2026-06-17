# Loading Screen Widget

## When to Show

Show `WB_LoadingScreen` for transitions that will take > ~500ms. For small sub-level loads within a level (streaming volumes), do not show a loading screen — load silently in the background.

Show for:
- `OpenLevel` calls (full level transition)
- Boss arena loads triggered by narrative (player walks through a door, arena loads on the other side)

Do NOT show for:
- Proximity-triggered streaming volumes (should be invisible to player)
- Small asset async loads

## WB_LoadingScreen

`Content/UI/WB_LoadingScreen.uasset` — parent: `UUserWidget` (not CommonActivatableWidget — it must always be on top regardless of CommonUI stack)

```
WB_LoadingScreen
└── Canvas Panel (full screen, Z-order 200)
    ├── Image: Background (full screen, dark)
    ├── Image: LoadingIndicator (spinning icon — animated)
    ├── TextBlock: LoadingTip (random gameplay tip)
    └── ProgressBar: LoadProgress (0–1, driven by ULevelStreamingSubsystem::GetLoadProgress)
```

## Show / Hide

```cpp
// Show loading screen
void AMyPlayerController::ShowLoadingScreen()
{
    if (!LoadingScreenWidget && LoadingScreenClass)
    {
        LoadingScreenWidget = CreateWidget<UUserWidget>(this, LoadingScreenClass);
        LoadingScreenWidget->AddToViewport(200); // above everything
    }
}

// Hide loading screen — call from OnLevelLoaded delegate
void AMyPlayerController::HideLoadingScreen()
{
    if (LoadingScreenWidget)
    {
        LoadingScreenWidget->RemoveFromParent();
        LoadingScreenWidget = nullptr;
    }
}
```

Subscribe to `ULevelStreamingSubsystem::OnLevelLoaded` in `AMyPlayerController::BeginPlay` to auto-hide.

## Loading Tips

Store in `Content/Data/DT_LoadingTips.uasset` (Data Table, row type `FLoadingTipRow`):
```cpp
USTRUCT(BlueprintType)
struct FLoadingTipRow : public FTableRowBase
{
    GENERATED_BODY()
    UPROPERTY(EditDefaultsOnly)
    FText TipText;
};
```

On show: pick a random row with `UDataTableFunctionLibrary::GetDataTableRowNames` + random index.
