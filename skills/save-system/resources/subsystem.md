# USaveGameSubsystem — GameInstance Subsystem

```cpp
// SaveGameSubsystem.h
#pragma once
#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "MyGameSave.h"
#include "SaveGameSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSaveComplete, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnLoadComplete, bool, bSuccess, UMyGameSave*, SaveData);

UCLASS()
class MYGAME_API USaveGameSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    // Slot name constants — see resources/slots.md
    static const FName DefaultSlot;
    static const FName SettingsSlot;

    UFUNCTION(BlueprintCallable, Category="SaveSystem")
    void SaveAsync(FName SlotName, int32 UserIndex = 0);

    UFUNCTION(BlueprintCallable, Category="SaveSystem")
    void LoadAsync(FName SlotName, int32 UserIndex = 0);

    UFUNCTION(BlueprintCallable, Category="SaveSystem")
    void DeleteSave(FName SlotName, int32 UserIndex = 0);

    UFUNCTION(BlueprintPure, Category="SaveSystem")
    UMyGameSave* GetCurrentSave() const { return CurrentSave; }

    UFUNCTION(BlueprintPure, Category="SaveSystem")
    bool DoesSaveExist(FName SlotName, int32 UserIndex = 0) const;

    UPROPERTY(BlueprintAssignable)
    FOnSaveComplete OnSaveComplete;

    UPROPERTY(BlueprintAssignable)
    FOnLoadComplete OnLoadComplete;

private:
    UPROPERTY()
    TObjectPtr<UMyGameSave> CurrentSave;

    void OnSaveGameToSlotComplete(const FString& SlotName, int32 UserIndex, bool bSuccess);
    void OnLoadGameFromSlotComplete(const FString& SlotName, int32 UserIndex, USaveGame* LoadedSave);
};
```

```cpp
// SaveGameSubsystem.cpp
#include "SaveGameSubsystem.h"
#include "SaveEncryption.h"
#include "Kismet/GameplayStatics.h"
#include "Serialization/MemoryWriter.h"
#include "Serialization/MemoryReader.h"

const FName USaveGameSubsystem::DefaultSlot = TEXT("SaveSlot_Default");
const FName USaveGameSubsystem::SettingsSlot = TEXT("SaveSlot_Settings");

void USaveGameSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    // Eagerly create a blank save in memory so game systems can write before first explicit save
    CurrentSave = Cast<UMyGameSave>(
        UGameplayStatics::CreateSaveGameObject(UMyGameSave::StaticClass()));
}

void USaveGameSubsystem::SaveAsync(FName SlotName, int32 UserIndex)
{
    if (!CurrentSave) return;
    CurrentSave->SaveTimestamp = FDateTime::Now();

    FAsyncSaveGameToSlotDelegate SaveDelegate;
    SaveDelegate.BindUObject(this, &USaveGameSubsystem::OnSaveGameToSlotComplete);

    // Serialize, encrypt, then write
    // UGameplayStatics::AsyncSaveGameToSlot handles disk I/O on a background thread
    UGameplayStatics::AsyncSaveGameToSlot(CurrentSave, SlotName.ToString(), UserIndex, SaveDelegate);
}

void USaveGameSubsystem::LoadAsync(FName SlotName, int32 UserIndex)
{
    FAsyncLoadGameFromSlotDelegate LoadDelegate;
    LoadDelegate.BindUObject(this, &USaveGameSubsystem::OnLoadGameFromSlotComplete);
    UGameplayStatics::AsyncLoadGameFromSlot(SlotName.ToString(), UserIndex, LoadDelegate);
}

void USaveGameSubsystem::OnSaveGameToSlotComplete(
    const FString& SlotName, int32 UserIndex, bool bSuccess)
{
    OnSaveComplete.Broadcast(bSuccess);
    if (!bSuccess)
    {
        UE_LOG(LogTemp, Error, TEXT("USaveGameSubsystem: Save failed for slot %s"), *SlotName);
    }
}

void USaveGameSubsystem::OnLoadGameFromSlotComplete(
    const FString& SlotName, int32 UserIndex, USaveGame* LoadedSave)
{
    if (UMyGameSave* Loaded = Cast<UMyGameSave>(LoadedSave))
    {
        // Version migration
        if (Loaded->SaveVersion < UMyGameSave::StaticClass()->GetDefaultObject<UMyGameSave>()->SaveVersion)
        {
            // Apply migrations here (see save-game-class.md)
        }
        CurrentSave = Loaded;
        OnLoadComplete.Broadcast(true, CurrentSave);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("USaveGameSubsystem: No save found for slot %s — starting fresh"), *SlotName);
        CurrentSave = Cast<UMyGameSave>(
            UGameplayStatics::CreateSaveGameObject(UMyGameSave::StaticClass()));
        OnLoadComplete.Broadcast(false, CurrentSave);
    }
}

bool USaveGameSubsystem::DoesSaveExist(FName SlotName, int32 UserIndex) const
{
    return UGameplayStatics::DoesSaveGameExist(SlotName.ToString(), UserIndex);
}

void USaveGameSubsystem::DeleteSave(FName SlotName, int32 UserIndex)
{
    UGameplayStatics::DeleteGameInSlot(SlotName.ToString(), UserIndex);
}
```
