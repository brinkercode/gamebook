# Architecture

> Technical decisions and system design for {{PROJECT_NAME}}.

## Module Structure

```
Source/
  {{PROJECT_NAME}}/          # Runtime game module
    Public/
      Abilities/             # GA_* headers
      Attributes/            # GAS_* AttributeSet headers
      Characters/            # ACharacter subclasses
      Components/            # UActorComponent subclasses
      Subsystems/            # UGameInstance/World/LocalPlayerSubsystem headers
      Weapons/               # Weapon actor + component headers
    Private/                 # .cpp implementations
  {{PROJECT_NAME}}Editor/    # Editor-only utilities, custom asset factories
  {{PROJECT_NAME}}Tests/     # Functional + unit test specs
```

## GAS Topology

```
APlayerCharacter
  └─ UAbilitySystemComponent  (owning actor = APlayerState for MP; Pawn for SP)
       ├─ UGA_* (Gameplay Abilities)
       ├─ UGE_* (Gameplay Effects — instant, duration, infinite)
       └─ UGAS_* (Attribute Sets — Health, Stamina, Ammo, ...)
```

- Ability activation: through `ASC->TryActivateAbilityByTag()` — never raw function calls.
- Attribute mutation: only through `UGameplayEffect` — never `SetHealth()` from gameplay code.
- Tag authority: define all tags in `Config/DefaultGameplayTags.ini` under `+GameplayTagList`.

## Input Stack

```
APlayerController
  └─ UEnhancedInputComponent
       ├─ UInputMappingContext   (added/removed at runtime — e.g. swimming, vehicle)
       └─ UInputAction           (IA_Move, IA_Jump, IA_PrimaryFire, ...)
```

## Subsystems (preferred over Singletons)

| Subsystem class | Lifetime | Owns |
|---|---|---|
| `UGameInstanceSubsystem` | Entire play session | Save/Load, audio bus state, EOS session |
| `UWorldSubsystem` | Level lifetime | Encounter manager, AI director |
| `ULocalPlayerSubsystem` | Per local player | HUD state, input rebinding |

## Data Flow

```
Designer edits DT_*/DA_*  →  C++ system reads via UDataTable / UPrimaryDataAsset
                            →  GAS picks up from UAbilitySet DA_AbilitySet_*
                            →  UI reads from ULocalPlayerSubsystem
```

## Networking Topology

_(populate from scaffolder choice: single-player | dedicated server + Replication Graph)_

## Key Technical Decisions

_(record non-obvious choices and reasoning — e.g. why Wwise over MetaSounds, why no Lumen)_
