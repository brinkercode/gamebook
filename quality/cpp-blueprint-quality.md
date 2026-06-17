# C++ + Blueprint Quality

> Quality bar for UE5 FPS development — C++ systems, Blueprint logic, GAS patterns, and security hygiene. Read by `gameplay-systems-engineer` and `code-reviewer` on every invocation.

---

## The Golden Rule

**C++ owns systems. Blueprints consume them.**

C++ defines: classes, components, GAS abilities/effects/attributes, subsystems, interfaces, data structures.
Blueprints wire: events to C++ calls, data assets to systems, VFX/audio to gameplay moments, UI to ViewModels.

Never reverse this. A Blueprint that reimplements damage calculation or weapon state logic is a bug, not a feature.

---

## C++ Standards

### Naming

Follow UE5 prefix conventions — no exceptions, no creative variants:

| Prefix | Type |
|--------|------|
| `U` | `UObject`-derived (components, subsystems, ability tasks) |
| `A` | `AActor`-derived (characters, weapons, projectiles) |
| `F` | Plain structs, delegates |
| `E` | Enums (`UENUM`) |
| `I` | Interfaces |
| `T` | Template classes |
| `GAS_` | `UAttributeSet` subclasses |

```cpp
// Correct
UCLASS()
class MYGAME_API UWeaponComponent : public UActorComponent { ... };

USTRUCT(BlueprintType)
struct FWeaponStats { ... };

UENUM(BlueprintType)
enum class EWeaponState : uint8 { Idle, Firing, Reloading, Empty };
```

### UPROPERTY / UFUNCTION hygiene

- Mark every property that designers need to tune `UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)`. Not `BlueprintReadWrite` — designers read, programmers write via code.
- Mark every function callable from Blueprint `UFUNCTION(BlueprintCallable, Category="Weapon")`. Category is mandatory.
- Native-only functions: omit `UFUNCTION` entirely. Don't pollute BP context menus with internals.
- `BlueprintImplementableEvent` for things C++ fires, BP implements. `BlueprintNativeEvent` only when C++ needs a default implementation.

```cpp
UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon|Stats")
FWeaponStats BaseStats;

UPROPERTY(Transient, BlueprintReadOnly, Category="Weapon|State")
EWeaponState CurrentState;

UFUNCTION(BlueprintCallable, Category="Weapon")
void StartFire();

UFUNCTION(BlueprintImplementableEvent, Category="Weapon|VFX")
void OnFireVFX(const FVector& MuzzleLocation);
```

### GameplayAbility System

Every GAS surface must follow this pattern — no exceptions:

**Attribute Sets (`GAS_` prefix)**

```cpp
UCLASS()
class MYGAME_API UGAS_HeroAttributes : public UAttributeSet
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadOnly, Category="Attributes")
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSOR(UGAS_HeroAttributes, Health)

    // Override GetLifetimeReplicatedProps for multiplayer — even single-player, always implement.
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    // PreAttributeChange: clamp values here. PostGameplayEffectExecute: react to changes here.
    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
};
```

Rules:
- One `UAttributeSet` per character archetype. Don't bolt weapon stats into the hero AS.
- Use `ATTRIBUTE_ACCESSOR` macro (from `AttributeSet.h`) for all attributes. No manual getter/setter boilerplate.
- Clamp in `PreAttributeChange`. React (apply death, trigger events) in `PostGameplayEffectExecute`.
- Use `FGameplayTag` constants from a central `GameplayTags.h` — never bare `FName` strings.

**GameplayAbilities**

```cpp
UCLASS()
class MYGAME_API UGA_WeaponFire : public UGameplayAbility
{
    GENERATED_BODY()
public:
    UGA_WeaponFire();

    virtual bool CanActivateAbility(const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayTagContainer* SourceTags = nullptr,
        const FGameplayTagContainer* TargetTags = nullptr,
        FGameplayTagContainer* OptionalRelevantTags = nullptr) const override;

    virtual void ActivateAbility(const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

protected:
    UPROPERTY(EditDefaultsOnly, Category="Ability|Effects")
    TSubclassOf<UGameplayEffect> DamageEffect;

    UPROPERTY(EditDefaultsOnly, Category="Ability|Tags")
    FGameplayTag FireMontageTag;
};
```

Rules:
- Always call `EndAbility` — in the success path and every early-return path. Missing `EndAbility` locks the character.
- Use `AbilityTasks` for async behavior (wait for montage end, wait for input release). Never `FTimerHandle` inside an ability.
- Cooldowns and costs are `UGameplayEffect` subclasses — not timer logic in `ActivateAbility`.
- Tag-gate abilities with `ActivationRequiredTags` / `ActivationBlockedTags` on the ability CDO, not with if-statements in `ActivateAbility`.

