# Shared Patterns

> Central reference for UE5 architecture patterns. Agents read specific sections on-demand — don't load the entire file.

---

## Gameplay Ability Pattern (GAS) {#gas}

All abilities subclass `UGameplayAbility`. C++ exposes tunables via `UPROPERTY(EditDefaultsOnly)`; designers tune in BP child classes.

```cpp
// Source/MyFPS/Public/Abilities/GA_Dash.h
UCLASS()
class MYFPS_API UGA_Dash : public UGameplayAbility
{
    GENERATED_BODY()
public:
    UGA_Dash();

    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Dash")
    TSubclassOf<UGameplayEffect> CostEffect;     // GE_DashCost

    UPROPERTY(EditDefaultsOnly, Category = "Dash")
    TSubclassOf<UGameplayEffect> CooldownEffect; // GE_DashCooldown

    UPROPERTY(EditDefaultsOnly, Category = "Dash")
    float DashDistance = 600.f;
};
```

**Rules:**
- One ability, one verb (Dash, Reload, Interact). Never bundle.
- Cost and cooldown via `UGameplayEffect` — never hardcode in `ActivateAbility`.
- `CommitAbility()` before doing work; `EndAbility()` on every exit path.
- Tags on the ability (`ActivationOwnedTags`, `BlockAbilitiesWithTag`) — not checked manually in `ActivateAbility`.
- Replicated abilities use `NetExecutionPolicy::LocalPredicted` for player input, `ServerInitiated` for AI/server-driven.

---

## Attribute Set Pattern {#attribute}

One `UAttributeSet` per logical domain (player vitals, weapon stats). Use `ATTRIBUTE_ACCESSORS` macro.

```cpp
// Source/MyFPS/Public/Abilities/MyAttributeSet.h
UCLASS()
class MYFPS_API UMyAttributeSet : public UAttributeSet
{
    GENERATED_BODY()
public:
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Health)
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxHealth)
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Stamina)
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxStamina)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Health)
    FGameplayAttributeData Health;
    UFUNCTION() void OnRep_Health(const FGameplayAttributeData& Old)
    { GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Health, Old); }

    virtual void PreAttributeChange(const FGameplayAttribute& Attr, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
};
```

**Rules:**
- Clamp in `PreAttributeChange` (Health: `0..MaxHealth`).
- Apply meta attributes (Damage, Healing) in `PostGameplayEffectExecute` — convert to real attribute changes there.
- Every attribute is `ReplicatedUsing`. Register in constructor via `DOREPLIFETIME_CONDITION_NOTIFY`.
- Never mutate from outside the AttributeSet. All changes go through `UGameplayEffect`.

---

## Gameplay Effect Pattern {#effect}

`UGameplayEffect` is data-only (no logic). Configure entirely in BP child classes.

```cpp
// GE_DashCost (BP child of UGameplayEffect)
DurationPolicy: Instant
Modifiers:
  - Attribute: UMyAttributeSet::GetStaminaAttribute()
    Operation: Add
    Magnitude: -25 (FScalableFloat → CurveTable CT_StaminaCosts)
GrantedTags: (none)
AssetTags: Cost.Stamina.Dash
```

**Rules:**
- `Instant` for one-shot costs/damage; `Duration` for buffs/debuffs; `Infinite` for stances (must be manually removed).
- All magnitudes via `FScalableFloat` bound to `CurveTable` rows — designers tune in CSV.
- Cooldown effects use `Duration` with the cooldown tag in `GrantedTags`; ability checks via `ActivationBlockedTags`.

---

## Subsystem Pattern {#subsystem}

Prefer subsystems over singletons. Lifecycle-managed by the engine.

```cpp
// Source/MyFPS/Public/Subsystems/SaveGameSubsystem.h
UCLASS()
class MYFPS_API USaveGameSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable) void SaveSlotAsync(int32 Slot, const FOnSaveComplete& OnDone);
    UFUNCTION(BlueprintCallable) void LoadSlotAsync(int32 Slot, const FOnLoadComplete& OnDone);
};
```

**Rules:**
- `UGameInstanceSubsystem` for cross-level state (saves, telemetry, audio buses).
- `UWorldSubsystem` for per-level systems (encounter director, level streaming manager).
- `ULocalPlayerSubsystem` for per-player state (HUD state, settings).
- Access via `GetGameInstance()->GetSubsystem<...>()` — never cache pointers across levels.

---

## Component Pattern {#component}

`UActorComponent` (or subclass) for capabilities you add to actors. Composition over inheritance.

```cpp
UCLASS(ClassGroup = (FPS), meta = (BlueprintSpawnableComponent))
class MYFPS_API UInteractionComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UInteractionComponent();
    UFUNCTION(BlueprintCallable) bool TryInteract(AActor* Target);

protected:
    UPROPERTY(EditAnywhere) float MaxRange = 200.f;
    UPROPERTY(EditAnywhere) TEnumAsByte<ECollisionChannel> InteractTrace = ECC_Visibility;
};
```

