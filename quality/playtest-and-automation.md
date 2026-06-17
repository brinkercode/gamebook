# Playtest & Automation

> Testing layers for UE5 FPS — Functional Tests, Gauntlet scripted scenarios, manual playtest scripts, and telemetry capture. Read by `playtest-architect` on every invocation.

---

## Testing Layers

| Layer | Tool | Purpose | Volume |
|-------|------|---------|--------|
| **Functional Tests** | UE5 Functional Testing Framework | In-engine automated: spawn, trigger, assert | Heavy |
| **Gauntlet** | Gauntlet Automation Framework | Scripted multi-step scenarios, perf regression | Medium |
| **Manual Playtest** | Markdown checklists | Subjective feel, polish, edge cases automation misses | Every milestone |
| **Telemetry** | Custom analytics subsystem | Production data on real-world behavior | Continuous (post-launch) |

Test at the lowest possible layer. If Functional Test can verify it, don't write a Gauntlet scenario.

---

## Layer 1: Functional Tests

Functional Tests run inside the editor (or `-game` mode headless). They exist as `AFunctionalTest` Blueprint or C++ subclasses placed in dedicated test levels.

### Naming and tagging

Every test class name follows: `FT_<System>_<Behavior>`.
Every test is tagged with `@critical` or `@regression`. CI runs:
- `make cook-smoke` — `@critical` only (fast gate, < 3 min)
- `make automation-critical` — `@critical` tag (pre-ship gate)
- `make regression` — full suite (nightly)

### C++ Functional Test pattern

```cpp
// Source/MyGameTests/FunctionalTests/FT_WeaponFire_HitDetection.h
#pragma once
#include "FunctionalTest.h"
#include "FT_WeaponFire_HitDetection.generated.h"

/**
 * @critical
 * Verifies: firing a hitscan weapon applies the correct GE_Damage to a target
 * within expected range and correctly misses beyond falloff distance.
 */
UCLASS()
class AFT_WeaponFire_HitDetection : public AFunctionalTest
{
    GENERATED_BODY()
protected:
    virtual void StartTest() override;

private:
    UPROPERTY(EditInstanceOnly, Category="Test")
    ACharacter* TargetDummy;   // Placed in test level

    UPROPERTY(EditInstanceOnly, Category="Test")
    float ExpectedDamage = 25.f;

    void OnDamageApplied(float ActualDamage);
};
```

```cpp
// FT_WeaponFire_HitDetection.cpp
void AFT_WeaponFire_HitDetection::StartTest()
{
    // Verify setup
    if (!AssertIsValid(TargetDummy, TEXT("TargetDummy must be set in test level"))) return;

    UAbilitySystemComponent* ASC = TargetDummy->FindComponentByClass<UAbilitySystemComponent>();
    if (!AssertIsValid(ASC, TEXT("TargetDummy must have UAbilitySystemComponent"))) return;

    float HealthBefore = ASC->GetNumericAttribute(UGAS_HeroAttributes::GetHealthAttribute());

    // Fire the weapon via ability system
    AHeroCharacter* Hero = CastChecked<AHeroCharacter>(GetOwner());
    Hero->GetAbilitySystemComponent()->TryActivateAbilitiesByTag(
        FGameplayTagContainer(GameplayTags::Ability_WeaponFire));

    // Defer assertion until next tick (GE is applied async)
    AddTickPrerequisiteActor(this);
    GetWorldTimerManager().SetTimer(
        AssertTimerHandle, this, &ThisClass::AssertResults, 0.1f, false);
}

void AFT_WeaponFire_HitDetection::AssertResults()
{
    UAbilitySystemComponent* ASC = TargetDummy->FindComponentByClass<UAbilitySystemComponent>();
    float HealthAfter = ASC->GetNumericAttribute(UGAS_HeroAttributes::GetHealthAttribute());
    float ActualDamage = HealthBefore - HealthAfter; // HealthBefore captured in StartTest

    AssertEqual_Float(ActualDamage, ExpectedDamage, TEXT("Damage mismatch"), 0.1f);
    FinishTest(EFunctionalTestResult::Succeeded, TEXT("Hit detection correct"));
}
```

### Running Functional Tests from CLI

```bash
# Run all tests tagged @critical in headless mode
"$UE_ROOT/Engine/Binaries/Linux/UnrealEditor-Cmd" \
  "$PROJECT.uproject" \
  -ExecCmds="Automation RunTests MyGame.FunctionalTests.Critical;Quit" \
  -unattended -nopause -log

# Run @critical
"$UE_ROOT/Engine/Binaries/Linux/UnrealEditor-Cmd" \
  "$PROJECT.uproject" \
  -ExecCmds="Automation RunTests MyGame.FunctionalTests.Critical;Quit" \
  -unattended -nopause -log -abslog=TestResults/critical.log

# Parse pass/fail
grep -E "PASSED|FAILED" TestResults/critical.log
```

### What Functional Tests must cover

