---
paths:
  - "Source/**/*.h"
  - "Source/**/*.cpp"
  - "Source/**/*.inl"
---

# UE5 C++ Rules

## Stack

- **Unreal Engine 5.7+** — C++17 standard. No deprecated UE4 patterns in new code.
- **Build system** — Unreal Build Tool (UBT). Module dependencies declared in `<Module>.Build.cs`.
- **Live Coding** — hot reload for source changes during editor sessions. Rules below keep it stable.
- **Clang on Linux/macOS, MSVC on Windows** — code must compile clean on both.

## UCLASS

Every `UCLASS` declares the minimal specifiers it actually needs. Don't cargo-cult.

```cpp
// Actor — can be placed in a level
UCLASS()
class MYGAME_API AMyActor : public AActor
{
    GENERATED_BODY()
public:
    AMyActor();
};

// Component — attached to actors
UCLASS(ClassGroup=(MyGame), meta=(BlueprintSpawnableComponent))
class MYGAME_API UMyComponent : public UActorComponent
{
    GENERATED_BODY()
};

// Object — not an actor, no world placement
UCLASS()
class MYGAME_API UMyObject : public UObject
{
    GENERATED_BODY()
};
```

- **`MYGAME_API` on every class** — required for DLL export on Windows and for other modules to link against it.
- **`GENERATED_BODY()` on the first line of every UCLASS/USTRUCT** — it must be the very first thing in the body. Never skip it.
- **Minimal specifiers** — `Abstract` only when the class cannot be instantiated. `Blueprintable` only when BP subclassing is intentional. `NotBlueprintable` on classes where BP subclassing would be dangerous.
- **Never inherit from multiple `UObject`-derived classes** — UE's GC doesn't support multiple inheritance of `UObject`. Inherit from at most one `UObject` type; use `UInterface` for the rest.

## UPROPERTY

```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Combat")
float BaseDamage = 25.f;

UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat")
TSubclassOf<UGameplayEffect> DamageEffect;

UPROPERTY(Replicated, BlueprintReadOnly, Category="State")
float CurrentHealth;

UPROPERTY(ReplicatedUsing=OnRep_Health, Category="State")
float CurrentHealth;

UPROPERTY(Transient)          // not serialized, not in editor
UAbilitySystemComponent* ASC;
```

- **Every `UObject*` field must be `UPROPERTY`** — bare `UObject*` members are invisible to the GC. They will be collected while still referenced.
- **Distinguish `EditAnywhere` vs `EditDefaultsOnly`** — `EditAnywhere` allows instance-level override in the level editor; `EditDefaultsOnly` locks it to the CDO (class-default object). Gameplay data (`BaseDamage`, `MaxHealth`) is almost always `EditDefaultsOnly`.
- **`Transient` for runtime-only references** — ASC pointers, cached component refs, delegate handles. These should not serialize to disk.
- **`Category=` on every UPROPERTY** — uncategorized properties land in "Default" and are hard to find in the editor. Group by system (`"Combat"`, `"Movement"`, `"GAS"`, `"Audio"`).
- **`ReplicatedUsing=OnRep_X` when you need a repnotify callback** — `Replicated` alone replicates the value; `ReplicatedUsing` also fires a `UFUNCTION` on the client.

## UFUNCTION

```cpp
// Callable from Blueprint
UFUNCTION(BlueprintCallable, Category="Combat")
void ActivatePrimaryFire();

// Pure getter — no side effects, no exec pin in BP
UFUNCTION(BlueprintPure, Category="Combat")
float GetCurrentHealth() const;

// Server RPC
UFUNCTION(Server, Reliable)
void ServerFireWeapon(const FVector& AimDirection);

// Client RPC
UFUNCTION(Client, Reliable)
void ClientPlayHitReaction(EHitReactType HitType);

// Multicast RPC
UFUNCTION(NetMulticast, Unreliable)
void MulticastSpawnMuzzleFlash(const FTransform& SpawnTransform);
```

- **`BlueprintImplementableEvent` for pure hooks** — no C++ implementation; Blueprint must implement it. Use sparingly — BP-only implementations are hard to track.
- **`BlueprintNativeEvent` when C++ provides a default** — declare `void MyFunc_Implementation()` in the `.cpp`. Blueprint can override.
- **`Reliable` only for critical state** — movement corrections, ability activations, death. Never `Reliable` for cosmetic RPCs (sounds, particles) — use `Unreliable` multicast.
- **No business logic in event implementations** — `MyFunc_Implementation()` delegates to a private C++ method immediately. The implementation wrapper exists only for reflection.

## USTRUCT and UENUM

```cpp
UENUM(BlueprintType)
enum class EWeaponSlot : uint8
{
    Primary   UMETA(DisplayName="Primary"),
    Secondary UMETA(DisplayName="Secondary"),
    Sidearm   UMETA(DisplayName="Sidearm"),
};

USTRUCT(BlueprintType)
struct MYGAME_API FWeaponStats
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly)
    float BaseDamage = 0.f;

    UPROPERTY(EditDefaultsOnly)
    float FireRate = 0.f;
};
```

