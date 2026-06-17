# Audio Decisions → Wwise / MetaSounds Implementation

---

## Wwise Bus Hierarchy (default)

```
Master Audio Bus
├── Music Bus
│   ├── Combat_Music_Bus
│   └── Exploration_Music_Bus
├── SFX Bus
│   ├── Weapons_Bus
│   ├── Footsteps_Bus
│   ├── UI_Bus
│   └── Enemy_VO_Bus
└── Ambience Bus
    └── (one child bus per named zone)
```

All buses feed through a Master Limiter on Master Audio Bus.

## RTPC (Real-Time Parameter Controls)

| RTPC Name | Range | Driven by | Effect |
|---|---|---|---|
| `RTPC_CombatIntensity` | 0–100 | Blueprint: enemies in range / damage events | Music layer blending; SFX Bus compression |
| `RTPC_PlayerHealth` | 0–100 | GAS `OnRep_Health` → `UAkComponent::SetRTPCValue` | Music distortion / heartbeat layer |
| `RTPC_Speed` | 0–600 (UU/s) | Character velocity magnitude | Footstep pitch; wind SFX |
| `RTPC_AmbienceZone` | 0–N | Ambience volume trigger → `SetRTPCValue` | Crossfade between zone ambience layers |

## Wwise State Groups

From `docs/NARRATIVE.md` — carry over and add:

```
StateGroup: NarrativeZone
  States: (from narrative interview)

StateGroup: CombatState
  States: Idle, Alert, Combat, PlayerDown

StateGroup: MusicMode
  States: Exploration, Combat, Cinematic, MainMenu, PauseMenu
```

## Wwise Event Naming Convention

```
Play_<Category>_<Asset>_<Variant>
  e.g. Play_Weapon_Rifle_Fire_01
       Play_Footstep_Concrete_Walk
       Play_Music_Combat_Intro
       Play_VO_AudioLog_001
       Stop_Music_Combat
       Pause_Ambience_Zone_01
```

## MetaSounds (fallback — Wwise not used)

Replace Wwise state machine integration with:

```cpp
// In character Blueprint or C++:
UMetaSoundSource* CombatMusic = ...; // set in editor
UAudioComponent* AudioComp = UGameplayStatics::SpawnSound2D(this, CombatMusic);
AudioComp->SetFloatParameter(FName("CombatIntensity"), IntensityValue);
```

MetaSound graph exposes `CombatIntensity` (float) and `NarrativeZone` (int32) as input parameters. No state machine = developer must drive transitions manually from Blueprint.

## Wwise Spatial Audio Setup

If Spatial Audio is enabled:
1. Add `UAkRoomComponent` to each room actor in the level
2. Add `UAkPortalComponent` to each doorway/opening actor
3. Set `Spatial Audio` category on Ambience events (not SFX — too expensive)
4. `UAkComponent` on player character must have `Spatial Audio` distance probe enabled

## Combat Ducking

In Wwise: create a Side-Chain on Ambience Bus, source = SFX Bus / Weapons_Bus, threshold = -18 dBFS, ratio = 8:1, attack = 10ms, release = 2000ms.

In UE5: drive via `RTPC_CombatIntensity`. Ambience Bus gain = lerp(0 dB, -12 dB, CombatIntensity/100).
