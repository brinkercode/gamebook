# Gameplay Systems — C++ Subsystems, Components, GAS Wiring

> The canonical architecture for game logic in UE5: World/GameInstance/LocalPlayer Subsystems as service containers, Actor Components as reusable per-object behaviors, and a strict rule that no business logic lives in ACharacter, AGameMode, or APlayerController directly. Every system is a separately testable unit that Blueprints can call but cannot duplicate.

---

## Stack Overview

| Layer | Technology |
|-------|------------|
| Language | C++ (MSVC or Clang, UE5.7+) |
| Ability framework | Gameplay Ability System (GAS) |
| Input | Enhanced Input plugin |
| Async | UE `AsyncTask`, `FTimerHandle`, `UE5Coro` (opt-in) |
| Audio | Wwise AkAudioEvent calls from ability tasks |
| VFX | Niagara spawned via `UNiagaraFunctionLibrary` |
| Testing | Gauntlet / UE Functional Test framework |
| Data | Primary Data Assets + Data Tables (designers never touch C++) |

---

## Project Structure

```
Source/
├── ProjectName/
│   ├── ProjectName.h / .cpp              # Module macros, startup log category
│   ├── AbilitySystem/
│   │   ├── Attributes/
│   │   │   ├── GAS_BaseAttributeSet.h/.cpp
│   │   │   └── GAS_CombatAttributeSet.h/.cpp
│   │   ├── Abilities/
│   │   │   ├── GA_BaseGameplayAbility.h/.cpp
│   │   │   ├── GA_MeleeAttack.h/.cpp
│   │   │   └── GA_Sprint.h/.cpp
│   │   ├── Effects/
│   │   │   └── GE_DamageBase.h/.cpp      # Gameplay Effect base classes only
│   │   └── Tasks/
│   │       └── AbilityTask_PlayMontageAndWait.h   # Extended UE version
│   ├── Character/
│   │   ├── ProjectNameCharacter.h/.cpp   # Thin shell: delegates to components
│   │   ├── ProjectNamePlayerController.h/.cpp
│   │   └── Components/
│   │       ├── GAS_AbilitySystemComponent.h/.cpp  # Project ASC subclass
│   │       ├── HealthComponent.h/.cpp
│   │       ├── InventoryComponent.h/.cpp
│   │       └── WeaponComponent.h/.cpp
│   ├── Subsystems/
│   │   ├── MatchSubsystem.h/.cpp         # UWorldSubsystem — round state, scoring
│   │   ├── InventorySubsystem.h/.cpp     # UGameInstanceSubsystem — persistent inventory
│   │   └── InputConfigSubsystem.h/.cpp  # ULocalPlayerSubsystem — rebinding
│   ├── Data/
│   │   ├── DA_WeaponData.h/.cpp          # UPrimaryDataAsset subclass
│   │   ├── DA_AbilitySet.h/.cpp          # Batch ability grant asset
│   │   └── DT_DamageMultipliers.h        # FTableRowBase subclass
│   ├── Input/
│   │   ├── ProjectNameInputConfig.h/.cpp # UDataAsset: IA → GameplayTag map
│   │   └── ProjectNameEnhancedInputComponent.h/.cpp
│   └── GameFramework/
│       ├── ProjectNameGameMode.h/.cpp
│       └── ProjectNameGameState.h/.cpp
├── ProjectNameEditor/                    # Editor-only module
│   └── ...
└── ProjectNameTests/                     # Test module
    └── ...
```

---

## Subsystems Pattern

Subsystems replace singletons. Pick the lifetime that matches the data:

| Subsystem base | Lifetime | When to use |
|---|---|---|
| `UGameInstanceSubsystem` | App launch → quit | Inventory, achievements, session state |
| `UWorldSubsystem` | Level load → unload | Match state, spawn managers, AI directors |
| `ULocalPlayerSubsystem` | Player creation → removal | Input config, UI preferences, local save cache |

### InventorySubsystem.h

