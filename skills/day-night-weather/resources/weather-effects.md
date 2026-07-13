# Weather Effects — seeded state machine + consumers

> Weather is a per-region `FGameplayTag`-typed state, transitioned deterministically from
> `Hash(WorldSeed, RegionID, DayIndex)`. It never mutates gameplay attributes directly — it
> broadcasts a change delegate and writes `SetByCaller` magnitudes into effects other systems own.

## State machine {#state-machine}

```cpp
// Source/<Project>/Public/World/WeatherSubsystem.h
UENUM(BlueprintType)
enum class EWeatherState : uint8
{
    Clear, Overcast, Rain, Storm, Snow, Blizzard, Fog, Heatwave
};

USTRUCT(BlueprintType)
struct FWeatherTransitionRow : public FTableRowBase
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere) EWeatherState FromState = EWeatherState::Clear;
    UPROPERTY(EditAnywhere) EWeatherState ToState = EWeatherState::Clear;
    UPROPERTY(EditAnywhere) float Weight = 1.f;             // relative selection weight
    UPROPERTY(EditAnywhere) ESeason RequiredSeason = ESeason::Spring; // optional gate, or "Any"
};

UCLASS()
class MYGAME_API UWeatherSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintPure, Category = "Weather")
    EWeatherState GetWeatherForRegion(FName RegionID) const;

    UFUNCTION(BlueprintPure, Category = "Weather")
    float GetWeatherIntensity01(FName RegionID) const;      // ramps in/out over a transition window

    UPROPERTY(BlueprintAssignable)
    FOnWeatherChanged OnWeatherChanged;                      // (RegionID, OldState, NewState)

protected:
    // Called once per region per day rollover (bound to UDayNightSubsystem::OnDayRolledOver)
    void RollWeatherForRegion(FName RegionID, const FBiomeWeatherProfile& Profile);

    UPROPERTY(Replicated)
    TMap<FName, EWeatherState> RegionWeather;

    UPROPERTY(Replicated)
    TMap<FName, float> RegionIntensity01;
};
```

```cpp
// Deterministic selection — never FMath::Rand. Mirrors the hashing scheme in
// skills/procgen-world/resources/seed-discipline.md.
EWeatherState UWeatherSubsystem::RollWeatherForRegion(FName RegionID, const FBiomeWeatherProfile& Profile)
{
    const int64 WorldSeed = GetWorldGenSubsystem()->GetWorldSeed(); // [[procgen-world]]
    const int32 DayIndex = GetDayNightSubsystem()->GetDayIndex();
    const uint32 StreamSeed = HashCombine(HashCombine(GetTypeHash(WorldSeed), GetTypeHash(RegionID)),
                                           GetTypeHash(DayIndex));
    FRandomStream Stream(StreamSeed);                        // fresh stream, never shared/global

    const EWeatherState CurrentState = RegionWeather.FindRef(RegionID);
    TArray<FWeatherTransitionRow*> Candidates = Profile.GetRowsFrom(CurrentState, CurrentSeason());
    const float Roll = Stream.FRandRange(0.f, TotalWeight(Candidates));
    return SelectByWeight(Candidates, Roll);
}
```