**Rules:**
- `meta = (BlueprintSpawnableComponent)` so designers can attach in BP.
- Tick disabled by default (`PrimaryComponentTick.bCanEverTick = false`); enable explicitly only when needed.
- Never reach into `GetOwner()` for type-specific state — use interfaces or delegates.

---

## Enhanced Input Pattern {#input}

Input Actions are assets; Input Mapping Contexts bind keys to actions; PlayerController/Character binds actions to handlers.

```cpp
// In APlayerCharacter::SetupPlayerInputComponent
if (UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
{
    EIC->BindAction(IA_Move,   ETriggerEvent::Triggered, this, &APlayerCharacter::OnMove);
    EIC->BindAction(IA_Look,   ETriggerEvent::Triggered, this, &APlayerCharacter::OnLook);
    EIC->BindAction(IA_Fire,   ETriggerEvent::Started,   this, &APlayerCharacter::OnFireStart);
    EIC->BindAction(IA_Fire,   ETriggerEvent::Completed, this, &APlayerCharacter::OnFireEnd);
    EIC->BindAction(IA_Dash,   ETriggerEvent::Triggered, this, &APlayerCharacter::OnDash);
}
// Add IMC in PossessedBy / OnPossess:
if (ULocalPlayer* LP = GetController<APlayerController>()->GetLocalPlayer())
    LP->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>()->AddMappingContext(IMC_PlayerDefault, 0);
```

**Rules:**
- One `IA_*` per logical action. Modifiers (Dead Zone, Negate, Scale) replace per-platform code.
- `IMC_*` is a stack — push/pop for menus, vehicles, mini-games.
- `ETriggerEvent` matters: `Started` (press), `Triggered` (held + criteria met), `Completed` (release).
- Ability activation: bind `IA_*` to `UAbilitySystemComponent::PressInputID` via a tag map — don't call `TryActivateAbility` directly.

---

## UMG / Common UI Pattern {#umg}

Widgets are `UUserWidget` subclasses; data flows in via `UFUNCTION(BlueprintCallable)` setters or attribute delegates.

```cpp
UCLASS()
class MYFPS_API UWB_HUD : public UCommonActivatableWidget
{
    GENERATED_BODY()
protected:
    UPROPERTY(BlueprintReadOnly, meta = (BindWidget)) class UProgressBar* HealthBar;
    UPROPERTY(BlueprintReadOnly, meta = (BindWidget)) class UProgressBar* StaminaBar;

    virtual void NativeOnInitialized() override;
    UFUNCTION() void HandleHealthChanged(const FOnAttributeChangeData& Data);
};
```

**Rules:**
- `UCommonActivatableWidget` for any screen that takes focus (HUD overlays are fine as plain `UUserWidget`).
- `meta = (BindWidget)` for required child widgets; compile-time check.
- Bind to `UAbilitySystemComponent::GetGameplayAttributeValueChangeDelegate(Attr).AddUObject(...)` — never poll in Tick.
- Common UI input routing: `RegisterUIActionBinding` over `FBindWidgetActionDelegate` for back/confirm/cancel handling.

---

## Save / Load Pattern {#save}

`USaveGame` subclass holds the schema; subsystem orchestrates async I/O; slot files encrypted.

```cpp
UCLASS()
class MYFPS_API UPlayerSaveGame : public USaveGame
{
    GENERATED_BODY()
public:
    UPROPERTY() int32 SchemaVersion = 1;
    UPROPERTY() FString PlayerName;
    UPROPERTY() int32 CurrentLevelIndex;
    UPROPERTY() TArray<FGameplayTag> UnlockedAbilities;
    UPROPERTY() TArray<FInventoryEntry> Inventory;
};
```

**Rules:**
- `SchemaVersion` is the first field; migrate forward in `USaveGameSubsystem::PostLoad`.
- Async only: `UGameplayStatics::AsyncSaveGameToSlot`. Sync writes stall the game thread.
- Encrypt slot bytes with `FAES::EncryptData` using a key derived per install (never hardcode the key in shipping builds — see `SECURITY_CHECKLIST.md#save`).
- Never serialize `UObject*` raw — store soft references (`TSoftObjectPtr`) and resolve on load.

---

## Replication Pattern {#replication}

Single-player projects skip this entirely. Multiplayer projects (`networking = "multiplayer"`):

```cpp
// In header
UPROPERTY(ReplicatedUsing = OnRep_AmmoCount)
int32 AmmoCount;

UFUNCTION(Server, Reliable, WithValidation)
void Server_Reload();

// In .cpp
void AMyWeapon::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const
{
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(AMyWeapon, AmmoCount);
}
```

**Rules:**
- `Reliable` for state-changing RPCs, `Unreliable` for cosmetic.
- `WithValidation` mandatory on every Server RPC — reject invalid state server-side.
- GAS already replicates ability activation; don't reimplement.
- Replication Graph is opt-in — only enable when actor counts justify the complexity.

