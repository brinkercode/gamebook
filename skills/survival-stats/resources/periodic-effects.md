# Periodic Drain Effects, Environment Hooks, Threshold Debuffs, Tests

All magnitudes route through `FScalableFloat` bound to `CurveTable` rows —
per the Data-Driven Pattern (`agents/_shared/PATTERNS.md#data`). Designers
tune `CT_SurvivalRates.csv`; nobody hardcodes a drain number in C++ or BP.

## CT_SurvivalRates — CurveTable rows

`Content/Data/CT_SurvivalRates.uasset`, authored via the `ue5-editor-python`
skill's DataTable-from-CSV recipe (`resources/recipes.md` in that skill).

| RowName | Key 0 | Value | Meaning |
|---|---|---|---|
| `HungerDrainPerSec` | 0 | -0.15 | Hunger lost per second, base rate |
| `ThirstDrainPerSec` | 0 | -0.25 | Thirst lost per second, base rate |
| `StaminaRegenPerSec` | 0 | 8.0 | Stamina regained per second at rest |
| `StaminaSprintDrainPerSec` | 0 | -12.0 | Stamina lost per second while sprinting |
| `TemperatureDriftPerSec` | 0 | -0.5 | Base drift toward biome ambient, per second |
| `StarvationDamagePerSec` | 0 | -1.5 | Health lost per second while `State.Starving` |
| `DehydrationDamagePerSec` | 0 | -2.0 | Health lost per second while `State.Dehydrated` |
| `ExposureDamagePerSec` | 0 | -1.0 | Health lost per second while `State.Freezing` or `State.Overheating` |

Curves (not flat rows) are used where a rate should scale with a stat, e.g.
`HungerDrainPerSec` as a function of encumbrance or activity level — keep the
row flat until a design need requires the curve shape.

## GE_Hunger_Drain / GE_Thirst_Drain (Infinite, Periodic)

`Content/GAS/Effects/Survival/GE_Hunger_Drain.uasset`

| Property | Value |
|---|---|
| Duration Policy | Infinite |
| Period | 1.0s |
| Modifier Attribute | `UPlayerSurvivalAttributeSet.Hunger` |
| Modifier Op | Add |
| Magnitude Type | Scalable Float |
| Scalable Float | `FScalableFloat(1.f, CT_SurvivalRates, "HungerDrainPerSec")` |
| Application | Applied once in `BeginPlay`/`PossessedBy`, never removed for the life of the pawn |

```cpp
// Grant once, on possession — not re-applied per tick, the GE's own Period handles that.
FGameplayEffectContextHandle Context = ASC->MakeEffectContext();
FGameplayEffectSpecHandle Spec = ASC->MakeOutgoingSpec(GE_Hunger_Drain, /*Level=*/1.f, Context);
ASC->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get());
```

`GE_Thirst_Drain` mirrors this against `Thirst` / `ThirstDrainPerSec`.

## GE_Stamina_Regen / GE_Stamina_SprintDrain

Two competing `Infinite` GEs rather than one signed effect, because they are
gated by different conditions (regen only while `!State.Sprinting`, drain
only while `State.Sprinting`):

- `GE_Stamina_Regen` — Period 0.5s, `+StaminaRegenPerSec`, `Application
  Requirement`: ASC does **not** have tag `State.Sprinting` and does **not**
  have tag `State.Exhausted` (exhausted pawns don't passively regen —
  require an explicit rest action, project-specific).
- `GE_Stamina_SprintDrain` — Period 0.2s (tighter granularity — sprint feels
  responsive), `+StaminaSprintDrainPerSec` (already negative in the table),
  `Application Requirement`: ASC has tag `State.Sprinting`.

Both are granted once at possession like the hunger/thirst drains; the
`Application Requirement` gameplay-tag query controls whether each tick
actually applies, so there's no need to add/remove the GE on sprint
start/stop.

## GE_Temperature_Drift — environment hooks {#environment-hooks}

