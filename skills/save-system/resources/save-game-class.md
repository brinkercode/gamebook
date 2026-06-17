# UMyGameSave — Save Game Class

## Header: `Source/<Project>/Data/MyGameSave.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "GameplayTagContainer.h"
#include "MyGameSave.generated.h"

USTRUCT(BlueprintType)
struct FInventoryItemSave
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite)
    FString ItemID;

    UPROPERTY(BlueprintReadWrite)
    int32 Quantity = 0;
};

UCLASS(BlueprintType)
class MYGAME_API UMyGameSave : public USaveGame
{
    GENERATED_BODY()

public:
    // ---- Player progress ----
    UPROPERTY(BlueprintReadWrite, Category="Player")
    FVector PlayerLocation = FVector::ZeroVector;

    UPROPERTY(BlueprintReadWrite, Category="Player")
    FRotator PlayerRotation = FRotator::ZeroRotator;

    UPROPERTY(BlueprintReadWrite, Category="Player")
    float PlayerHealth = 100.0f;

    UPROPERTY(BlueprintReadWrite, Category="Player")
    float PlayerMaxHealth = 100.0f;

    UPROPERTY(BlueprintReadWrite, Category="Player")
    FString CurrentLevelName;

    // ---- Inventory ----
    UPROPERTY(BlueprintReadWrite, Category="Inventory")
    TArray<FInventoryItemSave> Inventory;

    UPROPERTY(BlueprintReadWrite, Category="Inventory")
    int32 HardCurrencyBalance = 0;

    UPROPERTY(BlueprintReadWrite, Category="Inventory")
    TArray<FString> OwnedCosmeticIDs;

    // ---- Narrative flags ----
    UPROPERTY(BlueprintReadWrite, Category="Narrative")
    TSet<FName> CompletedDialogueIDs;

    UPROPERTY(BlueprintReadWrite, Category="Narrative")
    TSet<FName> CollectedAudioLogIDs;

    UPROPERTY(BlueprintReadWrite, Category="Narrative")
    TMap<FName, int32> NarrativeFlags; // general purpose flag → int32 value

    // ---- Settings (persisted separately via settings-slot, but available here) ----
    UPROPERTY(BlueprintReadWrite, Category="Settings")
    float MasterVolume = 1.0f;

    UPROPERTY(BlueprintReadWrite, Category="Settings")
    float MouseSensitivity = 1.0f;

    // ---- Metadata ----
    UPROPERTY(BlueprintReadWrite, Category="Meta")
    FDateTime SaveTimestamp;

    UPROPERTY(BlueprintReadWrite, Category="Meta")
    int32 TotalPlaytimeSeconds = 0;

    UPROPERTY(BlueprintReadWrite, Category="Meta")
    int32 SaveVersion = 1; // increment when breaking changes are made to this struct
};
```

## Save Version Migration

When `SaveVersion` is incremented, add a migration path in `USaveGameSubsystem::LoadSaveGame`:

```cpp
if (SaveData->SaveVersion < 2)
{
    // Migrate V1 → V2: e.g., split OldField into TwoNewFields
    SaveData->SaveVersion = 2;
}
```

Never delete old `UPROPERTY` fields without a migration path — deserialization will silently zero them, causing data loss.
