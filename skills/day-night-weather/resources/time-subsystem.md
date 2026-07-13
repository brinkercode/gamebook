# Time Subsystem — `UDayNightSubsystem`

> One clock, server-authoritative, replicated. Everything else (sun, weather, survival stats,
> production, audio) reads from this subsystem's delegates — it never reads from them.

## Clock {#clock}

`UDayNightSubsystem` is a `UWorldSubsystem` (per-level lifetime matches the persistent world level;
use a `UGameInstanceSubsystem` instead only if the project needs the clock to survive a full level
transition, e.g. a hub-and-spoke structure — most single-world survival/civ projects want
`UWorldSubsystem`).

```cpp
// Source/<Project>/Public/World/DayNightSubsystem.h
UENUM(BlueprintType)
enum class ESeason : uint8
{
    Spring, Summer, Autumn, Winter
};

UCLASS()
class MYGAME_API UDayNightSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Tick(float DeltaTime);
    virtual TStatId GetStatId() const override;
    virtual bool DoesSupportWorldType(const EWorldType::Type WorldType) const override;

    UFUNCTION(BlueprintPure, Category = "DayNight")
    float GetTimeOfDay01() const { return TimeOfDay01; }   // 0..1, 0 = midnight

    UFUNCTION(BlueprintPure, Category = "DayNight")
    int32 GetDayIndex() const { return DayIndex; }

    UFUNCTION(BlueprintPure, Category = "DayNight")
    ESeason GetSeason() const { return CurrentSeason; }

    UFUNCTION(BlueprintCallable, Category = "DayNight", meta = (CallInEditor = "true"))
    void Server_SetTimeScale(float NewScale);              // authoritative only; validated

    UPROPERTY(BlueprintAssignable)
    FOnTimeOfDayChanged OnTimeOfDayChanged;                 // broadcast on tick, throttled

    UPROPERTY(BlueprintAssignable)
    FOnDayRolledOver OnDayRolledOver;                       // broadcast once per DayIndex increment

    UPROPERTY(BlueprintAssignable)
    FOnSeasonChanged OnSeasonChanged;

protected:
    UPROPERTY(ReplicatedUsing = OnRep_TimeOfDay)
    float TimeOfDay01 = 0.25f;                              // start at dawn

    UPROPERTY(ReplicatedUsing = OnRep_DayIndex)
    int32 DayIndex = 0;

    UPROPERTY(Replicated)
    ESeason CurrentSeason = ESeason::Spring;

    UPROPERTY(EditDefaultsOnly, Category = "DayNight")
    float DayLengthSeconds = 1200.f;                        // 20 real minutes = 1 game day

    UPROPERTY(EditDefaultsOnly, Category = "DayNight")
    int32 DaysPerSeason = 9;                                // civ layer harvest-cycle length

    UPROPERTY(Replicated)
    float TimeScale = 1.f;                                  // debug/dev speed-up, server-set only

    UFUNCTION() void OnRep_TimeOfDay();
    UFUNCTION() void OnRep_DayIndex();

    void AdvanceSeasonIfNeeded();
};
```

**Rules**

- `TimeOfDay01`, `DayIndex`, `CurrentSeason`, `TimeScale` are all `Replicated`/`ReplicatedUsing`.
  Register in `GetLifetimeReplicatedProps` on the subsystem's owning actor proxy if the project
  doesn't already replicate subsystem state (Epic pattern: back a `UWorldSubsystem`'s replicated
  fields with a small always-relevant `AInfo` actor, e.g. `AGameTimeStateActor`, since subsystems
  themselves are not `AActor`s and cannot self-replicate).
- The server is the only writer. `Server_SetTimeScale` is an RPC with `WithValidation` (clamp to a
  sane range, e.g. `0.1..10`) — never let a client set world time.
- `Tick` only runs `HasAuthority()`-side simulation of `TimeOfDay01`; clients receive replicated
  values and locally interpolate for smooth sun movement between replication ticks (client-side
  cosmetic prediction only, per the locked replication pattern in `agents/_shared/PATTERNS.md#replication`).
- `OnTimeOfDayChanged` is throttled (e.g. broadcast at most every 0.1 game-hours) — never broadcast
  every tick; listeners (sun rotation, ambient audio crossfade) don't need frame-rate resolution.
- `DayIndex` increments on rollover (`TimeOfDay01` wraps `1.0 -> 0.0`); `OnDayRolledOver` is the
  hook `[[procgen-world]]`-adjacent civ systems use for daily production/harvest ticks — never
  reimplement a second "new day" timer elsewhere.
- Season derives from `DayIndex / DaysPerSeason % 4` — a pure function of day index, not stored
  independently, so season is always recomputable and never drifts out of sync after a save/load.

