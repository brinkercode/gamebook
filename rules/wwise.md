---
paths:
  - "Source/**/Audio/**"
  - "Content/Audio/**"
  - "Plugins/Wwise/**"
---

# Wwise Integration Rules

## Stack

- **Wwise 2023.x+ with the UE5 integration plugin** — `AkAudio` in `<Project>.Build.cs` `PublicDependencyModuleNames`.
- **MetaSounds as fallback** — used only on projects where the scaffolder explicitly set `audio: metasounds`. All other projects are Wwise-only.
- **Never mix Wwise and UE sound cues in gameplay code** — pick one per project and stick to it.

## Key concepts

| Wwise concept | Maps to |
|---|---|
| Event | One-shot trigger (`Play_Gunshot_Rifle`, `Stop_Music_Combat`) |
| Switch | Variations of the same sound by surface/state (`Surface_Material: Concrete/Metal/Wood`) |
| State | Global game state that affects mixing (`GameState: InGame/Paused/MainMenu`) |
| RTPC (Real-Time Parameter Control) | Continuous parameter fed from C++ (`PlayerHealth`, `VehicleSpeed`, `CombatIntensity`) |
| Bank | Preloaded group of audio assets (`Bank_Player`, `Bank_Weapons`, `Bank_UI`) |
| Auxiliary Send | Reverb and room effects (`AuxBus_Reverb_Cave`, `AuxBus_Reverb_Metal`) |

## Posting events from C++

```cpp
#include "AkGameplayStatics.h"
#include "AkComponent.h"

// One-shot at a location (no component needed)
UAkGameplayStatics::PostEvent(
    GunfireEvent,              // UAkAudioEvent* — UPROPERTY on the actor
    this,                      // Game object for spatialization
    false                      // bStopWhenOwnerDestroyed
);

// Attached to an actor component (looping — e.g., engine sound)
UAkComponent* AkComp = UAkGameplayStatics::GetAkComponent(
    VehicleMesh, FName("ExhaustSocket"), FVector::ZeroVector, true);
AkComp->PostAssociatedAkEvent(EngineLoopEvent, false);

// Stop a looping event
AkComp->StopAll();   // or post a matching Stop_ event
```

- **Store `UAkAudioEvent*` as `UPROPERTY(EditDefaultsOnly, Category="Audio")`** on the actor. Never hard-code Wwise event name strings in C++ — reference the asset.
- **One `UAkComponent` per sound source** — don't share a single component for multiple spatial sounds on the same actor.
- **Stop looping events explicitly** — looping Wwise events tied to a destroyed actor will continue playing in Wwise unless stopped. Call `StopAll()` or post the matching `Stop_` event in `EndPlay`.

## Switch and State

```cpp
// Set a Switch on a specific game object (per-actor material surface)
UAkGameplayStatics::SetSwitch(
    SurfaceMaterialSwitch,     // UAkSwitchValue* — UPROPERTY
    this                       // game object scope
);

// Set global State (affects all objects in the session)
UAkGameplayStatics::SetState(
    CombatStateGroup,          // UAkStateValue* — UPROPERTY
    CombatStateValue
);
```

- **Switches are per-game-object** — use for per-actor variations (footstep surface, weapon material).
- **States are global** — use sparingly for session-wide mixing states (`CombatIntense`, `Menu`, `Victory`). Changing state too frequently causes audible crossfade churn.
- **Define all Switches and States in a C++ enum** and a companion lookup table — never pass raw `FString` switch names. They're typo-prone and un-autocompleted.

## RTPC (Real-Time Parameter Control)

```cpp
// Set an RTPC value on a specific game object
UAkGameplayStatics::SetRTPCValue(
    HealthRTPC,                // UAkRtpc* — UPROPERTY
    CurrentHealthPercent,      // float [0.0 – 1.0] or whatever range Wwise expects
    0,                         // InterpolationTimeMs — 0 for immediate
    this
);

// Global RTPC (not game-object-scoped)
UAkGameplayStatics::SetRTPCValue(CombatIntensityRTPC, IntensityValue, 0, nullptr);
```

- **Normalize RTPC ranges to [0.0, 1.0] on the UE side** — Wwise maps those to whatever internal range it needs. It's easier to reason about `0.0 = no health, 1.0 = full health`.
- **Update RTPCs on attribute change, not every tick** — bind to `OnAttributeValueCommitted` or a GAS delegate. Never set an RTPC inside `Tick`.
- **Clamp RTPC values before sending** — `FMath::Clamp(Value, 0.0f, 1.0f)`. Out-of-range RTPC values produce undefined Wwise behavior.

## Bank management

Banks are registered in Wwise and loaded/unloaded from C++ based on the game context.

```cpp
// In a GameInstanceSubsystem — load banks relevant to the current level
void UAudioSubsystem::LoadBanksForLevel(const FString& LevelName)
{
    TArray<UAkAudioBank*> BanksToLoad;
    if (LevelName.Contains(TEXT("Zone_01")))
    {
        BanksToLoad.Add(Zone01Bank);
    }
    BanksToLoad.Add(PlayerBank);     // Always loaded during gameplay
    BanksToLoad.Add(WeaponsBank);

    for (UAkAudioBank* Bank : BanksToLoad)
    {
        UAkGameplayStatics::LoadBank(Bank, false, false);
    }
}

void UAudioSubsystem::UnloadAllLevelBanks()
{
    for (UAkAudioBank* Bank : LoadedLevelBanks)
    {
        UAkGameplayStatics::UnloadBank(Bank);
    }
    LoadedLevelBanks.Empty();
}
```

- **Always-loaded banks**: `Bank_Player`, `Bank_UI`, `Bank_Music` — loaded on game start, never unloaded during a session.
- **Level-streamed banks**: `Bank_Zone_01`, `Bank_Enemies_Forest` — loaded before the level streams in, unloaded after streaming out.
- **Weapon banks**: loaded when the weapon is equipped, unloaded when unequipped (if weapons are swappable and bank size justifies it).
- **Never call `LoadBank` from a gameplay thread mid-combat** — it stalls the audio thread. Preload before the player enters the relevant area using level streaming callbacks.

## Spatialization and occlusion

- **`UAkComponent` handles spatialization automatically** when attached to an actor. No manual `SetListenerTransform` required — `AkAudio` reads from the `APlayerCameraManager`.
- **Occlusion via Wwise's built-in obstruction/occlusion** — enable `UseReverbVolumes` on the `AkComponent`. Don't ray-cast manually from C++ to feed Wwise; it has a built-in obstruction solver.
- **Aux sends for reverb zones** — define `AkReverbVolume` actors in the level for interior spaces. The `AkComponent` picks up the aux send automatically when inside the volume.

## Automation and testing

- **Mock audio in non-audio environments** — in headless Functional Tests and CI cooks, Wwise should be in `NoSoundDevice` mode. Set `AkAudio.bDisableAudio=True` in `DefaultEngine.ini` for test configs.
- **`UAudioSubsystem` wraps all Wwise calls** — gameplay code calls `AudioSubsystem->PlayGunfire(WeaponData)`, not `UAkGameplayStatics::PostEvent` directly. The subsystem can be swapped for a null implementation in tests.