```cpp
#pragma once
#include "Subsystems/GameInstanceSubsystem.h"
#include "Data/DA_WeaponData.h"
#include "InventorySubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnInventoryChanged, const TArray<UDA_WeaponData*>&, NewInventory);

UCLASS()
class PROJECTNAME_API UInventorySubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category="Inventory")
    void GrantWeapon(UDA_WeaponData* WeaponData);

    UFUNCTION(BlueprintCallable, Category="Inventory")
    bool RemoveWeapon(FPrimaryAssetId WeaponAssetId);

    UFUNCTION(BlueprintPure, Category="Inventory")
    TArray<UDA_WeaponData*> GetAllWeapons() const { return OwnedWeapons; }

    UPROPERTY(BlueprintAssignable, Category="Inventory")
    FOnInventoryChanged OnInventoryChanged;

private:
    UPROPERTY()
    TArray<TObjectPtr<UDA_WeaponData>> OwnedWeapons;
};
```

### InventorySubsystem.cpp

```cpp
#include "Subsystems/InventorySubsystem.h"
#include "Engine/GameInstance.h"

void UInventorySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    // Load persisted inventory from save slot if applicable
}

void UInventorySubsystem::Deinitialize()
{
    OwnedWeapons.Empty();
    Super::Deinitialize();
}

void UInventorySubsystem::GrantWeapon(UDA_WeaponData* WeaponData)
{
    if (!WeaponData || OwnedWeapons.Contains(WeaponData)) { return; }
    OwnedWeapons.Add(WeaponData);
    OnInventoryChanged.Broadcast(OwnedWeapons);
}

bool UInventorySubsystem::RemoveWeapon(FPrimaryAssetId WeaponAssetId)
{
    const int32 Removed = OwnedWeapons.RemoveAll([&](UDA_WeaponData* W)
    {
        return W && W->GetPrimaryAssetId() == WeaponAssetId;
    });
    if (Removed > 0) { OnInventoryChanged.Broadcast(OwnedWeapons); }
    return Removed > 0;
}
```

**Accessing from anywhere:**

```cpp
// From any UObject with a World context:
UInventorySubsystem* Inv = GetGameInstance()->GetSubsystem<UInventorySubsystem>();

// From Blueprint: cast GetGameInstance → GetSubsystem node
```

---

## Actor Components

Components hold the behavior for a single responsibility. Characters compose them.

### HealthComponent.h

```cpp
#pragma once
#include "Components/ActorComponent.h"
#include "AbilitySystemInterface.h"
#include "HealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHealthChanged, float, OldValue, float, NewValue);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDeath);

UCLASS(ClassGroup=(Combat), meta=(BlueprintSpawnableComponent))
class PROJECTNAME_API UHealthComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UHealthComponent();

    // Call once from ACharacter::BeginPlay after ASC is set up.
    void InitializeWithAbilitySystem(UAbilitySystemComponent* InASC);

    UFUNCTION(BlueprintPure, Category="Health")
    float GetHealth() const;

    UFUNCTION(BlueprintPure, Category="Health")
    float GetMaxHealth() const;

    UFUNCTION(BlueprintPure, Category="Health")
    bool IsDead() const { return bIsDead; }

    UPROPERTY(BlueprintAssignable, Category="Health")
    FOnHealthChanged OnHealthChanged;

    UPROPERTY(BlueprintAssignable, Category="Health")
    FOnDeath OnDeath;

protected:
    virtual void UninitializeComponent() override;

private:
    // Bound to GAS Health attribute change delegate
    void HandleHealthChanged(const FOnAttributeChangeData& Data);
    void HandleMaxHealthChanged(const FOnAttributeChangeData& Data);

    UPROPERTY()
    TObjectPtr<UAbilitySystemComponent> AbilitySystemComponent;

    bool bIsDead = false;

    FDelegateHandle HealthChangedHandle;
    FDelegateHandle MaxHealthChangedHandle;
};
```

### HealthComponent.cpp

