---
paths:
  - "Content/**"
  - "Source/**"
---

# UE5 Naming Conventions

All asset and class names follow the UE5 community standard. Consistency is mandatory — misnamed assets cause import collisions, break redirectors, and make code reviews unreadable.

## Asset prefix table (Content/)

| Prefix | Asset type | Example |
|---|---|---|
| `BP_` | Blueprint class (Actor, Object, Component) | `BP_PlayerCharacter`, `BP_WeaponRifle` |
| `ABP_` | Animation Blueprint | `ABP_PlayerCharacter`, `ABP_Enemy_Heavy` |
| `WB_` | Widget Blueprint (UMG) | `WB_HUD`, `WB_MainMenu`, `WB_HealthBar` |
| `M_` | Material | `M_Rock_01`, `M_Weapon_Rifle` |
| `MI_` | Material Instance | `MI_Rock_Red`, `MI_Weapon_Rifle_Gold` |
| `MF_` | Material Function | `MF_BlendTwoTextures`, `MF_Parallax` |
| `T_` | Texture | `T_Rock_D`, `T_Rock_N`, `T_Rock_R` (Diffuse/Normal/Roughness) |
| `SK_` | Skeletal Mesh | `SK_PlayerCharacter`, `SK_Rifle` |
| `SM_` | Static Mesh | `SM_Rock_01`, `SM_Barrel`, `SM_Door_Frame` |
| `S_` | Sound Wave | `S_Gunshot_01`, `S_Footstep_Concrete` |
| `Cue_` | Sound Cue | `Cue_Gunshot`, `Cue_Footstep` |
| `A_` | Animation Sequence | `A_Idle`, `A_Run_Fwd`, `A_Jump_Start` |
| `AM_` | Animation Montage | `AM_Reload`, `AM_Melee_Combo_01` |
| `BS_` | Blend Space (1D or 2D) | `BS_MovementLocomotion` |
| `DA_` | Data Asset (UPrimaryDataAsset subclass) | `DA_Rifle_Default`, `DA_Enemy_Heavy` |
| `DT_` | Data Table | `DT_WeaponStats`, `DT_EnemyStats`, `DT_Dialogue` |
| `E_` | Enum (Blueprint enum) | `E_WeaponSlot`, `E_DamageType` |
| `NS_` | Niagara System | `NS_MuzzleFlash`, `NS_BloodSplatter`, `NS_Explosion` |
| `NE_` | Niagara Emitter | `NE_Spark`, `NE_SmokeTrail` |
| `LT_` | Level (streaming sub-level) | `LT_Zone_Forest_01`, `LT_Interior_Hub` |
| `GA_` | Gameplay Ability (Blueprint subclass) | `GA_PrimaryFire`, `GA_Dash`, `GA_Reload` |
| `GE_` | Gameplay Effect (Blueprint subclass) | `GE_Damage_Bullet`, `GE_Buff_Speed_5s` |
| `GAS_` | Attribute Set C++ class | `GAS_HealthSet`, `GAS_MovementSet` (C++ prefix) |
| `BPI_` | Blueprint Interface asset | `BPI_Interactable`, `BPI_Damageable` |
| `PC_` | Particle Cascade (legacy — migrate to Niagara) | `PC_OldEffect` |
| `P_` | Particle System (Cascade alias) | `P_Legacy_Explosion` |
| `BP_AIController_` | AI Controller Blueprint | `BP_AIController_Enemy_Heavy` |
| `BP_BTTask_` | Behavior Tree Task BP | `BP_BTTask_AttackPlayer` |
| `BP_BTDecorator_` | Behavior Tree Decorator BP | `BP_BTDecorator_IsInRange` |
| `BT_` | Behavior Tree asset | `BT_Enemy_Heavy`, `BT_EnemyPatrol` |
| `BB_` | Blackboard asset | `BB_Enemy` |

## C++ class prefix table (Source/)

