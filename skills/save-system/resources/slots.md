# Save Slot Constants and Multi-Slot Pattern

## Slot Name Constants

Defined on `USaveGameSubsystem`:

```cpp
const FName USaveGameSubsystem::DefaultSlot   = TEXT("SaveSlot_Default");
const FName USaveGameSubsystem::SettingsSlot  = TEXT("SaveSlot_Settings");
const FName USaveGameSubsystem::SlotA         = TEXT("SaveSlot_A");
const FName USaveGameSubsystem::SlotB         = TEXT("SaveSlot_B");
const FName USaveGameSubsystem::SlotC         = TEXT("SaveSlot_C");
```

**DefaultSlot**: single-save-file games. Load on boot, save at checkpoints.

**SettingsSlot**: settings (volume, sensitivity, keybindings) saved separately so resetting progress does not reset settings.

**SlotA/B/C**: three named save files for multi-slot support (common in campaign FPS games).

## Multi-Slot UI Pattern

Show save slot selection in the main menu:

```
WB_SaveSlotList
├── WB_SaveSlotTile (SlotA) — displays timestamp + playtime from UMyGameSave metadata
├── WB_SaveSlotTile (SlotB)
└── WB_SaveSlotTile (SlotC)
```

`WB_SaveSlotTile`:
- Read: `USaveGameSubsystem::DoesSaveExist(SlotName)` → show timestamp + playtime if exists, "Empty" if not
- On click Continue: `USaveGameSubsystem::LoadAsync(SlotName)` → on complete, open level
- On click New Game: `USaveGameSubsystem::DeleteSave(SlotName)` if exists, create fresh, open level
- On click Delete: confirmation modal → `DeleteSave(SlotName)`

## Autosave Pattern

Checkpoint actors call save:

```cpp
// ABP_CheckpointActor
void ABP_CheckpointActor::OnPlayerOverlap(UPrimitiveComponent*, AActor* OtherActor, ...)
{
    AMyCharacter* Player = Cast<AMyCharacter>(OtherActor);
    if (!Player) return;

    USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();
    // Snapshot current state into SS->GetCurrentSave()
    SnapshotPlayerState(Player, SS->GetCurrentSave());
    SS->SaveAsync(USaveGameSubsystem::DefaultSlot);

    // Show autosave icon briefly
    AMyHUD* HUD = Cast<AMyHUD>(Player->GetController()->GetHUD());
    HUD->ShowAutosaveIcon();
}
```

Also call save on:
- `AGameModeBase::EndPlay` (game exit / Alt+F4)
- Completing a main narrative beat
- Acquiring a permanent item or cosmetic
