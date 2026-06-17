---
paths:
  - "Content/**/*.uasset"
  - "Content/UI/**"
  - "Content/Characters/**"
---

# UE5 Blueprint Rules

## When to use Blueprint vs C++

| Use Blueprint | Use C++ |
|---|---|
| Wiring component references | Gameplay ability logic |
| Tweaking exposed float values | Attribute set definitions |
| Calling `BlueprintCallable` C++ functions | Replication and RPC bodies |
| UMG widget layout and binding | Save/load serialization |
| One-off level-scripting events | Any loop with per-frame work |
| Simple state machines (<5 states) | Input binding via Enhanced Input |
| Prototype that will be ported to C++ | Data Table row struct definitions |

**The heuristic**: if it has arithmetic beyond trivial addition, loops, or any cross-frame state, write it in C++.

## What Blueprint must never do

- **Never implement damage calculation in BP** — `UGameplayEffect` handles damage math. BP can trigger the effect, not compute the value.
- **Never tick-heavy Blueprint logic** — `Event Tick` in BP compiles to a virtual function call per frame with reflection overhead. If you must tick, implement `TickComponent` in C++ and call a `BlueprintCallable` notification.
- **Never direct-cast between unrelated actor types** — `Cast<ABoss>(OtherActor)` in a generic pickup Blueprint creates a hard dependency. Use `UInterface` instead: `GetInterface<IInteractable>(OtherActor)->Interact(this)`.
- **Never store mutable gameplay state in a Blueprint variable** — replicated state belongs in a `UPROPERTY(Replicated)` C++ field or a GAS `FGameplayAttributeData`. Blueprint variables do not replicate automatically.
- **Never modify replicated state from the client in BP** — call a `UFUNCTION(Server, Reliable)` C++ RPC; never write to a replicated variable from a client-side Blueprint path.

## Blueprint communication patterns

### Event Dispatcher (one-to-many, same actor)

```
// Blueprint: WeaponActor
Event Dispatcher: OnWeaponFired(AmmoRemaining: Integer)
// Called by C++ ActivatePrimaryFire() via UFUNCTION(BlueprintCallable)

// Blueprint: HUDWidget
// Binds to OnWeaponFired on BeginPlay via "Bind Event to OnWeaponFired"
```

Use Event Dispatchers for broadcasting to widgets or other components that own the actor reference.

### Blueprint Interface (decoupled message passing)

```
// C++ interface header
UINTERFACE(MinimalAPI, Blueprintable)
class UInteractable : public UInterface { GENERATED_BODY() };

class MYGAME_API IInteractable
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Interaction")
    void OnInteract(AActor* Instigator);
};
```

Use `BPI_` (Blueprint Interface prefix) for pure-Blueprint interface assets. Use C++ `UInterface` when the interface is used in C++ code paths.

### Direct reference (same BP, known type)

Acceptable only when: (a) the reference is set in the editor via `UPROPERTY(EditAnywhere)`, and (b) the types are the same parent class. Never use `GetAllActorsOfClass` in a loop to find a reference at runtime.

### Game Instance Subsystem event

For global events (game state changes, match start/end), route through a `UGameInstanceSubsystem`-backed event bus in C++. Blueprint binds to delegate exposed via `BlueprintAssignable UPROPERTY`.

## Performance rules

1. **Disable Blueprint Tick on every actor that doesn't need it** — set `PrimaryActorTick.bCanEverTick = false` in the C++ constructor. Re-enable explicitly.
2. **Move `Event Tick` logic to timers** — `SetTimer` / `SetTimerByFunctionName` reduces per-frame budget. Ideal tick rates for AI polling: 0.1s–0.5s.
3. **Avoid `Get All Actors Of Class`** — O(n) world scan every call. Cache references on `BeginPlay` or use an Actor Registry subsystem.
4. **Collapse long node chains into C++ functions** — 30+ nodes is a signal to port to `BlueprintCallable`.
5. **`Lightweight` Blueprint instances where possible** — enable `BlueprintComponentDataProvider` for Blueprint structs passed as data to avoid full object instantiation.

## Nativization warning

BP Nativization (converting Blueprint to C++ at cook time) is **deprecated in UE5** and removed in 5.4+. Do not rely on it for performance. If a Blueprint is too slow, port it to C++ manually.

## UMG / Widget Blueprint rules

See also: [ue5-input.md](ue5-input.md) for input binding in widgets, [standards.md](standards.md) for the general widget rule.

- **Widgets are reactive** — they observe state; they don't drive it. A `WB_HealthBar` binds to `UAbilitySystemComponent`'s `OnAttributeChanged` delegate; it does not own the health float.
- **`UUserWidget` C++ base class for all non-trivial widgets** — expose a `UFUNCTION(BlueprintCallable)` `SetViewModel` method that Widget BP calls. Never fetch game state inside a widget from scratch.
- **No business logic in `Construct`** — `NativeConstruct()` in C++ is for caching references only. Data initialization happens via the viewmodel or a data binding.
- **Use `UCommonActivatableWidget` from the Common UI plugin** for screens that need focus management (menus, pause screens, HUD layers). Never raw `UUserWidget` for full-screen panels.
- **`UWidgetSwitcher` for tab/state panels** — not `Set Visibility` on multiple widgets. Switcher deactivates non-visible slots.
- **Avoid Tick in widgets** — `UUserWidget::NativeTick` costs per frame even off-screen. Use C++ delegate bindings or a timer-driven refresh instead.

## Blueprint file organization

```
Content/
├── Core/
│   ├── BP_GameMode.uasset
│   ├── BP_GameState.uasset
│   └── BP_PlayerController.uasset
├── Characters/
│   ├── Player/
│   │   ├── BP_PlayerCharacter.uasset
│   │   └── ABP_PlayerCharacter.uasset    (AnimBlueprint)
│   └── Enemies/
│       ├── BP_EnemyBase.uasset
│       └── BP_Enemy_Heavy.uasset         (inherits BP_EnemyBase)
├── UI/
│   ├── HUD/
│   │   └── WB_HUD.uasset
│   └── Menus/
│       └── WB_MainMenu.uasset
└── Weapons/
    ├── BP_WeaponBase.uasset
    └── BP_Rifle.uasset
```

- **One Blueprint, one concept** — don't put enemy logic in BP_PlayerCharacter because it "shares some code". Use a C++ base class or an interface.
- **`Content/Core/` for project-wide singletons** — GameMode, GameState, PlayerController, GameInstance, PlayerController. Keep this flat.
- **Inheritance over duplication** — `BP_Enemy_Heavy` inherits `BP_EnemyBase` and overrides exposed `UPROPERTY` values. Never copy-paste a Blueprint.