| Surface | Tests |
|---------|-------|
| GAS ability activation | Ability activates, correct GE applied, correct attribute delta |
| GAS cost/cooldown | Ability blocked when cost unsatisfied, cooldown tag applied |
| Weapon hit detection | Hitscan hits within range, misses beyond falloff, applies correct damage type |
| Save/Load roundtrip | Save game state, reload, verify attributes and inventory match |
| Respawn flow | Player death → respawn → correct health, no stale gameplay tags |
| Input → ability binding | Input Action triggers correct ability via IMC |

---

## Layer 2: Gauntlet Scenarios

Gauntlet wraps a `-game` instance and drives it via external automation. Use it for multi-step behavioral scenarios and performance regression tests that would be fragile or slow as Functional Tests.

### Gauntlet node structure

```
Source/
  MyGameTests/
    Gauntlet/
      Nodes/
        GauntletNode_PlaytestScenario.cs      # C# node — drives the test
      Configs/
        perf_baseline.json                    # Platform budget thresholds
```

### Performance regression Gauntlet node

```csharp
// GauntletNode_PerfBaseline.cs
public class GauntletNode_PerfBaseline : GauntletTestNodeBase
{
    public override string Name => "PerfBaseline";

    public override void Tick()
    {
        // Navigate to the perf-sensitive combat arena level
        SendConsoleCommand("open CombatArena_Perf");
        WaitForLevelLoad();

        // Enable stat capture for 30 seconds
        SendConsoleCommand("stat startfile");
        WaitSeconds(30);
        SendConsoleCommand("stat stopfile");

        // Capture frame time CSV
        SendConsoleCommand("stat fps");
        CaptureScreenshot("perf_baseline_endstate.png");

        // Retrieve captured profiling data path and parse
        string statsPath = GetLastStatFileOutput();
        var results = ParseStatFile(statsPath);

        // Assert frame budget
        Require(results.AverageFrameTimeMs < 16.6f,
            $"Average frame time {results.AverageFrameTimeMs}ms exceeds 16.6ms budget");
        Require(results.P99FrameTimeMs < 33.3f,
            $"P99 frame time {results.P99FrameTimeMs}ms exceeds 33.3ms");

        Finish(EGauntletResult.Passed);
    }
}
```

### When to write a Gauntlet scenario (not a Functional Test)

- Multi-level transitions (load Level A, interact, verify state persists after transition to Level B).
- Performance regression over a 30-second gameplay slice.
- Crash-soak: run a long automated play session with randomized input and look for crashes.
- Build verification: ship build launches, reaches main menu, loads a save — no Functional Test level needed.

---

## Layer 3: Manual Playtest Scripts

Manual scripts are markdown checklists that a human playtesters follows. They cover subjective feel, visual polish, and edge cases that automation cannot express.

Run at: Alpha gate, Beta gate, pre-submission.

---

### Script: Core Combat Feel

**Setup:** Dev build. New game save. Tutorial skipped. Spawn in `CombatArena_Test`.

- [ ] Walk/run transitions feel responsive — no perceptible input lag on sprint start/stop
- [ ] ADS (Aim Down Sights) zoom transitions at the expected speed for all weapon classes
- [ ] Hipfire spread is visually communicated (crosshair spread animation matches actual spread)
- [ ] Hit indicator (screen-space damage flash or audio cue) fires on every confirmed hit
- [ ] Headshot produces distinct feedback — audio cue, kill confirm sound
- [ ] Enemy death animations complete before actor is destroyed; no instant pop-out
- [ ] Reload animation syncs with ammo count update — count does not change before the animation reach point
- [ ] Empty-mag firing attempt plays the correct "dry fire" feedback, not silence
- [ ] Melee attack interrupts reload correctly (GAS `ActivationBlockedTags` working)
- [ ] Sprint cancels ADS; ADS cancels sprint — transitions clean in all orderings

---

### Script: Save / Load Integrity

**Setup:** Mid-session save after acquiring 2 weapons and leveling one ability.

- [ ] Save to slot succeeds with no log warnings
- [ ] Quit to main menu — save slot shows correct timestamp
- [ ] Load save — all weapons present, correct ammo counts
- [ ] Ability level matches pre-save value — no regression
- [ ] Player position restored within 5 units of save position
- [ ] HUD displays correct values immediately on load — no "flash to zero then fill" artifact
- [ ] Load from a corrupted slot (manually hex-edit one byte) — game shows error UI, does not crash

---

### Script: Encounter Scripting

**Setup:** Level containing at least one scripted encounter (enemy ambush or triggered spawn wave).

- [ ] Encounter triggers at the correct zone entry point — not early, not late
- [ ] Enemy count matches design spec (check `DT_Encounters` for source values)
- [ ] Enemies spawned with correct AI behavior trees — patrol before player detected, aggro after
- [ ] Wave 2 does not spawn until Wave 1 is fully defeated
- [ ] Encounter-complete event fires: objectives update, door/gate opens as designed
- [ ] Replaying the encounter (die and respawn to encounter zone) resets correctly — no duplicate enemies

---