```cpp
#include "Character/Components/HealthComponent.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystem/Attributes/GAS_CombatAttributeSet.h"

UHealthComponent::UHealthComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UHealthComponent::InitializeWithAbilitySystem(UAbilitySystemComponent* InASC)
{
    check(InASC);
    AbilitySystemComponent = InASC;

    HealthChangedHandle = InASC->GetGameplayAttributeValueChangeDelegate(
        UGAS_CombatAttributeSet::GetHealthAttribute())
        .AddUObject(this, &UHealthComponent::HandleHealthChanged);

    MaxHealthChangedHandle = InASC->GetGameplayAttributeValueChangeDelegate(
        UGAS_CombatAttributeSet::GetMaxHealthAttribute())
        .AddUObject(this, &UHealthComponent::HandleMaxHealthChanged);
}

void UHealthComponent::UninitializeComponent()
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->GetGameplayAttributeValueChangeDelegate(
            UGAS_CombatAttributeSet::GetHealthAttribute()).Remove(HealthChangedHandle);
        AbilitySystemComponent->GetGameplayAttributeValueChangeDelegate(
            UGAS_CombatAttributeSet::GetMaxHealthAttribute()).Remove(MaxHealthChangedHandle);
    }
    Super::UninitializeComponent();
}

float UHealthComponent::GetHealth() const
{
    if (!AbilitySystemComponent) { return 0.f; }
    bool bFound = false;
    return AbilitySystemComponent->GetGameplayAttributeValue(
        UGAS_CombatAttributeSet::GetHealthAttribute(), bFound);
}

float UHealthComponent::GetMaxHealth() const
{
    if (!AbilitySystemComponent) { return 0.f; }
    bool bFound = false;
    return AbilitySystemComponent->GetGameplayAttributeValue(
        UGAS_CombatAttributeSet::GetMaxHealthAttribute(), bFound);
}

void UHealthComponent::HandleHealthChanged(const FOnAttributeChangeData& Data)
{
    OnHealthChanged.Broadcast(Data.OldValue, Data.NewValue);
    if (Data.NewValue <= 0.f && !bIsDead)
    {
        bIsDead = true;
        OnDeath.Broadcast();
    }
}

void UHealthComponent::HandleMaxHealthChanged(const FOnAttributeChangeData& Data)
{
    // Notify UI if needed
}
```

---

## Character Shell (Thin)

`AProjectNameCharacter` wires components and the ASC. No business logic here.

```cpp
// ProjectNameCharacter.h (abbreviated)
UCLASS()
class PROJECTNAME_API AProjectNameCharacter : public ACharacter,
                                              public IAbilitySystemInterface
{
    GENERATED_BODY()
public:
    AProjectNameCharacter();

    // IAbilitySystemInterface
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;

    UFUNCTION(BlueprintPure, Category="Character")
    UHealthComponent* GetHealthComponent() const { return HealthComponent; }

protected:
    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(UInputComponent* InputComponent) override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GAS")
    TObjectPtr<UGAS_AbilitySystemComponent> AbilitySystemComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Health")
    TObjectPtr<UHealthComponent> HealthComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Weapon")
    TObjectPtr<UWeaponComponent> WeaponComponent;

    // Data asset: which abilities/attributes/effects to grant at spawn
    UPROPERTY(EditDefaultsOnly, Category="GAS")
    TObjectPtr<UDA_AbilitySet> DefaultAbilitySet;

private:
    void HandleDeath();
};
```

```cpp
// ProjectNameCharacter.cpp (abbreviated)
AProjectNameCharacter::AProjectNameCharacter()
{
    AbilitySystemComponent = CreateDefaultSubobject<UGAS_AbilitySystemComponent>(TEXT("AbilitySystemComponent"));
    AbilitySystemComponent->SetIsReplicated(true);
    AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Mixed);

    HealthComponent = CreateDefaultSubobject<UHealthComponent>(TEXT("HealthComponent"));
    WeaponComponent = CreateDefaultSubobject<UWeaponComponent>(TEXT("WeaponComponent"));
}

void AProjectNameCharacter::BeginPlay()
{
    Super::BeginPlay();

    if (HasAuthority() && DefaultAbilitySet)
    {
        DefaultAbilitySet->GiveToAbilitySystem(AbilitySystemComponent, nullptr);
    }

    HealthComponent->InitializeWithAbilitySystem(AbilitySystemComponent);
    HealthComponent->OnDeath.AddUObject(this, &AProjectNameCharacter::HandleDeath);
}

void AProjectNameCharacter::HandleDeath()
{
    // Disable input, play death montage, notify GameMode
    DisableInput(Cast<APlayerController>(GetController()));
    GetWorldTimerManager().SetTimer(
        RespawnTimerHandle, this, &AProjectNameCharacter::RequestRespawn, 3.f, false);
}
```

---

## Data Assets