**GameplayTags**

```cpp
// GameplayTags.h — single source of truth
namespace GameplayTags
{
    // Input
    MYGAME_API extern const FGameplayTag Input_Fire;
    MYGAME_API extern const FGameplayTag Input_Reload;
    MYGAME_API extern const FGameplayTag Input_Sprint;

    // State
    MYGAME_API extern const FGameplayTag State_Firing;
    MYGAME_API extern const FGameplayTag State_Reloading;
    MYGAME_API extern const FGameplayTag State_Dead;

    // Ability
    MYGAME_API extern const FGameplayTag Ability_WeaponFire;
    MYGAME_API extern const FGameplayTag Ability_Reload;
}
```

Rule: FGameplayTag constants defined once in `GameplayTags.h` and registered in `GameplayTags.cpp`. No string literals (`FGameplayTag::RequestGameplayTag(TEXT("State.Firing"))`) scattered through gameplay code.

### Subsystems over Singletons

**Never** use `static` game state or `GetWorld()->GetGameInstance()->Cast<UMyGI>()` scattered everywhere.

```cpp
// Wrong
static TWeakObjectPtr<UWeaponManager> GWeaponManager;

// Correct — UGameInstanceSubsystem
UCLASS()
class MYGAME_API UWeaponManagerSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category="Weapons")
    void RegisterWeapon(AWeaponBase* Weapon);
};

// Access from anywhere
UWeaponManagerSubsystem* WM = GetGameInstance()->GetSubsystem<UWeaponManagerSubsystem>();
```

Use:
- `UGameInstanceSubsystem` — data that outlives level transitions (inventory, loadout, session state).
- `UWorldSubsystem` — per-level systems (encounter manager, AI director).
- `ULocalPlayerSubsystem` — per-player UI state, input config.

### Enhanced Input

Bind in C++ `SetupPlayerInputComponent`. Never bind in BeginPlay with raw `InputComponent->BindAxis`.

```cpp
void AHeroCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EIC = CastChecked<UEnhancedInputComponent>(PlayerInputComponent);
    const UHeroInputConfig* InputConfig = GetDefault<UHeroInputConfig>();

    EIC->BindAction(InputConfig->IA_Fire, ETriggerEvent::Started, this, &ThisClass::Input_Fire_Started);
    EIC->BindAction(InputConfig->IA_Fire, ETriggerEvent::Completed, this, &ThisClass::Input_Fire_Completed);
    EIC->BindAction(InputConfig->IA_Move, ETriggerEvent::Triggered, this, &ThisClass::Input_Move);
}
```

Rules:
- `Input Actions` are `UInputAction` assets under `Content/Core/Input/Actions/`.
- `Input Mapping Contexts` are `UInputMappingContext` assets under `Content/Core/Input/Contexts/`.
- Modifiers and Triggers live on the IMC — not hardcoded in C++.
- Add/remove IMC via `UEnhancedInputLocalPlayerSubsystem` on `APlayerController::BeginPlay`.

### Data-Driven Design

- Systems read from `UPrimaryDataAsset` subclasses and `UDataTable` rows. They never hardcode damage values, timing, or ability parameters.
- Designers edit data assets, not class defaults of C++ classes.
- All data assets live under `Content/Data/`. All tables follow naming: `DT_<Category>_<Name>` (e.g., `DT_Weapons_Rifles`).

```cpp
UCLASS(BlueprintType)
class MYGAME_API UDA_WeaponDefinition : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon")
    FWeaponStats BaseStats;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon|Abilities")
    TSubclassOf<UGA_WeaponFire> FireAbility;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon|VFX")
    TSoftObjectPtr<UNiagaraSystem> MuzzleFlash;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon|Audio")
    FAkAudioEvent FireSound; // Wwise event reference
};
```

### File and Function Size

- Functions: 50 lines max. If it needs a comment header block to explain what it does, extract it.
- Classes: 300 lines of `.cpp` is a hint you need another class.
- `.h` files: declarations only. No implementation in headers except trivial one-liners.
- One class per `.h`/`.cpp` pair. `UWeaponComponent` lives in `WeaponComponent.h`/`WeaponComponent.cpp`.

---

## Blueprint Standards

### When Blueprint is correct

