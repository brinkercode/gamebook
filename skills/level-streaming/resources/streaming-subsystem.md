# ULevelStreamingSubsystem

```cpp
// LevelStreamingSubsystem.h
#pragma once
#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "LevelStreamingSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLevelLoaded, FName, LevelName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLevelUnloaded, FName, LevelName);

UCLASS()
class MYGAME_API ULevelStreamingSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="LevelStreaming")
    void LoadLevelAsync(FName LevelName, bool bMakeVisibleAfterLoad = true);

    UFUNCTION(BlueprintCallable, Category="LevelStreaming")
    void UnloadLevel(FName LevelName);

    UFUNCTION(BlueprintPure, Category="LevelStreaming")
    bool IsLevelLoaded(FName LevelName) const;

    UFUNCTION(BlueprintPure, Category="LevelStreaming")
    float GetLoadProgress(FName LevelName) const;

    UPROPERTY(BlueprintAssignable)
    FOnLevelLoaded OnLevelLoaded;

    UPROPERTY(BlueprintAssignable)
    FOnLevelUnloaded OnLevelUnloaded;

private:
    TSet<FName> LoadedLevels;
    TSet<FName> LoadingLevels;

    UFUNCTION()
    void OnStreamLevelLoaded();
};
```

```cpp
// LevelStreamingSubsystem.cpp
#include "LevelStreamingSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/LevelStreamingDynamic.h"

void ULevelStreamingSubsystem::LoadLevelAsync(FName LevelName, bool bMakeVisibleAfterLoad)
{
    if (LoadedLevels.Contains(LevelName) || LoadingLevels.Contains(LevelName)) return;

    LoadingLevels.Add(LevelName);

    FLatentActionInfo LatentInfo;
    LatentInfo.CallbackTarget = this;
    LatentInfo.ExecutionFunction = GET_FUNCTION_NAME_CHECKED(
        ULevelStreamingSubsystem, OnStreamLevelLoaded);
    LatentInfo.Linkage = static_cast<int32>(GetTypeHash(LevelName));
    LatentInfo.UUID   = static_cast<int32>(GetTypeHash(LevelName));

    UGameplayStatics::LoadStreamLevel(
        GetWorld(), LevelName, bMakeVisibleAfterLoad, false, LatentInfo);
}

void ULevelStreamingSubsystem::OnStreamLevelLoaded()
{
    // Identify which level completed — iterate to find
    for (ULevelStreaming* StreamedLevel : GetWorld()->GetStreamingLevels())
    {
        FName LevelName = FName(*FPackageName::GetShortName(
            StreamedLevel->GetWorldAssetPackageName()));
        if (LoadingLevels.Contains(LevelName) && StreamedLevel->IsLevelLoaded())
        {
            LoadingLevels.Remove(LevelName);
            LoadedLevels.Add(LevelName);
            OnLevelLoaded.Broadcast(LevelName);
            break;
        }
    }
}

void ULevelStreamingSubsystem::UnloadLevel(FName LevelName)
{
    if (!LoadedLevels.Contains(LevelName)) return;

    FLatentActionInfo LatentInfo;
    LatentInfo.CallbackTarget   = this;
    LatentInfo.ExecutionFunction = FName("OnLevelUnloadComplete");
    LatentInfo.Linkage = 0;
    LatentInfo.UUID   = 0;

    UGameplayStatics::UnloadStreamLevel(GetWorld(), LevelName, LatentInfo, false);
    LoadedLevels.Remove(LevelName);
    OnLevelUnloaded.Broadcast(LevelName);
}

bool ULevelStreamingSubsystem::IsLevelLoaded(FName LevelName) const
{
    return LoadedLevels.Contains(LevelName);
}

float ULevelStreamingSubsystem::GetLoadProgress(FName LevelName) const
{
    for (ULevelStreaming* StreamedLevel : GetWorld()->GetStreamingLevels())
    {
        FName Name = FName(*FPackageName::GetShortName(
            StreamedLevel->GetWorldAssetPackageName()));
        if (Name == LevelName)
        {
            return StreamedLevel->GetLoadedLevel() ? 1.0f : 0.5f; // approximate
        }
    }
    return 0.0f;
}
```
