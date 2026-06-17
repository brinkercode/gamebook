# Narrative

> Story, dialogue, audio logs, and Wwise event hookup for {{PROJECT_NAME}}.

## Story Overview

_(2–3 paragraphs: premise, protagonist, central conflict, stakes)_

## Structure

| Act | Beats | Status |
|---|---|---|
| Act 1 | _(list beats)_ | _(planned/done)_ |
| Act 2 | _(list beats)_ | _(planned/done)_ |
| Act 3 | _(list beats)_ | _(planned/done)_ |

## Characters

| Name | Role | Voice actor (if cast) |
|---|---|---|
| _(Protagonist)_ | Player character | _(TBD)_ |
| _(Supporting)_ | _(role)_ | _(TBD)_ |

## Dialogue System

- Dialogue trees implemented as Blueprint `UDialogueWave` assets (simple) or custom `UDialogueTree` Data Asset (branching).
- All voiced lines referenced via `DA_DialogueLine_<ID>` — never hard-reference `USoundWave` directly.
- Subtitles auto-generated from `DA_DialogueLine_<ID>.SubtitleText` — do not duplicate in UMG.

## Audio Logs

- Type: `DA_AudioLog_<ID>` (Primary Data Asset).
- Fields: `Title`, `Body` (string), `WwiseEvent` (or `MetaSoundAsset`), `UnlockTag` (`FGameplayTag`).
- Pickup trigger: `ATriggerBox` in level → calls `UAudioStateSubsystem::UnlockAudioLog(FName LogId)`.
- Codex UI: `WB_AudioLog_Codex` reads from `UAudioStateSubsystem` — no direct level dependency.

## Wwise Event Hookup

All narrative audio routes through `UAudioStateSubsystem`:

```cpp
// Good:
AudioStateSubsystem->PlayDialogueLine(DialogueLineDA, WorldContextObject);

// Never:
UGameplayStatics::PlaySoundAtLocation(this, RawSoundWave, Location);
```

Wwise Events for dialogue: `Play_VO_<Character>_<LineId>`.
Wwise Events for audio logs: `Play_AudioLog_<LogId>`.
Wwise States for ambient narrative (e.g., post-boss): `NarrativeState_<ActName>`.

## Localization

- All display strings in `NSLOCTEXT("{{PROJECT_NAME}}", "Key", "Default text")` macros.
- Localization target: `Config/Localization/Game.ini`.
- Do not hardcode strings in Blueprint String pins — use FText variables bound to the loc table.

## Narrative Out of Scope (vertical slice)

_(list story beats / characters explicitly deferred post-slice)_
