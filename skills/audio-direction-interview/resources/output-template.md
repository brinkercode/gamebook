# AUDIO_DIRECTION.md — Template

---

# Audio Direction: {{ Project Name }}

## Audio Identity

**One-sentence audio statement:** {{ e.g., "Weapons sound mechanical and final; silence between kills is the reward" }}

**SFX tone words:** {{ word1 }} · {{ word2 }} · {{ word3 }}

**Most important SFX:** {{ the one that must be perfect }}

## Middleware

**Primary:** {{ Wwise 2023.1.x / MetaSounds }}

**Wwise Spatial Audio:** {{ Enabled / Disabled }}

**Version pinned in:** `Plugins/Wwise/` — match UE5.4 integration build

## Music

**Combat:** {{ genre, instrumentation }}

**Exploration:** {{ genre, instrumentation }}

**Main theme:** {{ Yes — motif description / No }}

**Music-absent zones:** {{ list or "none" }}

**Dynamic range target:** {{ description }}

**Reactive or static:** {{ Wwise State/Switch-driven layers / Streamed cues }}

## SFX Language

**Weapon sounds:** {{ Synthesized / Recorded / Hybrid }}

**Enemy vocalizations:** {{ Critical gameplay read / Ambient flavor }}

**UI sound design:** {{ Minimal / Arcade-punchy / Diegetic / Silent }}

## Ambience

**Primary ambience description:** {{ one sentence }}

**Ambience zones in vertical slice:** {{ count + names }}

**Foley:** {{ Yes (footstep variants: {{ materials }}) / No }}

**Diegetic music sources:** {{ list or "none" }}

## Wwise Structure

**Bus hierarchy:** see `resources/implementation-mapping.md` — default hierarchy applies with these modifications: {{ list any changes }}

**RTPCs:**

| RTPC | Driven by | Effect |
|---|---|---|
| `RTPC_CombatIntensity` | {{ source }} | {{ effect }} |
| `RTPC_PlayerHealth` | GAS `OnRep_Health` | {{ effect }} |
| `RTPC_Speed` | Character velocity | {{ effect }} |

**State Groups:**

```
StateGroup: NarrativeZone
  States: {{ list from docs/NARRATIVE.md }}

StateGroup: CombatState
  States: Idle, Alert, Combat, PlayerDown

StateGroup: MusicMode
  States: Exploration, Combat, Cinematic, MainMenu, PauseMenu
```

**Event naming convention:** `Play_<Category>_<Asset>_<Variant>`

## Mixing Philosophy

**Combat ducking:** Ambience Bus -{{ n }} dB at full combat intensity; {{ n }}s recovery

**Master limiter:** {{ threshold }} dBFS

## References

| Reference | What we take |
|---|---|
| {{ game / film }} | {{ specific element }} |
