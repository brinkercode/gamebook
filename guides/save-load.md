# Save / Load — USaveGame, Async Serialization, Encrypted Slots

> UE5's `USaveGame` system is the authoritative persistence layer for all player progress, settings, and campaign state. Every save goes through a single `USaveSubsystem` that handles async serialization, slot naming, encryption, and migration versioning. No game code calls `UGameplayStatics::SaveGameToSlot` directly — that function is synchronous and blocks the game thread.

---

## Stack Overview

| Aspect | Implementation |
|--------|---------------|
| Base class | `USaveGame` subclasses per data domain |
| Subsystem | `UGameInstanceSubsystem` — `USaveSubsystem` |
| Serialization | `AsyncSaveGameToSlot` / `AsyncLoadGameFromSlot` (UE5 async) |
| Encryption | `FEncryptionContext` via `IPlatformFile::OpenEncrypted` wrapper |
| Migration | Schema version field + `Migrate()` virtual on each save class |
| Slots | `campaign_<slot_id>`, `settings`, `achievements` |
| Cloud sync | Platform services (Steam Cloud, EOS) opt-in at save-subsystem level |

---

## Save Classes

One class per concern. Never put everything in one god save object.

### ProjectNameSaveTypes.h

```cpp
#pragma once
#include "GameFramework/SaveGame.h"
#include "ProjectNameSaveTypes.generated.h"

// ─── Campaign Save ────────────────────────────────────────────────────────────

USTRUCT(BlueprintType)
struct FCampaignProgress
{
    GENERATED_BODY()

    UPROPERTY(SaveGame)
    FName LastCheckpointTag;

    UPROPERTY(SaveGame)
    TArray<FName> CompletedMissionTags;

    UPROPERTY(SaveGame)
    TMap<FName, int32> CollectibleCounts;  // Tag → count
};

UCLASS()
class PROJECTNAME_API UProjectNameCampaignSave : public USaveGame
{
    GENERATED_BODY()
public:
    // Increment this when the struct layout changes. Migrate() handles upgrades.
    static constexpr int32 CurrentSchemaVersion = 3;

    UPROPERTY(SaveGame)
    int32 SchemaVersion = CurrentSchemaVersion;

    UPROPERTY(SaveGame, BlueprintReadOnly)
    FCampaignProgress Progress;

    UPROPERTY(SaveGame, BlueprintReadOnly)
    float TotalPlaytimeSeconds = 0.f;

    UPROPERTY(SaveGame, BlueprintReadOnly)
    FDateTime LastSaved;

    // Override to upgrade old save data to CurrentSchemaVersion.
    void Migrate();
};

// ─── Settings Save ────────────────────────────────────────────────────────────

UCLASS()
class PROJECTNAME_API UProjectNameSettingsSave : public USaveGame
{
    GENERATED_BODY()
public:
    static constexpr int32 CurrentSchemaVersion = 1;

    UPROPERTY(SaveGame)
    int32 SchemaVersion = CurrentSchemaVersion;

    UPROPERTY(SaveGame, BlueprintReadWrite)
    float MasterVolume = 1.f;

    UPROPERTY(SaveGame, BlueprintReadWrite)
    float MusicVolume = 0.8f;

    UPROPERTY(SaveGame, BlueprintReadWrite)
    float SFXVolume = 1.f;

    UPROPERTY(SaveGame, BlueprintReadWrite)
    int32 GraphicsQualityPreset = 2;   // 0=Low 1=Mid 2=High 3=Ultra

    UPROPERTY(SaveGame, BlueprintReadWrite)
    float MouseSensitivity = 0.5f;

    UPROPERTY(SaveGame, BlueprintReadWrite)
    bool bInvertYAxis = false;

    void Migrate();
};
```

### Migration

```cpp
// ProjectNameSaveTypes.cpp
void UProjectNameCampaignSave::Migrate()
{
    if (SchemaVersion < 2)
    {
        // v1 → v2: CollectibleCounts didn't exist; default to empty (already is)
    }
    if (SchemaVersion < 3)
    {
        // v2 → v3: TotalPlaytimeSeconds added; 0.f default is correct
    }
    SchemaVersion = CurrentSchemaVersion;
}

void UProjectNameSettingsSave::Migrate()
{
    // No migrations yet
    SchemaVersion = CurrentSchemaVersion;
}
```

---

## Save Subsystem

The subsystem owns all async save/load operations. Blueprint calls `SaveAsync` and binds a completion delegate; it never waits synchronously.

### SaveSubsystem.h

