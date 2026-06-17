# Stack Quick Reference

> One-line definitions for the technologies the gamebook supports. Read once at the start of a task. **Project specifics live in `project.config.json`** — the agents adapt accordingly.

## Engine

| Layer | Choice | Notes |
|---|---|---|
| **Unreal Engine** | 5.4+ | 5.4 LTS baseline; 5.5/5.6 acceptable. Lock the exact version in `<Project>.uproject` `EngineAssociation`. |
| **Source** | C++ + Blueprints | C++ for systems/perf-critical paths; BP for content, UI, and rapid iteration. |
| **Build system** | UnrealBuildTool (UBT) + UnrealHeaderTool | Module `.Build.cs` files under `Source/<Project>{,Editor,Tests}/`. |

## Locked subsystems (apply to every gamebook project)

| System | Choice | Rule |
|---|---|---|
| **Abilities** | Gameplay Ability System (GAS) | All abilities = `UGameplayAbility`; all stats = `FGameplayAttribute` on `UAttributeSet`; all status = `UGameplayEffect`; all tagging = `FGameplayTag`. No hand-rolled stat/cooldown systems. |
| **Input** | Enhanced Input plugin | Input Actions (`IA_*`), Input Mapping Contexts (`IMC_*`), Modifiers, Triggers. Legacy `InputComponent::BindAction` is banned. |
| **VFX** | Niagara | `NS_*` systems, `NE_*` emitters. No Cascade. |
| **UI** | UMG + Common UI plugin | `WB_*` widgets. Common UI for input-routing, focus, activatable widgets. |
| **Asset versioning** | Git + Git LFS | No Perforce, no Plastic. `.gitattributes` tracks `*.uasset`, `*.umap`, `*.fbx`, `*.wav`, `*.psd`, `*.exr` via LFS. |
| **Save/Load** | `USaveGame` subclasses | Async serialization via `UGameplayStatics::AsyncSaveGameToSlot`. Slot files encrypted with `FAES` for tamper resistance. |
| **State pattern** | `UGameInstanceSubsystem`, `UWorldSubsystem`, `ULocalPlayerSubsystem` | Banned: global singletons, static mutable state, `GetWorld()->GetFirstPlayerController()` deep chains. |
| **Data-driven design** | Primary Data Assets + Data Tables | `UPrimaryDataAsset` subclasses for tunables; `UDataTable` for tabular data. Designers edit data, programmers edit systems. |

## Per-project scaffolder choices

| Layer | Options (default first) | Notes |
|---|---|---|
| **Audio** | Wwise · MetaSounds | Scaffolder asks. Wwise = `Cue_*`, MetaSounds = `MS_*`. Project routes through `UAkAudioEvent::PostEvent` (Wwise) or `UMetaSoundSource` (MetaSounds) — never `UGameplayStatics::PlaySound2D` ad-hoc. |
| **Networking** | Single-player (default) · Dedicated server + Replication Graph | Multiplayer is opt-in; replication graph only when `multiplayer = true` in config. |
| **Monetization** | Steam Microtransactions · EOS Ecom · Console store · None | Cosmetics-first. Never pay-to-win. All transactions server-validated. |
| **Performance baseline** | Nanite/Lumen OFF (default) · ON (post-vertical-slice opt-in) | Vertical slice targets 60 FPS on GTX 1060 / PS5-equivalent. Use traditional LODs + baked lighting until proven otherwise. |
| **Asset strategy** | Quixel Megascans + Marketplace first · In-house art minimal | Bespoke art only for hero assets (player weapon, key NPCs). |

## Project layout