| Prefix | Base class | Example |
|---|---|---|
| `A` | `AActor` | `AMyCharacter`, `AMyProjectile` |
| `U` | `UObject`, `UActorComponent` | `UMyComponent`, `UMyAbility` |
| `F` | Plain struct | `FWeaponStats`, `FHitResult` |
| `E` | Enum | `EWeaponSlot`, `EDamageType` |
| `I` | Interface | `IInteractable`, `IDamageable` |
| `T` | Template class | `TArray`, `TMap` (engine usage) |
| `S` | Slate widget | `SMyWidget` (editor tooling only) |

## Variable and function naming (C++)

```cpp
// Member variables — PascalCase with no m_ prefix (UE convention)
float BaseDamage;
bool bIsReloading;          // bool members are prefixed with b
TObjectPtr<UWeaponData> WeaponData;

// Local variables — camelCase or PascalCase both acceptable; be consistent per file
float finalDamage = BaseDamage * DamageMultiplier;

// Functions — PascalCase, verb-first
void ActivatePrimaryFire();
bool CanActivateAbility() const;
float GetCurrentHealth() const;
void OnRep_Health(float OldHealth);  // RepNotify: OnRep_ prefix
void Server_FireWeapon();            // Server RPC: Server_ prefix
void Client_PlayHitReact();          // Client RPC: Client_ prefix
void Multicast_SpawnMuzzleFlash();   // Multicast: Multicast_ prefix
```

- **Boolean member variables begin with `b`** — `bIsAiming`, `bCanJump`, `bIsAlive`. Without the prefix, blueprint-exposed booleans look like any other property.
- **No Hungarian notation** (`m_Health`, `s_Instance`, `g_Manager`)** — UE does not use it; don't introduce it.
- **Verbs for functions, nouns for properties** — `GetHealth()` not `Health()`. `bIsReloading` not `Reloading`.

## Gameplay Tag naming

Tags use dot-separated `PascalCase.PascalCase` hierarchy:

```
Ability.Primary.Fire
Ability.Secondary.Dash
Ability.Utility.Reload
Status.Stunned
Status.Burning
Status.Invulnerable
Effect.Damage.Fire
Effect.Damage.Ballistic
Effect.Buff.Speed
Input.Jump
Input.PrimaryFire
UI.Menu.Pause
```

- **Root namespace matches the system** — `Ability.*`, `Status.*`, `Effect.*`, `Input.*`, `UI.*`.
- **Never use underscores in tag names** — dots are the separator. `Status.Stun_Recovery` is wrong; use `Status.StunRecovery`.
- **Tags are defined in C++** (`UE_DEFINE_GAMEPLAY_TAG`) and registered in `Config/DefaultGameplayTags.ini`. Blueprint-only tags are hard to find and refactor.

## Content folder naming

```
Content/
├── Core/           # GameMode, GameState, PlayerController, GameInstance
├── Characters/
│   ├── Player/
│   └── Enemies/
│       ├── Heavy/
│       └── Scout/
├── Weapons/
│   ├── Rifle/
│   └── Shotgun/
├── Levels/
│   ├── MainMenu/
│   └── Zone_01/
├── UI/
│   ├── HUD/
│   └── Menus/
├── VFX/
│   ├── Impacts/
│   └── Abilities/
├── Audio/          # Wwise banks, MetaSounds, Sound Cues
├── Data/           # DT_ DataTables, DA_ DataAssets
└── Materials/
    ├── Master/     # M_ base materials
    ├── Instances/  # MI_ instances
    └── Functions/  # MF_ functions
```

- **No spaces in folder or asset names** — the cooker and some automation tools break on spaces.
- **No special characters** — only alphanumerics and underscores in asset names. No dashes, no dots (except the UE extension `.uasset`).
- **Numbered variants use zero-padded two digits** — `SM_Rock_01`, `SM_Rock_02`, not `SM_Rock_1`, `SM_Rock_10`. Alphabetic sort stays consistent.