| Use BP for | Use C++ for |
|-----------|-------------|
| Wiring GAS ability grants to character Init | The ability implementation itself |
| Calling `StartFire()` on input event | Firing logic, hit detection, damage calc |
| Setting Material Instance parameters | Material parameter math |
| Playing VFX/SFX via Wwise AkAudioEvent | Wwise integration layer |
| Widget animation, UMG bindings | ViewModel data preparation |
| Level-specific event scripting | Reusable game systems |
| Content references (meshes, sounds) | Asset loading strategy |

### Mandatory migration triggers (BP → C++)

Escalate a Blueprint to C++ the moment any of these is true:

1. It contains a tick-based loop performing physics math or frequent distance checks.
2. It replicates state in a multiplayer session.
3. It directly modifies `UAttributeSet` values (must go through `UGameplayEffect`).
4. It has more than 40 nodes and is called from 3+ other Blueprints (extract to a C++ function).
5. It spawns more than 10 actors per second.
6. It uses `Delay` nodes for gameplay logic timing (use `AbilityTask_WaitDelay` or `FTimerHandle` in C++).

### Blueprint conventions

- Every custom BP node: add a `Tooltip` on the function. Nodes with no tooltip are rejected in code review.
- Variable names: `PascalCase` matching C++ UPROPERTY convention. No `myVar`, no `temp`, no `newVariable`.
- Pure functions (no side effects): mark as `Pure` in BP function settings.
- `Event Tick` is forbidden unless the owning class is explicitly approved by `gameplay-systems-engineer`. Use `FTimerDelegate` or `AbilityTask` instead.
- Compile warnings are errors. A BP that compiles with warnings does not ship.

---

## Save / Load

See [guides/save-load.md](../guides/save-load.md) for full implementation. Quality rules:

- `USaveGame` subclasses only. No writing to `GConfig` or loose `.ini` files at runtime.
- Async serialize: `AsyncSaveGameToSlot` / `AsyncLoadGameFromSlot`. Blocking saves on game thread = hitches.
- Encrypted slot files (`bEncryptSaveGame = true` on project settings or via custom serializer). Prevents trivial offline stat editing.
- Never store ability unlocks, currency, or inventory counts as plain `int32` without checksum. A bitflip or hex-edited save must not grant items.
- On load: validate all values against their attribute min/max before applying. Clamp, don't crash.

---

## Security Hygiene

### In-game microtransactions

See [rules/ue5-microtransactions.md](../rules/ue5-microtransactions.md) for the full ruleset. Enforce:

- **Never trust the client for entitlement.** Every cosmetic unlock must be verified against Steam MicroTxn API or EOS Ecom receipts server-side (or via a trusted backend).
- Cosmetics only. No stat-affecting items available for purchase. GAS attributes are never gated behind a purchase check in client code.
- Receipt validation before any `UGameplayEffect` is applied that grants an item. No local `bIsPurchased = true` flags.

### Asset integrity

- Pak encryption enabled in shipping builds (`Project Settings > Packaging > Use Pak File`, `Encrypt PAK Ini Files`, `Encrypt Assets`). Key managed outside source control.
- `UDeveloperSettings` subclasses with cheat variables must be `WITH_EDITOR` gated — not compiled into shipping.
- Console variables that expose debug state (`r.Debug.*`, custom `CVars`) must default to `0` and be read-only in shipping via `ECVF_Cheat`.

### Logging

- Never log player inventory, currency balances, or purchase receipts at `UE_LOG` verbosity levels visible in shipping.
- `UE_LOG(LogTemp, Warning, ...)` is development scaffolding — replace with domain-specific log categories or remove before shipping.
- Define a project log category: `DECLARE_LOG_CATEGORY_EXTERN(LogMyGame, Log, All)` in `MyGameModule.h`. All gameplay code uses `LogMyGame`.

---

## Code Review Checklist (`code-reviewer` runs this)

- [ ] `EndAbility` called in every `UGameplayAbility::ActivateAbility` exit path
- [ ] No `FName` string literals for tag lookups — `GameplayTags::` namespace used
- [ ] `GAS_` AttributeSet has `PreAttributeChange` clamping for every modified attribute
- [ ] No `Delay` nodes in Blueprints handling gameplay logic
- [ ] No `static` singletons — subsystem pattern used
- [ ] Data values (damage, cooldown, range) in `UDA_*` / `DT_*` data assets, not hardcoded
- [ ] `UFUNCTION(BlueprintCallable)` has `Category=` set
- [ ] No `Event Tick` in Blueprints without explicit approval
- [ ] Shipping CVars default to `0` / read-only `ECVF_Cheat`
- [ ] Save data validated and clamped on load before attribute application
- [ ] Pak encryption enabled in build config before first external playtest
