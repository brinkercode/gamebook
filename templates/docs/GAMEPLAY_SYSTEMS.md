# Gameplay Systems

> GAS surface, weapon systems, movement, AI, and all C++ subsystems for {{PROJECT_NAME}}.
> Source of truth for `blueprint-feature-builder` — read before any content wiring.

## Attribute Sets

| AttributeSet class | Attributes | Replicated |
|---|---|---|
| `UGAS_HealthSet` | `Health`, `MaxHealth` | Yes — `COND_None` |
| `UGAS_StaminaSet` | `Stamina`, `MaxStamina` | Yes — `COND_OwnerOnly` |
| `UGAS_AmmoSet` | `Ammo`, `MaxAmmo`, `ReserveAmmo` | Yes — `COND_OwnerOnly` |

_(add rows as systems are implemented)_

## Gameplay Tags (canonical list)

Defined in `Config/DefaultGameplayTags.ini`. Categories:

- `Ability.*` — ability identifiers (`Ability.Sprint`, `Ability.PrimaryFire`, ...)
- `Status.*` — transient state tags (`Status.Dead`, `Status.Sprinting`, ...)
- `Weapon.*` — weapon type tags (`Weapon.Rifle`, `Weapon.Shotgun`, ...)
- `Effect.*` — effect-applied tags (`Effect.Burning`, `Effect.Slowed`, ...)
- `Input.*` — input-triggered events used as ability triggers

## Abilities (GA_*)

| Class | Tag | Activation | Cost | Cooldown | Replicated |
|---|---|---|---|---|---|
| `UGA_Sprint` | `Ability.Sprint` | Input hold | `GE_Cost_Stamina` | none | Server |
| `UGA_PrimaryFire` | `Ability.PrimaryFire` | Input pressed | `GE_Cost_Ammo` | `GE_CD_FireRate` | Server |

_(expand as abilities are added)_

## Gameplay Effects (GE_*)

| Class | Type | Duration | Applied by |
|---|---|---|---|
| `UGE_Cost_Stamina` | Instant | — | `UGA_Sprint` |
| `UGE_Regen_Health` | Infinite | — | Passive on full armor |
| `UGE_Damage_Ballistic` | Instant | — | Projectile hit |

## Weapons

- Base class: `AWeaponBase` (actor) + `UWeaponComponent` (component on `ACharacter`).
- Weapon data: `DA_Weapon_<Name>` (Primary Data Asset) — all tuning lives here.
- Fire mode: hitscan or projectile declared in `DA_Weapon_<Name>.FireMode`.
- Recoil: `UCurveFloat` referenced from Data Asset — never hardcoded.

## Movement

- Character movement: `UCharacterMovementComponent` subclass `UProjCharacterMovement`.
- Sprinting: managed by `UGA_Sprint` — sets `MaxWalkSpeed` via `GE_Modifier_SpeedBoost`.
- Mantling / vaulting: _(implemented / planned / out of scope)_

## AI

- Director: `UWorldSubsystem` `UEncounterDirectorSubsystem` — spawns and budgets enemies.
- Behavior: Behavior Trees in `Content/Core/AI/`. Each enemy type has `BT_Enemy_<Type>`.
- Perception: `UAIPerceptionComponent` — sight + hearing. Noise events via `UAISense_Hearing`.
- EQS queries in `Content/Core/AI/EQS/` — used for cover selection and spawn placement.

## Save / Load

- Save class: `UProjSaveGame` — async write via `UGameplayStatics::AsyncSaveGameToSlot`.
- Slot names: `"MainSave"`, `"Settings"` — no dynamic slot naming.
- Encryption: XOR + per-build salt for tamper resistance. See `UProjSaveGame::Serialize`.

## Subsystem Registry

| Class | Lifetime | Responsibility |
|---|---|---|
| `UAudioStateSubsystem` | GameInstance | Wwise RTPC / State management |
| `UEncounterDirectorSubsystem` | World | Enemy spawning + budget |
| `UInputRebindSubsystem` | LocalPlayer | IMC swap + save/load keybinds |
| `USaveLoadSubsystem` | GameInstance | Async slot I/O |
