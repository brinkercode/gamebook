# Capture Flow — ability chain, seeded roll, roster handoff

## The three-link GAS chain

Capture is never a single ability — it's three, matching the player-visible beats (weaken, throw, resolve) and letting each step be interrupted, replicated, and tested independently.

```
GA_Creature_Weaken  --(tracks damage on target, no new logic)-->
GA_ThrowCaptureDevice  --(spawns projectile, on-hit triggers)-->
GA_CaptureResolve  --(server-only seeded roll)--> success: roster insert / fail: creature flees or re-aggros
```

### 1. `GA_Creature_Weaken` — not a new ability, a state check

There is no bespoke "weaken" ability in most projects — normal combat abilities (`GA_Weapon_*`, `GA_Melee_*`) already reduce the creature's `Health` via `UCreatureCombatAttributeSet`. This step is the **precondition check**: `GA_ThrowCaptureDevice` reads `Health / MaxHealth` at throw time and only projects have to add a dedicated weaken ability if capture requires a *non-lethal* damage type. If so:

```cpp
// Source/<Project>/Public/Abilities/Creatures/GA_Creature_Weaken.h
UCLASS()
class MYGAME_API UGA_Creature_Weaken : public UGameplayAbility
{
    GENERATED_BODY()
public:
    UGA_Creature_Weaken();
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

protected:
    // GE_Creature_NonLethalDamage: Instant, meta-attribute Damage, floors at 1 HP, never kills.
    UPROPERTY(EditDefaultsOnly, Category = "Weaken")
    TSubclassOf<UGameplayEffect> NonLethalDamageEffect;
};
```

`GE_Creature_NonLethalDamage` clamps its output in `UCreatureCombatAttributeSet::PostGameplayEffectExecute` so `Health` never drops below 1 from this specific damage source — normal lethal damage sources are untouched.

### 2. `GA_ThrowCaptureDevice`

```cpp
// Source/<Project>/Public/Abilities/Creatures/GA_ThrowCaptureDevice.h
UCLASS()
class MYGAME_API UGA_ThrowCaptureDevice : public UGameplayAbility
{
    GENERATED_BODY()
public:
    UGA_ThrowCaptureDevice();

    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Capture")
    TSubclassOf<AActor> CaptureDeviceProjectileClass;    // BP_CaptureDeviceProjectile

    UPROPERTY(EditDefaultsOnly, Category = "Capture")
    TSubclassOf<UGameplayEffect> CostEffect;              // GE_CaptureDevice_Cost (consumes inventory item)

    // Fired via a GameplayEventData when the projectile's OnHit reports a valid creature target.
    UFUNCTION() void HandleProjectileHit(AActor* HitCreature, FGameplayTag DeviceQualityTag);
};
```

`NetExecutionPolicy::LocalPredicted` (player input, cosmetic throw is instant-feeling client-side; the actual hit resolution below is server-only). `CostEffect` deducts the capture-device item via the `inventory-system` skill's item-consumption pattern — never decrement inventory counts outside a `UGameplayEffect`/inventory-component call.

On projectile hit, the throwing player's ASC sends a `FGameplayEventData` (`EventTag: Ability.Creature.Capture.DeviceHit`, `Target: HitCreature`) which triggers `GA_CaptureResolve` on the **server** via `TriggerEventData`-gated ability activation (`AbilityTriggers` array on the ability, `AbilityTrigger::GameplayEvent`).

### 3. `GA_CaptureResolve` — the seeded roll

```cpp
// Source/<Project>/Public/Abilities/Creatures/GA_CaptureResolve.h
UCLASS()
class MYGAME_API UGA_CaptureResolve : public UGameplayAbility
{
    GENERATED_BODY()
public:
    UGA_CaptureResolve();   // NetExecutionPolicy = ServerInitiated, InstancingPolicy = InstancedPerActor

    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

private:
    bool RollCaptureSuccess(const class ACreatureBase* Creature, FGameplayTag DeviceQualityTag) const;
};
```

```cpp
// Source/<Project>/Private/Abilities/Creatures/GA_CaptureResolve.cpp
bool UGA_CaptureResolve::RollCaptureSuccess(const ACreatureBase* Creature, FGameplayTag DeviceQualityTag) const
{
    check(HasAuthority(&CurrentActivationInfo)); // server-only, never called on client

    const UDA_CreatureSpecies* Species = Creature->GetSpeciesData();
    const float HealthPct = Creature->GetCombatAttributeSet()->GetHealth()
                           / FMath::Max(1.f, Creature->GetCombatAttributeSet()->GetMaxHealth());

    const float BaseChance = Species->CaptureDifficultyCurve->GetFloatValue(HealthPct);
    const float DeviceBonus = GetDeviceQualityBonus(DeviceQualityTag);   // e.g. Device.Tier1 -> +0.0, Device.Tier3 -> +0.25
    const float FinalChance = FMath::Clamp(
        BaseChance * Species->CaptureDifficultyMultiplier + DeviceBonus, 0.f, 1.f);

    // Deterministic: seed is a pure function of world seed + stable creature instance ID + attempt count,
    // never FMath::Rand()/FMath::SRand() and never wall-clock time.
    const int32 AttemptCount = Creature->GetCaptureAttemptCount();
    const uint32 Seed = GetTypeHash(FString::Printf(TEXT("%lld:%s:%d"),
        UWorldSeedSubsystem::Get(GetWorld())->GetWorldSeed(),
        *Creature->GetCreatureInstanceId().ToString(),
        AttemptCount));

    FRandomStream RollStream(Seed);
    const float Roll = RollStream.FRandRange(0.f, 1.f);
    return Roll <= FinalChance;
}
```