Temperature drift is the one vital that isn't a flat rate — it drifts toward
an ambient value supplied by the environment, not toward zero. Model it as
`SetByCaller` magnitude computed by the caller (a `UWorldSubsystem` or the
character's tick-adjacent survival component) each time it reapplies, rather
than a static curve:

```cpp
// USurvivalEnvironmentSubsystem (UWorldSubsystem) — bridges [[day-night-weather]]
// biome/weather sampling into a SetByCaller magnitude for GE_Temperature_Drift.
// Server-authoritative: this subsystem only runs its sampling on the server;
// clients receive the resulting Temperature attribute via replication.
void USurvivalEnvironmentSubsystem::ReapplyTemperatureDrift(UAbilitySystemComponent* ASC, const FVector& Location)
{
    const float AmbientC   = WeatherSubsystem->SampleAmbientTemperature(Location); // biome + weather + time-of-day
    const float ShelterMod = ComputeShelterModifier(Location);   // indoors/campfire reduce drift magnitude
    const float ActivityMod= ComputeActivityModifier(ASC);       // sprinting warms, standing still in wind chills

    FGameplayEffectSpecHandle Spec = ASC->MakeOutgoingSpec(GE_Temperature_Drift, 1.f, ASC->MakeEffectContext());
    Spec.Data->SetSetByCallerMagnitude(
        FGameplayTag::RequestGameplayTag(FName("SetByCaller.Survival.TemperatureTarget")), AmbientC);
    Spec.Data->SetSetByCallerMagnitude(
        FGameplayTag::RequestGameplayTag(FName("SetByCaller.Survival.TemperatureDriftScale")),
        ShelterMod * ActivityMod);
    ASC->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get());
}
```

`GE_Temperature_Drift` itself computes `Add((TemperatureTarget -
CurrentTemperature) * DriftScale * TemperatureDriftPerSec)` via an
`Execution Calculation` (`UGameplayEffectExecutionCalculation` subclass) —
because "drift toward a target" needs to read the current attribute value,
which a plain Modifier can't do; a custom Execution Calculation is
appropriate here (this is the one place in the survival set that isn't a
flat Modifier).

**Determinism**: `SampleAmbientTemperature` must be a pure function of
biome id + weather state + world time, all of which come from
[[procgen-world]]'s seeded delta log via [[day-night-weather]] — never
`FMath::RandRange` inline. Replaying the same seed and delta log reproduces
the same temperature curve, which is what the Functional Test below asserts.

**Reapply cadence**: call `ReapplyTemperatureDrift` on a coarse timer (every
1-2s) or on biome/weather-change events, not every tick — the GE's own
`Period` handles the per-second attribute change; the SetByCaller refresh
only needs to track *slow* environmental change.

## Threshold debuffs {#threshold-debuffs}

Each debuff is a separate `Infinite`, `Period`-driven GE gated by an
`Application Requirement` (Gameplay Tag Query) on the corresponding
`State.*` tag, writing to the `EnvironmentDamage` meta attribute (never
directly to `Health` — see `attribute-set.md#post-gameplay-effect-execute`):

| GE | Requirement Tag | Period | Modifier |
|---|---|---|---|
| `GE_Starvation_HealthDrain` | `State.Starving` | 1.0s | `EnvironmentDamage += -StarvationDamagePerSec` (row is negative, so `Add` of the negated row = positive damage) |
| `GE_Dehydration_HealthDrain` | `State.Dehydrated` | 1.0s | `EnvironmentDamage += -DehydrationDamagePerSec` |
| `GE_Exposure_HealthDrain` | `State.Freezing` OR `State.Overheating` | 1.0s | `EnvironmentDamage += -ExposureDamagePerSec` |

Grant all three once at possession alongside the drain GEs — their
Application Requirement means they're inert until the matching tag appears,
so there's no start/stop bookkeeping. This is the same "grant once, gate by
tag query" pattern as `GE_Stamina_Regen`/`GE_Stamina_SprintDrain` above —
prefer it over `ApplyGameplayEffectToSelf` on tag-add / `RemoveActive...` on
tag-remove, since it removes a whole class of "forgot to remove the debuff"
bugs.

## Tests {#tests}

Automation Test Pattern (`agents/_shared/PATTERNS.md#automation`), module
`Source/<Project>Tests/Private/Survival/`.

```cpp
// SurvivalDrainRateTest.cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSurvivalHungerDrainTest,
    "MyProject.Survival.AttributeSet.Hunger.DrainsAtCurveRate",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FSurvivalHungerDrainTest::RunTest(const FString&)
{
    UWorld* World = FAutomationEditorCommonUtils::CreateNewMap();
    APlayerCharacter* Char = World->SpawnActor<APlayerCharacter>();
    Char->GetAbilitySystemComponent()->ApplyGameplayEffectToSelf(
        GetDefault<UGE_Hunger_Drain>(), 1.f, Char->GetAbilitySystemComponent()->MakeEffectContext());

    const float Before = Char->GetSurvivalAttributeSet()->GetHunger();
    TickWorld(World, 1.0f); // test helper: advance world by N seconds, one Period tick

    const float ExpectedDrop = 0.15f; // matches CT_SurvivalRates row HungerDrainPerSec
    TestEqual("Hunger drops by curve rate after one period", Before - Char->GetSurvivalAttributeSet()->GetHunger(), ExpectedDrop, 0.01f);
    return true;
}
```

```cpp
// SurvivalClampBoundsTest.cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSurvivalClampBoundsTest,
    "MyProject.Survival.AttributeSet.ClampBounds.NeverExceedMax",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FSurvivalClampBoundsTest::RunTest(const FString&)
{
    UWorld* World = FAutomationEditorCommonUtils::CreateNewMap();
    APlayerCharacter* Char = World->SpawnActor<APlayerCharacter>();
    UPlayerSurvivalAttributeSet* Attrs = Char->GetSurvivalAttributeSet();

    // Overfeed past MaxHunger via an instant GE with an absurd magnitude
    ApplyInstantModifier(Char->GetAbilitySystemComponent(), Attrs->GetHungerAttribute(), 9999.f);
    TestTrue("Hunger clamps at MaxHunger", Attrs->GetHunger() <= Attrs->GetMaxHunger());

    // Drain past zero
    ApplyInstantModifier(Char->GetAbilitySystemComponent(), Attrs->GetHungerAttribute(), -9999.f);
    TestTrue("Hunger clamps at 0", Attrs->GetHunger() >= 0.f);
    return true;
}
```

```cpp
// SurvivalThresholdTagTest.cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSurvivalStarvingTagTest,
    "MyProject.Survival.Thresholds.Starving.TagGrantedBelowZeroHunger",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FSurvivalStarvingTagTest::RunTest(const FString&)
{
    UWorld* World = FAutomationEditorCommonUtils::CreateNewMap();
    APlayerCharacter* Char = World->SpawnActor<APlayerCharacter>();
    UAbilitySystemComponent* ASC = Char->GetAbilitySystemComponent();
    static const FGameplayTag Tag_Starving = FGameplayTag::RequestGameplayTag(FName("State.Starving"));

    TestFalse("Not starving at full hunger", ASC->HasMatchingGameplayTag(Tag_Starving));

    ApplyInstantModifier(ASC, Char->GetSurvivalAttributeSet()->GetHungerAttribute(), -9999.f);
    TestTrue("State.Starving granted when Hunger hits 0", ASC->HasMatchingGameplayTag(Tag_Starving));

    ApplyInstantModifier(ASC, Char->GetSurvivalAttributeSet()->GetHungerAttribute(), 9999.f);
    TestFalse("State.Starving removed after feeding", ASC->HasMatchingGameplayTag(Tag_Starving));
    return true;
}
```

Tag critical variants (`Hunger.DrainsAtCurveRate`, `ClampBounds.NeverExceedMax`,
`Starving.TagGrantedBelowZeroHunger`) with `@critical` in
`DefaultEngine.ini` automation filters so `make automation-critical` runs
them on every `/ship`.