- **`BlueprintType` on every USTRUCT and UENUM that Blueprint touches** — without it, BP cannot use the type.
- **`uint8` underlying type for all UENUM** — required when the enum is used as a `UPROPERTY`. Larger types require special handling.
- **`GENERATED_BODY()` in every USTRUCT** — skipping it breaks serialization.
- **`UPROPERTY` on every struct field exposed to editor or Blueprint** — bare fields in a USTRUCT are not editable or serialized by the reflection system.

## Header / cpp split

```cpp
// MyComponent.h — declarations only
UCLASS(ClassGroup=(MyGame), meta=(BlueprintSpawnableComponent))
class MYGAME_API UMyComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    virtual void BeginPlay() override;
    UFUNCTION(BlueprintCallable, Category="MyGame")
    void Activate();
private:
    void Internal_Activate();
    UPROPERTY()
    bool bIsActive = false;
};

// MyComponent.cpp — implementations only
#include "MyComponent.h"

void UMyComponent::BeginPlay()
{
    Super::BeginPlay();
}

void UMyComponent::Activate()
{
    Internal_Activate();
}

void UMyComponent::Internal_Activate()
{
    bIsActive = true;
}
```

- **No implementation in headers** — except `FORCEINLINE` trivial getters (one expression). Implementation in headers slows compile times and breaks Live Coding.
- **Include order**: engine includes → plugin includes → project includes → module-local includes. Use `#pragma once`, not include guards.
- **Forward-declare before including** — if a header only holds a pointer or reference to type `T`, forward-declare it instead of including its header. Cuts include chains.
- **`#include "<ClassName>.generated.h"` is always the last include** in a UCLASS header.

## Smart pointers and ownership

| Pattern | When |
|---|---|
| `TObjectPtr<T>` | UPROPERTY member referencing a UObject |
| `UPROPERTY() T*` | Alternative to TObjectPtr for pre-UE5.1 compat |
| `TWeakObjectPtr<T>` | Non-owning UObject reference; IsValid() before use |
| `TSharedPtr<T>` | Shared ownership of non-UObject heap data |
| `TUniquePtr<T>` | Exclusive ownership of non-UObject heap data |
| `TArray<TObjectPtr<T>>` | Array of GC-tracked UObject references |

- **Never use raw `new`/`delete` for UObjects** — `NewObject<T>()` or `SpawnActor<T>()` only.
- **`TWeakObjectPtr` for cross-subsystem references** — a subsystem that holds a pointer to an actor it doesn't own should use `TWeakObjectPtr`. Always `IsValid()` before dereferencing.
- **Never hold `AActor*` across frame boundaries without a UPROPERTY** — actors can be destroyed between frames. GC will null out registered `TObjectPtr` / `UPROPERTY` fields automatically.

## Module structure

```
Source/
├── MyGame/                     # Runtime module
│   ├── MyGame.Build.cs
│   ├── Public/                 # Headers other modules can include
│   │   ├── Abilities/
│   │   ├── Characters/
│   │   └── Systems/
│   └── Private/                # Implementation — not included by other modules
│       ├── Abilities/
│       ├── Characters/
│       └── Systems/
├── MyGameEditor/               # Editor-only module (editor tools, factories)
└── MyGameTests/                # Test module (Functional Tests, unit specs)
```

- **`Public/` headers are the module API** — anything implementation-specific goes in `Private/`. Other modules cannot include `Private/` headers.
- **Declare module dependencies in `Build.cs`** — `PublicDependencyModuleNames` for modules whose headers you include in `Public/`. `PrivateDependencyModuleNames` for modules used only in `Private/`. Never add to `PublicDependencyModuleNames` unless the dependency appears in a public header.
- **Separate `Editor` module for editor-only code** — editor tools, factory classes, detail customizations, asset importers. They must not link into the game runtime.

## Hot reload / Live Coding

- **Never rename a `UFUNCTION` or `UPROPERTY` without a full recompile** — Live Coding can add new symbols, but renames confuse the reflection system mid-session.
- **Avoid `static` local variables in `UFUNCTION`** — Live Coding reinitializes statics inconsistently.
- **After adding a new `UPROPERTY` to a replicated class, close and reopen any affected Blueprint** — Blueprint cached pins don't refresh on Live Coding.
- **When in doubt, close editor, rebuild from terminal, reopen** — Live Coding saves time for small changes; it introduces subtle bugs for structural changes.

## Error handling

- **`UE_LOG` with category and verbosity** — define a `DECLARE_LOG_CATEGORY_EXTERN` in your module's `Public/` header. Never use the generic `LogTemp` category in shipped code.
- **`check()` for invariants that must never be false** — crashes in debug, stripped in shipping. Don't use for recoverable errors.
- **`ensure()` for invariants that should be true** — fires a breakpoint and logs in debug, continues. Ideal for "this shouldn't happen but we can recover."
- **`ensureMsgf()` with a descriptive message** — `ensureMsgf(IsValid(ASC), TEXT("ASC null on %s during ability activation"), *GetName())`.
- **Never `check()` on user-supplied data or net data** — a malicious client can trigger a `check()` crash. Use `if (!IsValid(...)) { UE_LOG(...); return; }` for external data.