## Calendar / seasons

Keep the calendar data-driven: `DaysPerSeason`, season display names, and season-specific sun-arc
parameters (see below) live on a `UDA_CalendarConfig` Primary Data Asset per
`agents/_shared/PATTERNS.md#data`, not hardcoded constants — designers tune season length without
a C++ change.

## Movable sun & dynamic lighting {#lighting}

Survival/crafting/civilization worlds generated from a seed (`[[procgen-world]]`) have no static
geometry to bake against, and a day/night cycle rules out baked lightmaps outright even on
hand-authored levels. This is the **one locked exception** to the gamebook's Nanite/Lumen-off,
traditional-LODs-and-baked-lighting baseline (`agents/_shared/STACK.md`).

```cpp
// BP_Sun (BP child of ADirectionalLight), driven from C++ each throttled tick:
void AGameTimeStateActor::UpdateSunRotation(float TimeOfDay01, ESeason Season)
{
    // Arc parameters (dawn/noon/dusk angle, max elevation) come from UDA_CalendarConfig
    // per-season, so winter has a lower, shorter arc than summer.
    const float SunPitch = FMath::Lerp(SeasonArc.SunriseElevation, SeasonArc.NoonElevation,
                                        FMath::Abs(TimeOfDay01 - 0.5f) * -2.f + 1.f);
    const float SunYaw = FMath::Lerp(SeasonArc.SunriseYaw, SeasonArc.SunsetYaw, TimeOfDay01);
    SunLight->SetActorRotation(FRotator(SunPitch, SunYaw, 0.f));

    // Color temperature + intensity ramp for dawn/dusk warmth, night falloff to moonlight levels.
    UDirectionalLightComponent* Comp = SunLight->GetLightComponent();
    Comp->SetLightColor(SeasonArc.ColorCurve->GetVectorValue(TimeOfDay01));
    Comp->SetIntensity(SeasonArc.IntensityCurve->GetFloatValue(TimeOfDay01));
}
```

**Setup**

- `ADirectionalLight` with **Dynamic** mobility (never Static/Stationary — it moves every frame).
- Cast shadows via **distance field shadows** (`r.DistanceFieldShadowing 1`, `Ray Traced Distance
  Field Shadows` component flag) or CSM (Cascaded Shadow Maps) — pick CSM for the GTX 1060
  baseline (distance-field shadowing has a higher steady-state GPU cost per `quality/performance-budgets.md`);
  reserve pure distance-field shadows for far-shadow softness on large open terrain if CSM cascade
  count alone can't cover procgen world scale.
- Sky: `SkyAtmosphere` + `SkyLight` (mobility Movable, `RealTimeCapture` recapture mode) recapture
  throttled to the same cadence as `OnTimeOfDayChanged`, not every frame — recapture is expensive.
- Second light for moon/night fill (`ADirectionalLight`, low intensity, cool color) rotated
  opposite the sun, active only when `TimeOfDay01` is in the night range — toggle visibility
  rather than paying render cost for an invisible light.

## Perf budget notes {#budget}

Against `quality/performance-budgets.md`'s GTX 1060 / 16.6ms frame target:

| Cost center | Budget | Mitigation |
|---|---|---|
| CSM cascade count | ≤ 4 cascades | Fewer cascades outdoors where geometry is coarse (terrain, not characters) |
| Sun rotation update | Throttled to ≤ 10 Hz | Never per-tick; interpolate visually between updates |
| SkyLight recapture | ≤ 1 Hz, or on `OnDayRolledOver` only if lighting delta is imperceptible sub-hour | `RealTimeCapture` every frame is a GPU spike — budget it explicitly |
| Distance field shadows | Optional, only for far/soft terrain shadows | Requires `r.GenerateMeshDistanceFields=1`; adds build time + memory — measure before enabling project-wide |
| Volumetric fog/clouds tied to weather | ≤ 1.5ms GPU | Cross-reference `resources/weather-effects.md#vfx` — weather VFX budget is separate from lighting budget |

Record `perf.dynamic_lighting = true` in `project.config.json` (shared flag with `[[procgen-world]]`
— both systems require it and `eng-director` checks for it before approving Nanite/Lumen-off
projects that nonetheless have moving suns).

## Save integration

Time/season state is small and cheap: persist `{DayIndex, TimeOfDay01, CurrentSeason}` directly in
the project's `USaveGame` subclass (per `agents/_shared/PATTERNS.md#save`) — no delta log needed,
unlike terrain (`[[procgen-world]]`) or weather (`resources/weather-effects.md#determinism`), because
the clock has no branching state to replay: it's a pure function of elapsed day count, so loading a
save is just restoring three scalars and letting `Tick` resume.