```cpp
#pragma once
#include "Subsystems/GameInstanceSubsystem.h"
#include "GameFramework/SaveGame.h"
#include "SaveSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnSaveComplete,  const FString&, SlotName, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnLoadComplete,  const FString&, SlotName, USaveGame*, SaveObject);

UCLASS()
class PROJECTNAME_API USaveSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    // ─── Campaign ────────────────────────────────────────────────────────────
    UFUNCTION(BlueprintCallable, Category="Save")
    void SaveCampaignAsync(int32 SlotIndex, UProjectNameCampaignSave* SaveData);

    UFUNCTION(BlueprintCallable, Category="Save")
    void LoadCampaignAsync(int32 SlotIndex);

    UFUNCTION(BlueprintPure, Category="Save")
    UProjectNameCampaignSave* GetCachedCampaignSave(int32 SlotIndex) const;

    // ─── Settings ────────────────────────────────────────────────────────────
    UFUNCTION(BlueprintCallable, Category="Save")
    void SaveSettingsAsync();

    UFUNCTION(BlueprintCallable, Category="Save")
    void LoadSettingsAsync();

    UFUNCTION(BlueprintPure, Category="Save")
    UProjectNameSettingsSave* GetSettings() const { return CachedSettings; }

    // ─── Events ──────────────────────────────────────────────────────────────
    UPROPERTY(BlueprintAssignable)
    FOnSaveComplete OnSaveComplete;

    UPROPERTY(BlueprintAssignable)
    FOnLoadComplete OnLoadComplete;

    // ─── Slot naming ─────────────────────────────────────────────────────────
    static FString CampaignSlotName(int32 Index)  { return FString::Printf(TEXT("campaign_%d"), Index); }
    static FString SettingsSlotName()              { return TEXT("settings"); }

private:
    void OnAsyncSaveDone(const FString& SlotName, int32 UserIndex, bool bSuccess);
    void OnAsyncLoadDone(const FString& SlotName, int32 UserIndex, USaveGame* LoadedSave);

    UPROPERTY()
    TMap<int32, TObjectPtr<UProjectNameCampaignSave>> CachedCampaignSaves;

    UPROPERTY()
    TObjectPtr<UProjectNameSettingsSave> CachedSettings;

    // In-flight slot names to suppress duplicate saves
    TSet<FString> PendingSaveSlots;
};
```

### SaveSubsystem.cpp

```cpp
#include "Subsystems/SaveSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "ProjectNameSaveTypes.h"

void USaveSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    // Auto-load settings on startup
    LoadSettingsAsync();
}

void USaveSubsystem::SaveCampaignAsync(int32 SlotIndex, UProjectNameCampaignSave* SaveData)
{
    if (!SaveData) { return; }
    const FString Slot = CampaignSlotName(SlotIndex);
    if (PendingSaveSlots.Contains(Slot)) { return; }    // Already saving

    SaveData->LastSaved = FDateTime::UtcNow();
    SaveData->SchemaVersion = UProjectNameCampaignSave::CurrentSchemaVersion;
    PendingSaveSlots.Add(Slot);

    UGameplayStatics::AsyncSaveGameToSlot(SaveData, Slot, 0,
        FAsyncSaveGameToSlotDelegate::CreateUObject(this, &USaveSubsystem::OnAsyncSaveDone));
}

void USaveSubsystem::LoadCampaignAsync(int32 SlotIndex)
{
    const FString Slot = CampaignSlotName(SlotIndex);
    UGameplayStatics::AsyncLoadGameFromSlot(Slot, 0,
        FAsyncLoadGameFromSlotDelegate::CreateUObject(this, &USaveSubsystem::OnAsyncLoadDone));
}

void USaveSubsystem::SaveSettingsAsync()
{
    if (!CachedSettings)
    {
        CachedSettings = Cast<UProjectNameSettingsSave>(
            UGameplayStatics::CreateSaveGameObject(UProjectNameSettingsSave::StaticClass()));
    }
    const FString Slot = SettingsSlotName();
    if (PendingSaveSlots.Contains(Slot)) { return; }
    PendingSaveSlots.Add(Slot);

    UGameplayStatics::AsyncSaveGameToSlot(CachedSettings, Slot, 0,
        FAsyncSaveGameToSlotDelegate::CreateUObject(this, &USaveSubsystem::OnAsyncSaveDone));
}

void USaveSubsystem::LoadSettingsAsync()
{
    UGameplayStatics::AsyncLoadGameFromSlot(SettingsSlotName(), 0,
        FAsyncLoadGameFromSlotDelegate::CreateUObject(this, &USaveSubsystem::OnAsyncLoadDone));
}

UProjectNameCampaignSave* USaveSubsystem::GetCachedCampaignSave(int32 SlotIndex) const
{
    const TObjectPtr<UProjectNameCampaignSave>* Found = CachedCampaignSaves.Find(SlotIndex);
    return Found ? Found->Get() : nullptr;
}

void USaveSubsystem::OnAsyncSaveDone(const FString& SlotName, int32 UserIndex, bool bSuccess)
{
    PendingSaveSlots.Remove(SlotName);
    if (!bSuccess) { UE_LOG(LogTemp, Error, TEXT("Save failed: %s"), *SlotName); }
    OnSaveComplete.Broadcast(SlotName, bSuccess);
}

void USaveSubsystem::OnAsyncLoadDone(const FString& SlotName, int32 UserIndex, USaveGame* LoadedSave)
{
    if (!LoadedSave)
    {
        // Slot doesn't exist yet — create defaults
        if (SlotName == SettingsSlotName())
        {
            CachedSettings = Cast<UProjectNameSettingsSave>(
                UGameplayStatics::CreateSaveGameObject(UProjectNameSettingsSave::StaticClass()));
        }
        OnLoadComplete.Broadcast(SlotName, nullptr);
        return;
    }

    // Settings
    if (UProjectNameSettingsSave* Settings = Cast<UProjectNameSettingsSave>(LoadedSave))
    {
        Settings->Migrate();
        CachedSettings = Settings;
    }
    // Campaign
    else if (UProjectNameCampaignSave* Campaign = Cast<UProjectNameCampaignSave>(LoadedSave))
    {
        Campaign->Migrate();
        // Slot index extracted from name: "campaign_0" → 0
        int32 SlotIdx = FCString::Atoi(*SlotName.RightChop(9));
        CachedCampaignSaves.Add(SlotIdx, Campaign);
    }

    OnLoadComplete.Broadcast(SlotName, LoadedSave);
}
```

