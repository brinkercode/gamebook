# Audio

> Wwise project structure, MetaSounds fallback, mix hierarchy, and integration conventions for {{PROJECT_NAME}}.

## Middleware

Primary: **{{AUDIO_MIDDLEWARE}}** (set at scaffold time — Wwise or MetaSounds).

If Wwise:
- Wwise project: `WwiseAudio/{{PROJECT_NAME}}.wproj`
- Integration plugin: `Plugins/Wwise/` (AudioKinetic Wwise UE plugin)
- SoundBanks generated to: `WwiseAudio/GeneratedSoundBanks/`

If MetaSounds:
- All sources in `Content/Audio/MetaSounds/`
- No external project file — all authoring in-editor.

## Bus / Mix Hierarchy (Wwise)

```
Master Audio Bus
  ├─ Music Bus         (BGM, adaptive music)
  ├─ SFX Bus
  │    ├─ Weapons Bus  (gunfire, impacts, reloads)
  │    ├─ Footsteps Bus
  │    ├─ Ambient Bus  (loops, wind, environmental)
  │    └─ UI Bus       (menus, HUD feedback)
  └─ VO Bus
       ├─ Dialogue Bus (in-game conversation)
       └─ AudioLog Bus (collectible audio logs)
```

## RTPC (Real-Time Parameter Controls)

| RTPC name | Range | Driven by |
|---|---|---|
| `RTPC_PlayerHealth` | 0–100 | `UGAS_HealthSet::Health` via `UAudioStateSubsystem` |
| `RTPC_EncounterIntensity` | 0–1 | `UEncounterDirectorSubsystem` |
| `RTPC_MasterVolume` | 0–100 | Player settings save slot |
| `RTPC_MusicVolume` | 0–100 | Player settings save slot |
| `RTPC_SFXVolume` | 0–100 | Player settings save slot |

## Wwise States

| State Group | States | When set |
|---|---|---|
| `GameState` | `MainMenu`, `Gameplay`, `Paused`, `Cinematic` | `UAudioStateSubsystem` |
| `EncounterState` | `Exploration`, `Combat`, `PostCombat` | `UEncounterDirectorSubsystem` |
| `NarrativeState` | _(populated per act)_ | Narrative triggers |

## Integration Rules

All audio routed through `UAudioStateSubsystem`. Never call Wwise/MetaSounds APIs directly from gameplay code:

```cpp
// Good:
AudioStateSubsystem->PostEvent(EWwiseEvent::Weapon_Fire, SourceActor);
AudioStateSubsystem->SetRTPC(EWwiseRTPC::PlayerHealth, NewHealth);

// Never:
AkComponent->PostAkEvent(SomeEvent, ...);
UGameplayStatics::PlaySoundAtLocation(this, SoundWave, Location);
```

## Footstep System

- Driven by `UPhysicalMaterial` surface type on hit actor.
- `DT_FootstepSounds` maps `EPhysicalSurface` → `FWwiseEventRef` (or `UMetaSoundSource`).
- Trigger: `AnimNotify_Footstep` calls `UAudioStateSubsystem::PlayFootstep(SurfaceType, Location)`.

## Adaptive Music

- Wwise Music Segments for exploration / combat / boss — transition rules in Wwise project.
- `UEncounterDirectorSubsystem` calls `AudioStateSubsystem->SetState(EncounterState, Combat)` on encounter start.

## Audio Budgets

- Simultaneous voices: max 64 (hardware limited to 32 on consoles).
- Background ambience loops: max 8 active.
- Voice channels: max 16 simultaneous.
- See [PERFORMANCE_BUDGETS.md](PERFORMANCE_BUDGETS.md) for integrated budget table.