**Rules:**
- `GA_CaptureResolve` is `ServerInitiated` — it cannot be predicted or forged client-side. The client only receives the outcome (success/fail replicated GameplayCue + roster delta) after the server resolves it.
- `FRandomStream` seeded per the formula above, never the engine's global RNG. Re-running the same encounter (same world seed, same creature instance, same attempt count) against a save/replay must produce the identical roll and therefore the identical outcome.
- `AttemptCount` increments on every failed attempt against the same creature instance so repeated throws don't replay the identical roll forever — it's part of the seed, not a modifier to `FinalChance` (diminishing-returns-on-fail, if desired, is a separate designed curve, not a seed hack).
- On failure: the creature's `State.Creature.Weakened` tag persists (it doesn't heal instantly), it may re-aggro per `enemy-ai-behavior-tree`'s alert state, and `AttemptCount` is saved on the creature actor (not the player) so any player attempting again continues the same sequence — this is a per-creature-instance value, not per-player.

## Roster handoff

On success, `GA_CaptureResolve` calls into `UCreatureRosterComponent` on the capturing player's `PlayerState` (server-only):

```cpp
// Source/<Project>/Public/Creatures/CreatureRosterComponent.h
USTRUCT(BlueprintType)
struct FCreatureRosterEntry
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) FGuid CreatureInstanceId;
    UPROPERTY(BlueprintReadOnly) FName SpeciesID;             // FPrimaryAssetId key into UDA_CreatureSpecies
    UPROPERTY(BlueprintReadOnly) FGameplayTag Origin;          // Origin.Captured | Origin.Bred
    UPROPERTY(BlueprintReadOnly) TMap<FGameplayTag, float> TraitOverrides; // bred-instance overrides, empty for captured
    UPROPERTY(BlueprintReadOnly) bool bAssignedToParty = false;
    UPROPERTY(BlueprintReadOnly) FGuid BaseAssignmentId;        // valid if assigned to a base job, else invalid
};

UCLASS(ClassGroup = (Creatures), meta = (BlueprintSpawnableComponent))
class MYGAME_API UCreatureRosterComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UCreatureRosterComponent();

    UFUNCTION(BlueprintCallable) bool Server_InsertCaptured(const FCreatureRosterEntry& NewEntry);
    UFUNCTION(Server, Reliable, WithValidation) void Server_AssignToParty(FGuid CreatureInstanceId, int32 PartySlot);
    UFUNCTION(Server, Reliable, WithValidation) void Server_AssignToBase(FGuid CreatureInstanceId, FGuid BaseJobId);

protected:
    UPROPERTY(ReplicatedUsing = OnRep_Roster)
    TArray<FCreatureRosterEntry> Roster;   // COND_OwnerOnly

    UFUNCTION() void OnRep_Roster();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const override;
};
```

**Rules:**
- `Server_InsertCaptured` is called directly from `GA_CaptureResolve` on the server (not an RPC — it's already server-side code calling a server-side component function).
- `Server_AssignToParty` / `Server_AssignToBase` are `Server, Reliable, WithValidation` RPCs — `WithValidation` rejects assignment of a `CreatureInstanceId` the calling player's roster doesn't actually contain (never trust the client-supplied GUID without a roster lookup first).
- Party slots are capped (`MaxPartySize`, a project-tunable int, likely on a `UDA_PlayerProgressionConfig` or similar); base assignment slots are validated against `creature-work-assignment`'s job-slot availability before the entry's `BaseAssignmentId` is set — this skill only writes the assignment pointer, `creature-work-assignment` owns whether the job slot exists and what the creature does there.
- Replicate `COND_OwnerOnly` — a player's roster is private data; other players never see it unless the project explicitly wants shared-base rosters (widen deliberately, don't default open).
- On successful capture the wild pawn's `AEnemyAIController` is unpossessed and the pawn is either despawned (lightweight — the roster entry is the source of truth, a base/party creature actor is spawned fresh from `FCreatureRosterEntry` when needed) or reparented to a tamed AI controller immediately, per project preference. Either way, `enemy-ai-behavior-tree`'s wild BT stops driving the pawn the instant capture resolves server-side — don't leave the wild BT ticking against a "captured" pawn.

## Tests

- `Creature.Capture.SeededRoll.SameSeedSameOutcome` — same world seed + creature instance ID + attempt count rolled twice produces identical pass/fail and identical `Roll` value.
- `Creature.Capture.ServerAuthoritative.ClientCannotForceSuccess` — a client-forged "capture succeeded" RPC/state is rejected; only server-resolved `GA_CaptureResolve` can insert a roster entry.
- `Creature.Capture.DifficultyCurve.LowerHealthHigherChance` — `RollCaptureSuccess` chance strictly non-decreasing as `HealthPct` decreases, per `CaptureDifficultyCurve`.
- `Creature.Roster.Assignment.RejectsUnownedCreature` — `Server_AssignToParty`/`Server_AssignToBase` called with a `CreatureInstanceId` not present in the calling player's roster is rejected server-side (validation fails, no state mutation).
- `Creature.Roster.Replication.OwnerOnlyVisibility` — a second client observing the capturing player's `PlayerState` does not receive the `Roster` array contents.
- `Creature.Loyalty.HungerDrain.MatchesCurveRate` — `GE_Creature_Hunger_Drain` reduces `Hunger` at the `CT_CreatureLoyaltyRates`-specified rate over a fixed simulated duration (mirrors `survival-stats`' periodic-effect test pattern).