---

## Encryption

UE5's `ISaveGameSystem` plugin interface allows custom serialization. For tamper-resistance, wrap the binary blob with AES-256-GCM using `FEncryptionContext`:

```cpp
// EncryptedSaveHelper.h — thin wrapper, call before/after file write
#pragma once
#include "Misc/AES.h"

namespace EncryptedSaveHelper
{
    // Encrypts SaveData in-place using AES-256-CBC. Key must be 32 bytes.
    // Called automatically by USaveSubsystem before writing to disk.
    bool EncryptSaveData(TArray<uint8>& InOutData, const TArray<uint8>& Key);

    // Decrypts. Returns false if tampered (HMAC mismatch).
    bool DecryptSaveData(TArray<uint8>& InOutData, const TArray<uint8>& Key);

    // Derives the project key from a hardcoded seed + device GUID.
    // Never store the raw key in the binary or the save file.
    TArray<uint8> GetProjectSaveKey();
}
```

**Key derivation:** combine a compile-time secret (set in `Config/DefaultGame.ini` and stripped at ship) with `FPlatformMisc::GetDeviceId()`. The result is per-device — this prevents cloud save cheating on PC while remaining transparent on console (platform save is already encrypted by the OS).

For shipping builds, enable `bEncryptIniFiles=True` in `Config/DefaultCryptographySettings.ini` to prevent INI inspection as well.

---

## Checkpoint Autosave

Autosave on checkpoint: trigger from level Blueprint or a `UWorldSubsystem` checkpoint manager, never from a timer.

```cpp
// CheckpointSubsystem.cpp — fires when the player reaches a checkpoint trigger
void UCheckpointSubsystem::OnCheckpointReached(FName CheckpointTag)
{
    USaveSubsystem* SaveSys = GetGameInstance()->GetSubsystem<USaveSubsystem>();
    UProjectNameCampaignSave* Save = SaveSys->GetCachedCampaignSave(ActiveSlotIndex);
    if (!Save)
    {
        Save = Cast<UProjectNameCampaignSave>(
            UGameplayStatics::CreateSaveGameObject(UProjectNameCampaignSave::StaticClass()));
    }

    Save->Progress.LastCheckpointTag = CheckpointTag;
    Save->TotalPlaytimeSeconds += SessionPlaytimeSeconds;

    SaveSys->SaveCampaignAsync(ActiveSlotIndex, Save);

    // Bind the completion event to show autosave icon
    SaveSys->OnSaveComplete.AddDynamic(this, &UCheckpointSubsystem::OnSaveDone);
}
```

---

## Save Slot UI (Blueprint side)

Blueprint calls the subsystem — it never reads from disk directly:

```
Event BeginPlay
    → GetGameInstance → GetSubsystem(USaveSubsystem)
    → LoadCampaignAsync(SlotIndex=0)
    → Bind OnLoadComplete
        → Cast to UProjectNameCampaignSave
        → Set WBP_SaveSlot text from Progress.LastCheckpointTag
        → Set timestamp from LastSaved
```

---

## Key Rules

1. **Never call `UGameplayStatics::SaveGameToSlot` directly** — always go through `USaveSubsystem`. It deduplicates in-flight saves and owns the async lifecycle.
2. **One save class per domain** — campaign state, settings, and achievements are separate save objects. Do not grow a god save.
3. **Schema version on every save class** — bump and implement `Migrate()` for every struct change. Never silently break old save files.
4. **Async only** — `AsyncSaveGameToSlot` / `AsyncLoadGameFromSlot`. Synchronous save on the game thread causes visible hitches.
5. **`UPROPERTY(SaveGame)` is the serialization gate** — only properties tagged `SaveGame` are written. Never assume all `UPROPERTY` fields are saved.
6. **Encrypt save files in shipping** — call `EncryptedSaveHelper` before write, after read. Key is per-device, not per-save.
7. **No save during loading screen** — detect `bIsInLoadingScreen` and queue saves until the level is fully loaded.
8. **Console platform saves** — on PS5/Xbox, the platform OS owns encryption and cloud sync. Do not double-encrypt on console.