### Script: UI / HUD

- [ ] Health bar updates smoothly — no flicker or one-frame skip to final value
- [ ] Ammo widget shows current mag / reserve correctly for all weapon types
- [ ] Ability cooldown radial timer starts and ends correctly; reactivation prevented during cooldown
- [ ] All widget text fits in its container at 1080p and 4K (check `Content/UI/` scale rules)
- [ ] Pause menu opens/closes without gameplay state corruption (timers, active abilities)
- [ ] Death screen appears on `State_Dead` tag and respawn button triggers correctly
- [ ] Settings menu: changing sensitivity applies immediately without requiring restart

---

### Script: Microtransaction Flow (if EOS Ecom / Steam enabled)

- [ ] Cosmetic item store displays correct item names and prices from live catalog
- [ ] Purchasing a cosmetic shows confirmation dialog before charge
- [ ] Failed/cancelled purchase restores correct balance — no deducted currency with no item
- [ ] Purchased cosmetic appears in inventory after transaction completion (requires backend receipt validation)
- [ ] Closing the game and relaunching: purchased cosmetic still present (persistent entitlement)
- [ ] Non-purchased items are visually locked; equipping requires purchase flow

---

## Layer 4: Telemetry Capture

In-game telemetry is opt-in, GDPR-compliant, and ships only in builds where the player consents.

### What to capture

| Event | Fields | Purpose |
|-------|--------|---------|
| `session_start` | build version, platform, save slot age | Crash attribution |
| `player_death` | position, cause, killer tag, time alive | Encounter balancing |
| `ability_used` | ability tag, activation count per session | GAS usage patterns |
| `weapon_switch` | from/to weapon, combat state | Loadout popularity |
| `save_game_written` | slot name, duration ms | Save performance |
| `shop_opened` | source (main menu / in-game) | Funnel analysis |
| `purchase_initiated` | item id, price | Conversion tracking |

### Implementation skeleton

```cpp
// Source/MyGame/Telemetry/MyGameTelemetry.h
UCLASS()
class UMyGameTelemetrySubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    // Called after consent confirmed on first launch
    void EnableTelemetry();

    UFUNCTION(BlueprintCallable, Category="Telemetry")
    void RecordPlayerDeath(const FVector& Position, FGameplayTag CauseTag);

    UFUNCTION(BlueprintCallable, Category="Telemetry")
    void RecordAbilityUsed(FGameplayTag AbilityTag);

private:
    bool bTelemetryEnabled = false;

    // Batches events and flushes to endpoint every 60 seconds or on session end
    void FlushBatch();
    TArray<FTelemetryEvent> PendingEvents;
};
```

Rules:
- No PII in telemetry events. Position is coarsened to nearest 100 units. Player ID is a non-reversible session hash.
- Consent must be confirmed before `EnableTelemetry()` is called. Default is off.
- Telemetry subsystem is compiled out of non-shipping builds (`#if UE_BUILD_SHIPPING`) or gated behind `bTelemetryEnabled`.

---

## Automation Tags Reference

| Tag | Runs in | Description |
|-----|---------|-------------|
| `@critical` | `make cook-smoke` — every CI push | Basic sanity: the game starts, core abilities activate |
| `@critical` | `make automation-critical` — pre-ship | Full GAS surface, save/load, combat loop |
| `@regression` | Nightly | Every test |
| `@perf` | Nightly + manual | Gauntlet performance scenarios |
| `@skip_shipping` | Never in shipping builds | Tests that require editor or debug features |

---

## make targets

```makefile
# Makefile or scripts/ci-targets.sh

cook-smoke:
	@echo "Running @critical Functional Tests..."
	$(UE_CMD) $(PROJECT) \
	  -ExecCmds="Automation RunTests MyGame.Critical;Quit" \
	  -unattended -nopause -log -abslog=TestResults/critical.log
	@grep -q "FAILED" TestResults/critical.log && exit 1 || exit 0

automation-critical:
	@echo "Running @critical Functional Tests..."
	$(UE_CMD) $(PROJECT) \
	  -ExecCmds="Automation RunTests MyGame.Critical;Quit" \
	  -unattended -nopause -log -abslog=TestResults/critical.log
	@grep -q "FAILED" TestResults/critical.log && exit 1 || exit 0

gate: cook-smoke automation-critical
	@echo "Gate passed."
```

---

## Principles

**Test GAS outcomes, not GAS internals.** Assert that the attribute changed by the expected delta. Don't assert the internal order of `PostGameplayEffectExecute` calls.

**Every shipped bug gets a regression Functional Test.** Before the fix: write the test, watch it fail. After the fix: watch it pass. Tag `@regression`.

**Flaky tests ship nothing.** A Functional Test that passes 90% of the time is worse than no test. Investigate root cause (usually a missing `WaitForCondition` or timing assumption). Never mark flaky tests as expected-failures and ship anyway.

**Gauntlet scenarios are not unit tests.** They validate a slice of gameplay end-to-end. Keep them broad and behavioral, not microsurgical.
