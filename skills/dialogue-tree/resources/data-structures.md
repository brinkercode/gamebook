# Dialogue Data Structures

## UDA_DialogueLine

```cpp
UCLASS(BlueprintType)
class MYGAME_API UDA_DialogueLine : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    FText SpeakerName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    FText LineText;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    FName WwiseEventName; // e.g. "Play_VO_Guard_Line001_01"

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    float AutoAdvanceDelay = 0.0f; // 0 = wait for input; >0 = auto-advance after N seconds

    // Next node index in UDA_DialogueTree.Lines array
    // -1 = end of tree
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    int32 DefaultNextIndex = -1;
};
```

## UDA_DialogueResponse (player choice)

```cpp
UCLASS(BlueprintType)
class MYGAME_API UDA_DialogueResponse : public UObject
{
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FText ResponseText;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    int32 NextLineIndex = -1; // index into UDA_DialogueTree.Lines
};
```

## UDA_DialogueTree

```cpp
UCLASS(BlueprintType)
class MYGAME_API UDA_DialogueTree : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    FName DialogueID; // unique, used for save flags

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    TArray<TObjectPtr<UDA_DialogueLine>> Lines;

    // Per-line player response options. Key = line index, Value = list of responses
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    TMap<int32, TArray<UDA_DialogueResponse*>> ResponsesPerLine;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    bool bCanRepeat = false; // true = can replay after first completion

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue")
    FGameplayTag OnCompleteEventTag; // fired via SendGameplayEventToActor on tree end

    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId("DialogueTree", GetFName());
    }
};
```

## Content Naming

```
Content/Data/Dialogue/DA_Dialogue_<NPCName>.uasset
Content/Data/Dialogue/DA_Dialogue_AudioLog_<LogID>.uasset
```

All dialogue trees in `Content/Data/Dialogue/`. Asset Manager scans this folder (add to `DefaultGame.ini` PrimaryAssetTypesToScan same pattern as WeaponData).