**Determinism rules** {#determinism}

- One `FRandomStream` derived per `(WorldSeed, RegionID, DayIndex)` triple, constructed fresh for
  each roll and discarded — never a persistent/shared stream, exactly mirroring
  `[[procgen-world]]`'s `resources/seed-discipline.md` hashing discipline. Same seed + same day
  index + same region always produces the same weather, on any machine, regenerated in any order.
- Weather rolls happen **once per region per day rollover** (bound to `UDayNightSubsystem::OnDayRolledOver`),
  not continuously — this keeps the sequence a finite, replayable list rather than a moving target.
- Server-authoritative: only the server calls `RollWeatherForRegion`; `RegionWeather`/`RegionIntensity01`
  are `Replicated` maps clients read, never compute locally. A client reconnecting mid-session gets
  correct weather from replication, not from re-deriving the roll (avoids desync if a client's
  local day-index tracking ever lags).
- Save/load: persist `{DayIndex}` only (via `[[day-night-weather]]`'s clock save) — weather itself
  is **not** saved. On load, re-roll every region's weather history from day 0 to the loaded
  `DayIndex` is unnecessary; only the *current* day's weather needs recomputation since transitions
  are Markovian (depend only on the prior day's state, which — if not persisted — falls back to
  each region's profile default `FromState`). If exact weather continuity across saves matters for
  a project, persist `{RegionID: EWeatherState}` snapshot alongside `DayIndex` rather than replaying
  a full history.
- Functional Test: call `RollWeatherForRegion` for the same seed/region/day twice in isolated
  subsystem instances and assert the resulting `EWeatherState` and `Stream`-derived intensity match
  bit-for-bit — this is `<Project>.World.Weather.Determinism.SameSeedSameSequence`.

## Biome-weighted transition tables

`DA_WeatherProfile_<Biome>` (Primary Data Asset, per `agents/_shared/PATTERNS.md#data`) holds a
`TArray<FWeatherTransitionRow>` per biome — desert biomes weight `Heatwave`/`Clear` heavily and
exclude `Snow`/`Blizzard`; tundra biomes invert that. `RequiredSeason` on a row gates it out
entirely outside that season (e.g. `Blizzard` only rolls in `Winter`). This is how the region graph
from `[[procgen-world]]` (biome assignment per region) feeds weather: `UWeatherSubsystem` looks up
each region's biome, then that biome's `DA_WeatherProfile_*` for its transition table — a region
never picks weather from a global table.

## Consumers {#consumers}

`OnWeatherChanged` and per-tick `GetWeatherIntensity01` are the only public surface other systems
touch. Nothing downstream reaches into `RegionWeather` directly or re-derives weather itself.

### Survival stats — temperature {#temperature}

`[[survival-stats]]` owns `GE_Temperature_Drift` (an `Infinite` GE with `Period`). This skill's
subsystem listens for `OnWeatherChanged` and calls:

```cpp
FGameplayEffectSpecHandle Spec = ASC->MakeOutgoingSpec(GE_Temperature_Drift, 1.f, EffectContext);
Spec.Data->SetSetByCallerMagnitude(FGameplayTag::RequestGameplayTag("SetByCaller.Temperature.Weather"),
                                    WeatherProfile.TemperatureDeltaFor(NewState));
ASC->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get());
```

The weather subsystem never touches `UPlayerSurvivalAttributeSet` directly — it only ever supplies
a `SetByCaller` magnitude into an effect `[[survival-stats]]` owns and clamps.

### VFX — rain/snow/fog {#vfx}

Route through `[[niagara-effect]]`'s GameplayCue pattern: `OnWeatherChanged` fires
`GameplayCue.Weather.Rain` / `.Snow` / `.Fog` / `.Storm` with `GetWeatherIntensity01` as the cue's
magnitude, driving a Niagara user parameter (particle spawn rate, wetness material param) rather
than swapping systems. One `NS_Weather_Rain`/`NS_Weather_Snow` template per weather type, scaled by
intensity — not spawned/despawned per raindrop change. Budget against
`quality/performance-budgets.md`'s Niagara GPU particle count (≤ 100,000 per system) — regional
weather covering large procgen terrain should use GPU-simulated sheet/volume effects, not per-actor
CPU emitters.

### Audio — RTPCs {#audio}

Route through `[[wwise-event-pipeline]]`: `RTPC_Weather_Intensity` set via
`UAkGameplayStatics::SetRTPCValue` on `OnWeatherChanged`/intensity ramp, plus a
`SwitchGroup_WeatherState` switch (`Clear`/`Rain`/`Storm`/`Snow`/...) for ambience bed selection
and thunder/wind one-shot event gating. Never post ad-hoc `PlaySound2D` calls for weather ambience.

### Production chains — crop/yield modifiers {#production}

The civ/production layer (`[[production-chains]]`, when that skill exists in a project's scope)
reads `GetWeatherForRegion`/`GetWeatherIntensity01` at harvest-tick time (bound to
`UDayNightSubsystem::OnDayRolledOver`) to scale yield: e.g. `Storm` halts open-field harvest,
`Rain` boosts irrigation-dependent crops, `Heatwave` accelerates a subset and wilts another. This
skill exposes the read-only query API; the yield formula and its `SetByCaller` application into
whatever `GE_CropYield_*` the production system owns live entirely in that consumer, not here.

### Seasons — harvest cycle hooks {#seasons}

`UDayNightSubsystem::OnSeasonChanged` is the hook, not weather — seasons are calendar-driven
(`DayIndex / DaysPerSeason`), independent of the weather roll. The civ layer binds to
`OnSeasonChanged` for harvest-window open/close, crop-rotation eligibility, and seasonal building
unlocks (e.g. a granary only usable `Autumn`-`Winter`). Weather then modulates *within* an open
season window (a `Storm` during harvest season still hurts yield); it never overrides season gating.

## Tests

- `<Project>.World.Weather.Determinism.SameSeedSameSequence` — replay `(seed, region, day 0..N)`
  twice, assert identical `EWeatherState` sequence and `Stream`-derived intensity values.
- `<Project>.World.Weather.Replication.ClientMatchesServer` — spawn a PIE client, advance a day
  rollover server-side, assert client's replicated `RegionWeather` matches within one replication
  tick.
- `<Project>.World.Weather.Consumers.TemperatureSetByCallerApplied` — trigger `OnWeatherChanged`
  to `Blizzard`, assert `[[survival-stats]]`'s `Temperature` attribute drift rate matches the
  profile's configured delta (cross-system integration test, owned jointly with that skill's
  Functional Test suite).
