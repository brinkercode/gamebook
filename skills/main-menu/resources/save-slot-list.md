# WB_SaveSlotList — Multi-Slot Picker

Use this widget when the game supports three save files (SlotA, SlotB, SlotC). For single-slot games, omit this and use the simplified New Game / Continue pattern in `main-menu-widget.md`.

## WB_SaveSlotList Structure

```
WB_SaveSlotList (CommonActivatableWidget)
└── Canvas Panel
    ├── TextBlock: "Select Save File"
    ├── VerticalBox
    │   ├── WB_SaveSlotTile (Slot A)
    │   ├── WB_SaveSlotTile (Slot B)
    │   └── WB_SaveSlotTile (Slot C)
    └── WB_MenuButton: "Back"
```

## WB_SaveSlotTile Structure

```
WB_SaveSlotTile (CommonButtonBase)
└── HorizontalBox
    ├── TextBlock: SlotLabel ("Slot A")
    ├── VerticalBox
    │   ├── TextBlock: SaveTimestamp ("Jun 15, 2026 — 2:30 PM")
    │   └── TextBlock: PlaytimeText ("4h 23m")
    └── WB_MenuButton: "Delete" (small, right-aligned)
```

## WB_SaveSlotTile Logic

On construct, given slot name:

```cpp
void WB_SaveSlotTile::Initialize(FName SlotName, bool bIsNewGameMode)
{
    ActiveSlotName = SlotName;
    USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();

    if (SS->DoesSaveExist(SlotName))
    {
        // Load metadata only — do a synchronous minimal load for display
        // Or cache metadata in a separate lightweight save slot
        UMyGameSave* PreviewSave = Cast<UMyGameSave>(
            UGameplayStatics::LoadGameFromSlot(SlotName.ToString(), 0));
        if (PreviewSave)
        {
            FString TimeStr = PreviewSave->SaveTimestamp.ToString(TEXT("%b %d, %Y — %I:%M %p"));
            int32 Hours   = PreviewSave->TotalPlaytimeSeconds / 3600;
            int32 Minutes = (PreviewSave->TotalPlaytimeSeconds % 3600) / 60;
            TimestampText->SetText(FText::FromString(TimeStr));
            PlaytimeText->SetText(FText::FromString(
                FString::Printf(TEXT("%dh %dm"), Hours, Minutes)));
            DeleteButton->SetVisibility(ESlateVisibility::Visible);
        }
    }
    else
    {
        TimestampText->SetText(FText::FromString("Empty"));
        PlaytimeText->SetText(FText::GetEmpty());
        DeleteButton->SetVisibility(ESlateVisibility::Collapsed);
    }
}
```

On tile click (the main button, not Delete):
```cpp
// Load this slot and start the game
SS->OnLoadComplete.AddDynamic(this, &WB_SaveSlotTile::OnLoaded);
SS->LoadAsync(ActiveSlotName);
```

On Delete click:
```cpp
// Show confirmation modal, then on confirm:
SS->DeleteSave(ActiveSlotName);
Initialize(ActiveSlotName, false); // refresh display
```
