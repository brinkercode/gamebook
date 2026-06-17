# Wwise Hookup for Dialogue

## Wwise Event Naming Convention

```
Play_VO_<NPCName>_<LineID>_<Take>
  e.g.  Play_VO_Guard_Line001_01
        Play_VO_AudioLog_02_01
Stop_VO_<NPCName>     (used when player skips a line mid-playback)
```

## NPC Actor Setup

Add `UAkComponent` to the NPC Blueprint:
- Component name: `AkVoiceComponent`
- Attenuation: use `AK_Attenuation_VO` (dialogue should not attenuate to zero — set min distance large)
- Bus: routes to `Enemy_VO_Bus` in the Wwise bus hierarchy

## Posting Events from UDialogueSubsystem

Replace the stub in `PlayLineAudio` with a proper asset lookup:

```cpp
void UDialogueSubsystem::PlayLineAudio(const UDA_DialogueLine* Line)
{
    if (!Line || Line->WwiseEventName.IsNone() || !ActiveInstigator) return;

    UAkComponent* AkComp = ActiveInstigator->FindComponentByClass<UAkComponent>();
    if (!AkComp) return;

    // Resolve Wwise event by name — requires Wwise asset registered in content
    UAkAudioEvent* Event = LoadObject<UAkAudioEvent>(
        nullptr,
        *FString::Printf(TEXT("/Game/Audio/Dialogue/%s"),
                         *Line->WwiseEventName.ToString()));
    if (Event)
    {
        AkComp->PostAkEvent(Event, int32(AkCallbackType::AK_EndOfEvent),
            FOnAkPostEventCallback());
    }
}
```

Store `UAkAudioEvent*` references directly on `UDA_DialogueLine` for efficiency:

```cpp
// Better: store the asset ref directly
UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Dialogue|Audio")
TSoftObjectPtr<UAkAudioEvent> VoiceEvent;
```

Load synchronously before playback or async-load on tree start.

## Audio Log Variant

For collectible audio logs (no NPC actor present):
- Spawn a `UAkComponent` on the player or HUD
- Auto-advance via `AK_EndOfEvent` callback → `UDialogueSubsystem::AdvanceLine()`

```cpp
AkComp->PostAkEvent(Event, int32(AkCallbackType::AK_EndOfEvent),
    FOnAkPostEventCallback::CreateLambda([this](EAkCallbackType, UAkCallbackInfo*) {
        GetWorld()->GetSubsystem<UDialogueSubsystem>()->AdvanceLine();
    }));
```

## Stop on Skip

When the player skips a voice line mid-playback:

```cpp
void UDialogueSubsystem::SkipCurrentLine()
{
    if (!ActiveInstigator) return;
    if (UAkComponent* AkComp = ActiveInstigator->FindComponentByClass<UAkComponent>())
    {
        // Post the matching Stop event
        FName StopEventName = FName(*FString::Printf(TEXT("Stop_VO_%s"),
            *ActiveTree->Lines[CurrentLineIndex]->SpeakerName.ToString()));
        // Load and post stop event...
    }
    AdvanceLine();
}
```