---

## Data-Driven Pattern {#data}

Tunables live in Data Assets / Data Tables. Code reads, designers edit.

```cpp
// Source/MyFPS/Public/Data/DA_WeaponDefinition.h
UCLASS(BlueprintType)
class MYFPS_API UDA_WeaponDefinition : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere) FName WeaponID;
    UPROPERTY(EditAnywhere) TSoftObjectPtr<USkeletalMesh> Mesh;
    UPROPERTY(EditAnywhere) float BaseDamage = 10.f;
    UPROPERTY(EditAnywhere) float FireRate = 600.f;       // RPM
    UPROPERTY(EditAnywhere) TSubclassOf<UGameplayAbility> FireAbility;
    UPROPERTY(EditAnywhere) UCurveTable* RecoilCurves;
};
```

**Rules:**
- Primary Data Assets for hand-tuned, named instances (weapons, enemies, encounters).
- Data Tables for tabular/looped data (loot drops, dialogue lines, cost curves).
- Asset Manager configured to load Primary Asset types on demand — never `LoadObject<>()` from gameplay code.
- Soft references for art assets so cooking doesn't pull the world.

---

## Niagara / VFX Pattern {#vfx}

Spawn via `UNiagaraFunctionLibrary::SpawnSystemAttached` (cosmetic, client-only) or `SpawnSystemAtLocation` (one-shots).

**Rules:**
- Cosmetic VFX never replicates — fire locally from `BlueprintImplementableEvent` hooks on the ability.
- Pool with `UNiagaraComponentPool` for high-frequency effects (muzzle flashes, impacts).
- LOD aggressively — Niagara emitters have built-in distance culling; configure per system.

---

## Audio Pattern (Wwise) {#audio-wwise}

If `audio = wwise`, all sound goes through Wwise events; never `PlaySound2D`.

```cpp
UAkGameplayStatics::PostEventAtLocation(Event_FootstepConcrete, GetActorLocation(), GetActorRotation(), GetWorld());
```

**Rules:**
- One `UAkAudioEvent` asset per logical sound (`Cue_Footstep_Concrete`, `Cue_Weapon_AR_Fire`).
- RTPCs (Real-Time Parameter Controls) for dynamic mixing — set via `UAkGameplayStatics::SetRTPCValue`.
- Switches for material-based variation (`SwitchGroup_SurfaceType`).
- Spatial audio: attach `UAkComponent` to the source actor; never use raw `PostEvent` for positional sounds.

## Audio Pattern (MetaSounds) {#audio-metasounds}

If `audio = metasounds`, use `UMetaSoundSource` assets via `UGameplayStatics::SpawnSound*` or `UAudioComponent`.

**Rules:**
- MetaSound graphs replace Sound Cues — no `Sound Cue` assets in new content.
- Parameters set via `UAudioComponent::SetFloatParameter` / `SetTriggerParameter`.

---

## Automation Test Pattern {#automation}

`FAutomationTestBase` in the `<Project>Tests` module; Functional Tests for in-world scenarios.

```cpp
// Source/MyFPSTests/Private/GA_DashTest.cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FGA_DashCostTest,
    "MyFPS.Abilities.Dash.ConsumesStamina",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FGA_DashCostTest::RunTest(const FString&)
{
    UWorld* World = FAutomationEditorCommonUtils::CreateNewMap();
    APlayerCharacter* Char = World->SpawnActor<APlayerCharacter>();
    const float Before = Char->GetAttributeSet()->GetStamina();
    Char->GetAbilitySystemComponent()->TryActivateAbilityByClass(UGA_Dash::StaticClass());
    TestEqual("Stamina drops by 25", Char->GetAttributeSet()->GetStamina(), Before - 25.f);
    return true;
}
```

**Rules:**
- Test names follow `Project.System.Behavior.Specific`.
- Functional Tests (`AFunctionalTest`) for in-level scenarios (encounter pacing, level streaming).
- Tag critical tests with `@critical` in `DefaultEngine.ini` automation filters — `make automation-critical` runs only those.
- Gauntlet for matrix runs (multiple maps × multiple platforms in CI).

---

## Logging Pattern {#logging}

Declared log categories per system; verbose for dev, log for default, warning for recoverable, error for bugs.

```cpp
DECLARE_LOG_CATEGORY_EXTERN(LogMyAbilities, Log, All);
DEFINE_LOG_CATEGORY(LogMyAbilities);

UE_LOG(LogMyAbilities, Log, TEXT("GA_Dash activated by %s"), *GetNameSafe(GetOwningActorFromActorInfo()));
```

**Rules:**
- Never `UE_LOG(LogTemp, ...)` outside throwaway debug — declare a category.
- Never log PII (Steam IDs, EOS PUIDs) at `Log` verbosity in shipping builds.
- `UE_LOG` `Warning` and above appear in shipping; `Verbose` and below stripped.