Designers configure abilities, weapons, and effects through Primary Data Assets. Programmers write the systems; designers tune the numbers.

### DA_WeaponData.h

```cpp
#pragma once
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "DA_WeaponData.generated.h"

UCLASS(BlueprintType)
class PROJECTNAME_API UDA_WeaponData : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId("WeaponData", GetFName());
    }

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon")
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon")
    TObjectPtr<USkeletalMesh> WeaponMesh;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Weapon")
    FGameplayTag WeaponTypeTag;   // e.g. Weapon.Rifle, Weapon.Shotgun

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Stats")
    float BaseDamage = 25.f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Stats")
    float FireRate = 0.1f;         // Seconds between shots

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Stats")
    int32 MagazineSize = 30;

    // The GAS ability to grant when this weapon is equipped
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    TSubclassOf<class UGA_BaseGameplayAbility> PrimaryFireAbility;

    // Applied to shooter on equip, removed on unequip
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    TSubclassOf<class UGameplayEffect> WeaponPassiveEffect;
};
```

### DA_AbilitySet.h

```cpp
#pragma once
#include "Engine/DataAsset.h"
#include "GameplayAbilitySpec.h"
#include "DA_AbilitySet.generated.h"

USTRUCT(BlueprintType)
struct FAbilitySetEntry
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly)
    TSubclassOf<UGameplayAbility> Ability;

    UPROPERTY(EditDefaultsOnly)
    int32 Level = 1;

    UPROPERTY(EditDefaultsOnly)
    FGameplayTag InputTag;  // Maps to Enhanced Input Action via InputConfig
};

USTRUCT(BlueprintType)
struct FAttributeSetEntry
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly)
    TSubclassOf<UAttributeSet> AttributeSet;
};

UCLASS(BlueprintType)
class PROJECTNAME_API UDA_AbilitySet : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    // Grants all abilities, attribute sets, and startup effects to the ASC.
    void GiveToAbilitySystem(UAbilitySystemComponent* ASC,
                             TArray<FGameplayAbilitySpecHandle>* OutHandles) const;

    UPROPERTY(EditDefaultsOnly, Category="Abilities")
    TArray<FAbilitySetEntry> GrantedAbilities;

    UPROPERTY(EditDefaultsOnly, Category="Attributes")
    TArray<FAttributeSetEntry> GrantedAttributeSets;

    UPROPERTY(EditDefaultsOnly, Category="Effects")
    TArray<TSubclassOf<UGameplayEffect>> GrantedEffects;
};
```

---

## Input Binding to GAS

The project uses Enhanced Input. Input Actions fire gameplay tags; the ASC activates matching abilities.

### ProjectNameInputConfig.h

```cpp
UCLASS(BlueprintType)
class PROJECTNAME_API UProjectNameInputConfig : public UDataAsset
{
    GENERATED_BODY()
public:
    // Find the InputAction bound to a given GameplayTag
    const UInputAction* FindInputActionForTag(const FGameplayTag& Tag,
                                              bool bLogNotFound = false) const;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Meta=(TitleProperty="InputTag"))
    TArray<FTaggedInputAction> AbilityInputActions;
};
```

### In AProjectNameCharacter::SetupPlayerInputComponent

```cpp
void AProjectNameCharacter::SetupPlayerInputComponent(UInputComponent* InputComponent)
{
    Super::SetupPlayerInputComponent(InputComponent);

    UProjectNameEnhancedInputComponent* EIC =
        CastChecked<UProjectNameEnhancedInputComponent>(InputComponent);

    // Bind ability input: pressed → TryActivateAbilitiesByTag, released → cancel
    EIC->BindAbilityActions(InputConfig, this,
        &ThisClass::Input_AbilityInputTagPressed,
        &ThisClass::Input_AbilityInputTagReleased,
        AbilityInputBindingHandles);

    // Native actions (move, look) bound directly
    EIC->BindNativeAction(InputConfig, ProjectNameGameplayTags::InputTag_Move,
        ETriggerEvent::Triggered, this, &ThisClass::Input_Move, false);
    EIC->BindNativeAction(InputConfig, ProjectNameGameplayTags::InputTag_Look,
        ETriggerEvent::Triggered, this, &ThisClass::Input_Look, false);
}

void AProjectNameCharacter::Input_AbilityInputTagPressed(FGameplayTag InputTag)
{
    AbilitySystemComponent->AbilityInputTagPressed(InputTag);
}

void AProjectNameCharacter::Input_AbilityInputTagReleased(FGameplayTag InputTag)
{
    AbilitySystemComponent->AbilityInputTagReleased(InputTag);
}
```

