# UDialogueSubsystem — World Subsystem

```cpp
// DialogueSubsystem.h
#pragma once
#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "DA_DialogueTree.h"
#include "DialogueSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnDialogueLineChanged,
    const UDA_DialogueLine*, Line, const TArray<UDA_DialogueResponse*>&, Responses);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDialogueEnded, FName, DialogueID);

UCLASS()
class MYGAME_API UDialogueSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="Dialogue")
    void StartDialogue(UDA_DialogueTree* Tree, AActor* InstigatorActor);

    UFUNCTION(BlueprintCallable, Category="Dialogue")
    void SelectResponse(int32 ResponseIndex);

    UFUNCTION(BlueprintCallable, Category="Dialogue")
    void AdvanceLine(); // for auto-advance and audio-log style

    UFUNCTION(BlueprintPure, Category="Dialogue")
    bool IsDialogueActive() const { return bIsDialogueActive; }

    UPROPERTY(BlueprintAssignable)
    FOnDialogueLineChanged OnDialogueLineChanged;

    UPROPERTY(BlueprintAssignable)
    FOnDialogueEnded OnDialogueEnded;

private:
    bool bIsDialogueActive = false;
    int32 CurrentLineIndex = 0;

    UPROPERTY()
    TObjectPtr<UDA_DialogueTree> ActiveTree;

    UPROPERTY()
    TObjectPtr<AActor> ActiveInstigator;

    void ShowLine(int32 LineIndex);
    void EndDialogue();
    void PlayLineAudio(const UDA_DialogueLine* Line);
};
```

```cpp
// DialogueSubsystem.cpp
void UDialogueSubsystem::StartDialogue(UDA_DialogueTree* Tree, AActor* InstigatorActor)
{
    if (!Tree || bIsDialogueActive) return;

    ActiveTree = Tree;
    ActiveInstigator = InstigatorActor;
    bIsDialogueActive = true;
    CurrentLineIndex = 0;

    ShowLine(0);
}

void UDialogueSubsystem::ShowLine(int32 LineIndex)
{
    if (!ActiveTree || !ActiveTree->Lines.IsValidIndex(LineIndex))
    {
        EndDialogue();
        return;
    }

    CurrentLineIndex = LineIndex;
    const UDA_DialogueLine* Line = ActiveTree->Lines[LineIndex];

    // Gather responses for this line (may be empty for monologue lines)
    TArray<UDA_DialogueResponse*> Responses;
    if (const TArray<UDA_DialogueResponse*>* Found =
            ActiveTree->ResponsesPerLine.Find(LineIndex))
    {
        Responses = *Found;
    }

    PlayLineAudio(Line);
    OnDialogueLineChanged.Broadcast(Line, Responses);

    // Auto-advance if configured and no player responses
    if (Line->AutoAdvanceDelay > 0.f && Responses.IsEmpty())
    {
        FTimerHandle TimerHandle;
        GetWorld()->GetTimerManager().SetTimer(
            TimerHandle, [this, Line]() { AdvanceLine(); },
            Line->AutoAdvanceDelay, false);
    }
}

void UDialogueSubsystem::SelectResponse(int32 ResponseIndex)
{
    if (!ActiveTree || !bIsDialogueActive) return;

    const TArray<UDA_DialogueResponse*>* Responses =
        ActiveTree->ResponsesPerLine.Find(CurrentLineIndex);
    if (!Responses || !(*Responses).IsValidIndex(ResponseIndex)) return;

    int32 NextIndex = (*Responses)[ResponseIndex]->NextLineIndex;
    ShowLine(NextIndex);
}

void UDialogueSubsystem::AdvanceLine()
{
    if (!ActiveTree || !bIsDialogueActive) return;
    const UDA_DialogueLine* Line = ActiveTree->Lines[CurrentLineIndex];
    ShowLine(Line->DefaultNextIndex);
}

void UDialogueSubsystem::EndDialogue()
{
    if (ActiveTree && ActiveInstigator)
    {
        // Fire completion event via GAS
        if (ActiveTree->OnCompleteEventTag.IsValid())
        {
            UAbilitySystemBlueprintLibrary::SendGameplayEventToActor(
                ActiveInstigator, ActiveTree->OnCompleteEventTag, FGameplayEventData());
        }
    }

    bIsDialogueActive = false;
    OnDialogueEnded.Broadcast(ActiveTree ? ActiveTree->DialogueID : NAME_None);
    ActiveTree = nullptr;
    ActiveInstigator = nullptr;
}

void UDialogueSubsystem::PlayLineAudio(const UDA_DialogueLine* Line)
{
    if (!Line || Line->WwiseEventName.IsNone()) return;
    // Fire Wwise event on the instigator (NPC) actor
    if (UAkComponent* AkComp = ActiveInstigator
            ? ActiveInstigator->FindComponentByClass<UAkComponent>() : nullptr)
    {
        AkComp->PostAkEvent(
            FAkAudioEvent::StaticClass()->GetDefaultObject<UAkAudioEvent>(),
            // In practice, look up event by name from Wwise asset registry
            Line->WwiseEventName.ToString());
    }
}
```
