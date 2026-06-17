# Narrative Decisions → Game Systems Required

---

## Dialogue

| Feature | System required |
|---|---|
| NPC dialogue with branching | `dialogue-tree` skill; `UDA_DialogueTree` data asset; `WB_DialogueWidget` |
| Silent protagonist | Dialogue trees need no protagonist voice lines; branch choices shown as text only |
| Voiced protagonist | Additional `UAkAudioEvent` per branch; VO recording pipeline needed |
| Faction reaction system | Reputation `UAttributeSet` with per-faction float attributes; `GE_FactionReputation` effect |

## Audio Logs

| Feature | System required |
|---|---|
| Collectible audio logs | `pickup-system` skill; `BP_AudioLogPickup`; `DA_AudioLog` data asset with Wwise event ref |
| Wwise voice playback | `UAkComponent` on pickup actor; `UAkAudioEvent` per log; `interaction-system` skill for trigger |

## Level Streaming and Narrative Zones

| Narrative beat | Level streaming implication |
|---|---|
| Distinct act locations | Separate sub-level per act; `level-streaming` skill handles async load |
| Flashback sequences | Streaming level with post-process override; `UGameplayStatics::SetGlobalTimeDilation` for slow-mo |
| Twist / world-state change | `UWorldSubsystem` tracks narrative state; streaming levels swapped on flag |

## Content Rating

| Rating | Hard constraints |
|---|---|
| T (ESRB) | No dismemberment; blood is minimal/stylized; no explicit sexual content; mild language only |
| M (ESRB) | Dismemberment allowed with opt-in toggle; strong language; mature themes |
| AO (ESRB) | Not targeted — platform storefronts (Steam, PSN) restrict AO games |

## Wwise State Machines (name these before audio-direction interview)

Every narrative zone transition must map to a named Wwise State Group and State:

```
StateGroup: NarrativeZone
  States: Prologue, Act1_Exploration, Act1_Combat, Act2_MidPoint, VerticalSlice_End
```

Give `narrative-content-author` this state list before Wwise event authoring begins.
