# Save File Encryption (XOR + Checksum)

UE5's `AsyncSaveGameToSlot` writes the serialized `USaveGame` to disk as a binary `.sav` file. This is not encrypted by default. The approach below wraps the binary data in an XOR cipher and a CRC32 checksum to resist casual hex editing.

This is not cryptographically secure — a determined attacker can reverse XOR with the key. It deters casual save scumming, not server-authoritative cheat detection.

## SaveEncryption.h

```cpp
#pragma once
#include "CoreMinimal.h"

class MYGAME_API FSaveEncryption
{
public:
    // XOR key — change per project, keep secret in source (not a real crypto key)
    static constexpr uint8 XorKey = 0xA7;

    static TArray<uint8> Encrypt(const TArray<uint8>& PlainData);
    static bool Decrypt(const TArray<uint8>& CipherData, TArray<uint8>& OutPlainData);

private:
    static uint32 ComputeChecksum(const TArray<uint8>& Data);
};
```

## SaveEncryption.cpp

```cpp
#include "SaveEncryption.h"
#include "Misc/Crc.h"

TArray<uint8> FSaveEncryption::Encrypt(const TArray<uint8>& PlainData)
{
    // Prepend 4-byte checksum, then XOR the whole thing
    uint32 Checksum = ComputeChecksum(PlainData);

    TArray<uint8> Combined;
    Combined.SetNum(4 + PlainData.Num());
    FMemory::Memcpy(Combined.GetData(), &Checksum, 4);
    FMemory::Memcpy(Combined.GetData() + 4, PlainData.GetData(), PlainData.Num());

    for (uint8& Byte : Combined)
    {
        Byte ^= XorKey;
    }
    return Combined;
}

bool FSaveEncryption::Decrypt(const TArray<uint8>& CipherData, TArray<uint8>& OutPlainData)
{
    if (CipherData.Num() < 4) return false;

    TArray<uint8> Combined = CipherData;
    for (uint8& Byte : Combined)
    {
        Byte ^= XorKey;
    }

    uint32 StoredChecksum;
    FMemory::Memcpy(&StoredChecksum, Combined.GetData(), 4);

    OutPlainData.SetNum(Combined.Num() - 4);
    FMemory::Memcpy(OutPlainData.GetData(), Combined.GetData() + 4, OutPlainData.Num());

    uint32 ComputedChecksum = ComputeChecksum(OutPlainData);
    if (StoredChecksum != ComputedChecksum)
    {
        UE_LOG(LogTemp, Warning, TEXT("FSaveEncryption: Checksum mismatch — save file tampered or corrupt"));
        return false;
    }
    return true;
}

uint32 FSaveEncryption::ComputeChecksum(const TArray<uint8>& Data)
{
    return FCrc::MemCrc32(Data.GetData(), Data.Num());
}
```

## Integration with USaveGameSubsystem

UE5's `AsyncSaveGameToSlot` does not support custom serialization hooks directly. To apply encryption:

1. Serialize manually before saving: `UGameplayStatics::SaveGameToMemory(SaveGame)` → encrypt → write raw bytes to `FFileHelper::SaveArrayToFile`.
2. Reverse on load: read raw bytes → decrypt → `UGameplayStatics::LoadGameFromMemory`.

```cpp
// Encrypted save — replaces AsyncSaveGameToSlot
void USaveGameSubsystem::SaveAsync(FName SlotName, int32 UserIndex)
{
    TArray<uint8> PlainBytes;
    if (!UGameplayStatics::SaveGameToMemory(CurrentSave, PlainBytes)) return;

    TArray<uint8> EncryptedBytes = FSaveEncryption::Encrypt(PlainBytes);

    FString FilePath = FPaths::ProjectSavedDir() / TEXT("SaveGames") /
        SlotName.ToString() + TEXT(".sav");

    AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [EncryptedBytes, FilePath, this]() {
        bool bOK = FFileHelper::SaveArrayToFile(EncryptedBytes, *FilePath);
        AsyncTask(ENamedThreads::GameThread, [bOK, this]() {
            OnSaveComplete.Broadcast(bOK);
        });
    });
}
```