```
<Project>/
├── <Project>.uproject
├── Source/
│   ├── <Project>/                  # Runtime module — gameplay, abilities, characters
│   │   ├── <Project>.Build.cs
│   │   ├── Public/
│   │   │   ├── Abilities/          # GA_*, GE_*, AttributeSet headers
│   │   │   ├── Characters/
│   │   │   ├── Components/         # UActorComponent subclasses
│   │   │   ├── Subsystems/         # GameInstance/World/LocalPlayer subsystems
│   │   │   ├── Input/              # IA_* / IMC_* C++ declarations (if any)
│   │   │   └── Save/               # USaveGame subclasses
│   │   └── Private/                # .cpp mirrors of Public/
│   ├── <Project>Editor/            # Editor-only module — custom asset editors, details panels
│   └── <Project>Tests/             # Automation tests (FAutomationTestBase)
├── Content/
│   ├── Core/                       # GameMode, GameState, PlayerController BPs; core data assets
│   ├── Characters/                 # BP_Character_* + ABP_* + SK_* + animations
│   ├── Weapons/                    # BP_Weapon_* + SM_/SK_ meshes + ability assets
│   ├── Levels/                     # LT_* streaming levels + main maps
│   ├── UI/                         # WB_* widgets, MI_UI_* materials, T_UI_* textures
│   ├── VFX/                        # NS_* / NE_*
│   ├── Audio/                      # Cue_* (Wwise) or MS_* (MetaSounds)
│   └── Data/                       # DA_* Primary Data Assets, DT_* Data Tables, E_* enums
├── Config/
│   ├── DefaultEngine.ini
│   ├── DefaultGame.ini
│   ├── DefaultInput.ini
│   └── DefaultEditor.ini
├── Plugins/                        # Project-local plugins (vendored marketplace, GAS extensions)
└── Saved/, Intermediate/, DerivedDataCache/   # gitignored
```

## Plugin baseline

Always enabled in `<Project>.uproject`:

- `GameplayAbilities` (engine) — GAS runtime
- `GameplayTags` (engine) — required by GAS
- `EnhancedInput` (engine)
- `CommonUI` (engine)
- `Niagara` (engine)
- `ModelingToolsEditorMode` (engine, editor-only) — for blockout

Per scaffolder choice:

- Wwise → `Wwise` (marketplace), or MetaSounds → `MetaSound` (engine)
- Multiplayer → `ReplicationGraph` (engine)
- Steam → `OnlineSubsystemSteam` (engine) + `SteamShared` (engine)
- EOS → `OnlineSubsystemEOS` (engine) + `EOSShared` (engine)

## Naming conventions (UE5 standard, enforced by `code-reviewer`)

| Prefix | Asset type | | Prefix | Asset type |
|---|---|---|---|---|
| `AM_` | AnimMontage | | `ABP_` | AnimBlueprint |
| `BP_` | Blueprint class | | `BP_AIController_` | AI Controller Blueprint |
| `BP_BTDecorator_` | Behavior Tree Decorator BP | | `BP_BTTask_` | Behavior Tree Task BP |
| `BB_` | Blackboard | | `BS_` | Blend Space |
| `BPI_` | Blueprint Interface | | `BT_` | Behavior Tree |
| `Cue_` | Sound Cue (Wwise event) | | `A_` | AnimSequence |
| `DA_` | Primary Data Asset | | `DT_` | Data Table |
| `E_` | Enum | | `NS_` | Niagara System |
| `NE_` | Niagara Emitter | | `PC_` | Cascade Particle System (legacy) |
| `GA_` | Gameplay Ability | | `GE_` | Gameplay Effect |
| `GAS_` | AttributeSet (C++ class) | | `IA_` | Input Action |
| `IMC_` | Input Mapping Context | | `MS_` | MetaSound Source |
| `M_` | Material | | `MI_` | Material Instance |
| `MF_` | Material Function | | `T_` | Texture |
| `SK_` | Skeletal Mesh | | `SM_` | Static Mesh |
| `S_` | Sound Wave | | `WB_` | Widget Blueprint |
| `LT_` | Level (streaming) | | | |

C++ classes follow Epic style: `U*` (UObject), `A*` (AActor), `F*` (struct), `E*` (enum), `I*` (interface).

## How agents pick a stack

Every agent reads `project.config.json` as its first action. The `stack.audio`, `stack.networking`, `stack.monetization`, and `stack.perf` fields determine which patterns apply. The locked subsystems above are not negotiable per-project — they're the gamebook contract. If `project.config.json` is missing, `/ship` and `/fix` refuse to run.