---

## GameplayTags — Native Declaration

Tags are declared in C++ and registered once. Never use raw FName strings for tags.

```cpp
// ProjectNameGameplayTags.h
#pragma once
#include "NativeGameplayTags.h"

namespace ProjectNameGameplayTags
{
    // Input
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Move);
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Look);
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Ability_PrimaryFire);
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Ability_Sprint);

    // State
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Status_Death);
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Status_Stunned);

    // Damage
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Damage_Type_Ballistic);
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Damage_Type_Explosive);

    // Weapon
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Weapon_Rifle);
    PROJECTNAME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Weapon_Shotgun);
}
```

```cpp
// ProjectNameGameplayTags.cpp
#include "ProjectNameGameplayTags.h"

namespace ProjectNameGameplayTags
{
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Move,                "InputTag.Move");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Look,                "InputTag.Look");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Ability_PrimaryFire, "InputTag.Ability.PrimaryFire");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Ability_Sprint,      "InputTag.Ability.Sprint");
    UE_DEFINE_GAMEPLAY_TAG(Status_Death,                 "Status.Death");
    UE_DEFINE_GAMEPLAY_TAG(Status_Stunned,               "Status.Stunned");
    UE_DEFINE_GAMEPLAY_TAG(Damage_Type_Ballistic,        "Damage.Type.Ballistic");
    UE_DEFINE_GAMEPLAY_TAG(Damage_Type_Explosive,        "Damage.Type.Explosive");
    UE_DEFINE_GAMEPLAY_TAG(Weapon_Rifle,                 "Weapon.Rifle");
    UE_DEFINE_GAMEPLAY_TAG(Weapon_Shotgun,               "Weapon.Shotgun");
}
```

Register `Config/DefaultGameplayTags.ini` entries only for designer-facing tags; native C++ tags self-register.

---

## Makefile Targets

```makefile
.PHONY: generate build cook test lint

# Regenerate Build.cs + module headers (run after adding new module)
generate:
	"$(UE_ROOT)/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool" \
	    -ProjectFiles -project="$(PROJECT_UPROJECT)" -game -rocket

# Development Editor build
build:
	"$(UE_ROOT)/Engine/Build/BatchFiles/Linux/Build.sh" \
	    ProjectNameEditor Linux DebugGame "$(PROJECT_UPROJECT)" -waitmutex

# Run unit / Gauntlet tests headless
test:
	"$(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(PROJECT_UPROJECT)" \
	    -ExecCmds="Automation RunTests ProjectName" -TestExit -log

# Clang-tidy via UBT (set up .clang-tidy in Source/)
lint:
	"$(UE_ROOT)/Engine/Build/BatchFiles/Linux/Build.sh" \
	    ProjectName Linux DebugGame "$(PROJECT_UPROJECT)" -StaticAnalyzer=ClangTidy
```

---

## Key Rules

1. **No business logic in Character, GameMode, or PlayerController** — they wire and delegate only.
2. **Subsystems over singletons** — `GetSubsystem<T>()` is lifetime-safe; `static T* GInstance` is not.
3. **Components own one responsibility** — if a component's header includes more than two other system headers, split it.
4. **Data Assets for all tunable values** — `EditDefaultsOnly` in a DA; never `UPROPERTY` magic numbers in C++.
5. **Native GameplayTags** — `UE_DEFINE_GAMEPLAY_TAG` in `.cpp`, `UE_DECLARE_GAMEPLAY_TAG_EXTERN` in `.h`. No raw FName tag strings outside of migration code.
6. **Input → Tag → Ability** — Enhanced Input fires a tag, the ASC routes it. Input bindings and ability logic are never in the same file.
7. **`TObjectPtr<>` for UPROPERTY members** — never raw pointer `UClass*` in modern UE5 C++.
8. **Server authority** — ability grants, attribute mutation, and game state changes only on `HasAuthority()`. See [replication-overview.md](replication-overview.md).
