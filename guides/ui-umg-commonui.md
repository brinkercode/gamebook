# UI — UMG + Common UI Plugin

> UMG is UE5's widget framework; Common UI adds activatable-widget stacks, input routing, and platform-consistent button handling that vanilla UMG lacks. Every screen in the game is an `UCommonActivatableWidget` added to a `UCommonActivatableWidgetContainerBase` stack. View models live in C++; Blueprints bind to them. No business logic in widget Blueprints.

---

## Stack Overview

| Layer | Technology |
|-------|------------|
| Widget framework | UMG (Unreal Motion Graphics) |
| Navigation / input routing | Common UI plugin (`CommonUI`) |
| View model layer | C++ `UObject`-based view models (exposed via `UPROPERTY`) |
| Widget Blueprints | `WB_` prefix, bind to view model properties |
| Theming | Common UI Style assets + `UCommonTextStyle`, `UCommonButtonStyle` |
| Game HUD | `AHUD` subclass with a single root `UCommonActivatableWidgetStack` |
| Testing | Automated widget tests via Functional Test actors |

Enable in `.uproject`:
```json
{ "Name": "CommonUI", "Enabled": true }
```

---

## Widget Stack Architecture

Every UI surface belongs to one of three layers pushed onto the HUD stack in order:

```
HUD Root Stack (UCommonActivatableWidgetStack)
├── [0] GameLayer        — WB_HUD (health bar, ammo, crosshair) — always visible in-game
├── [1] MenuLayer        — WB_PauseMenu, WB_InventoryScreen    — pause-overlay
└── [2] ModalLayer       — WB_ConfirmDialog, WB_LoadingScreen  — top-most, blocks all input
```

### AHUD subclass

```cpp
// ProjectNameHUD.h
UCLASS()
class PROJECTNAME_API AProjectNameHUD : public AHUD
{
    GENERATED_BODY()
public:
    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category="UI")
    void PushMenuWidget(TSubclassOf<UCommonActivatableWidget> WidgetClass);

    UFUNCTION(BlueprintCallable, Category="UI")
    void PushModalWidget(TSubclassOf<UCommonActivatableWidget> WidgetClass);

protected:
    UPROPERTY(EditDefaultsOnly, Category="UI")
    TSubclassOf<UCommonActivatableWidget> GameLayerClass;

    UPROPERTY(EditDefaultsOnly, Category="UI")
    TSubclassOf<class UCommonActivatableWidgetStack> MenuLayerClass;

    UPROPERTY(EditDefaultsOnly, Category="UI")
    TSubclassOf<class UCommonActivatableWidgetStack> ModalLayerClass;

private:
    UPROPERTY()
    TObjectPtr<UCommonActivatableWidgetStack> MenuLayer;

    UPROPERTY()
    TObjectPtr<UCommonActivatableWidgetStack> ModalLayer;
};
```

```cpp
// ProjectNameHUD.cpp
void AProjectNameHUD::BeginPlay()
{
    Super::BeginPlay();

    APlayerController* PC = GetOwningPlayerController();
    if (!PC) { return; }

    // Game HUD — persistent
    if (GameLayerClass)
    {
        CreateWidget<UCommonActivatableWidget>(PC, GameLayerClass)->AddToViewport(0);
    }

    // Menu stack — modal-able
    if (MenuLayerClass)
    {
        MenuLayer = CreateWidget<UCommonActivatableWidgetStack>(PC, MenuLayerClass);
        MenuLayer->AddToViewport(1);
    }

    if (ModalLayerClass)
    {
        ModalLayer = CreateWidget<UCommonActivatableWidgetStack>(PC, ModalLayerClass);
        ModalLayer->AddToViewport(2);
    }
}

void AProjectNameHUD::PushMenuWidget(TSubclassOf<UCommonActivatableWidget> WidgetClass)
{
    if (MenuLayer && WidgetClass) { MenuLayer->AddWidget<UCommonActivatableWidget>(WidgetClass); }
}

void AProjectNameHUD::PushModalWidget(TSubclassOf<UCommonActivatableWidget> WidgetClass)
{
    if (ModalLayer && WidgetClass) { ModalLayer->AddWidget<UCommonActivatableWidget>(WidgetClass); }
}
```

---

## View Models

View models are plain `UObject` subclasses with `UPROPERTY` fields and `DECLARE_DYNAMIC_MULTICAST_DELEGATE` change notifiers. Widgets bind to these at `NativeConstruct`; they never query game state directly.

### VM_PlayerHUD.h

```cpp
#pragma once
#include "UObject/Object.h"
#include "VM_PlayerHUD.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthUpdated, float, NormalizedHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnAmmoUpdated, int32, Current, int32, Max);

UCLASS(BlueprintType)
class PROJECTNAME_API UVM_PlayerHUD : public UObject
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="ViewModel")
    void SetHealth(float Current, float Max);

    UFUNCTION(BlueprintCallable, Category="ViewModel")
    void SetAmmo(int32 Current, int32 Max);

    UPROPERTY(BlueprintReadOnly, Category="ViewModel")
    float NormalizedHealth = 1.f;

    UPROPERTY(BlueprintReadOnly, Category="ViewModel")
    int32 CurrentAmmo = 0;

    UPROPERTY(BlueprintReadOnly, Category="ViewModel")
    int32 MaxAmmo = 0;

    UPROPERTY(BlueprintAssignable, Category="ViewModel")
    FOnHealthUpdated OnHealthUpdated;

    UPROPERTY(BlueprintAssignable, Category="ViewModel")
    FOnAmmoUpdated OnAmmoUpdated;
};
```

```cpp
// VM_PlayerHUD.cpp
void UVM_PlayerHUD::SetHealth(float Current, float Max)
{
    NormalizedHealth = (Max > 0.f) ? (Current / Max) : 0.f;
    OnHealthUpdated.Broadcast(NormalizedHealth);
}

void UVM_PlayerHUD::SetAmmo(int32 Current, int32 Max)
{
    CurrentAmmo = Current;
    MaxAmmo     = Max;
    OnAmmoUpdated.Broadcast(Current, Max);
}
```

### Wiring view model in C++ HUD widget

```cpp
// WB_HUD.h (C++ base class, Blueprint subclass WB_HUD)
UCLASS()
class PROJECTNAME_API UWB_HUD : public UCommonActivatableWidget
{
    GENERATED_BODY()
protected:
    virtual void NativeConstruct() override;

    // Blueprint binds to this delegate
    UPROPERTY(BlueprintReadOnly, Category="ViewModel")
    TObjectPtr<UVM_PlayerHUD> ViewModel;

private:
    void BindToHealthComponent();
};
```

```cpp
void UWB_HUD::NativeConstruct()
{
    Super::NativeConstruct();

    ViewModel = NewObject<UVM_PlayerHUD>(this);

    // Locate HealthComponent on the owning player character
    if (APlayerController* PC = GetOwningPlayer())
    {
        if (AProjectNameCharacter* Char = Cast<AProjectNameCharacter>(PC->GetPawn()))
        {
            UHealthComponent* HC = Char->GetHealthComponent();
            HC->OnHealthChanged.AddLambda([this](float Old, float New)
            {
                ViewModel->SetHealth(New, Char->GetHealthComponent()->GetMaxHealth());
            });
            // Seed initial values
            ViewModel->SetHealth(HC->GetHealth(), HC->GetMaxHealth());
        }
    }
}
```

In the Blueprint `WB_HUD`:
- Bind `OnHealthUpdated` → update `WBP_HealthBar` fill percent.
- Bind `OnAmmoUpdated` → update `WBP_AmmoCounter` text.
- No `Tick` in Blueprint. No `GetPlayerCharacter()` calls.

---

## Common UI Button Pattern

Use `UCommonButtonBase` for all interactive buttons. It handles gamepad focus, click-on-keyboard-confirm, and platform icon injection automatically.

```cpp
// WB_ActionButton.h
UCLASS()
class PROJECTNAME_API UWB_ActionButton : public UCommonButtonBase
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="Button")
    void SetButtonText(const FText& Text);

protected:
    virtual void NativePreConstruct() override;

    UPROPERTY(meta=(BindWidget))
    TObjectPtr<class UCommonTextBlock> ButtonLabel;

    UPROPERTY(EditAnywhere, Category="Button", meta=(ExposeOnSpawn=true))
    FText DefaultLabel;
};
```

In `Config/DefaultGame.ini`, register the Common UI input action:

```ini
[/Script/CommonUI.CommonUISettings]
bAutoLoadData=True
DefaultClickAction=/Game/Input/IA_UIConfirm.IA_UIConfirm
DefaultBackAction=/Game/Input/IA_UIBack.IA_UIBack
```

---

## Input Routing — Game vs. UI Mode

Common UI manages `FReply` routing so gamepad input does not fire both game actions and UI navigation simultaneously.

```cpp
// In AProjectNamePlayerController — called when opening pause menu
void AProjectNamePlayerController::SetUIInputMode(bool bUIMode)
{
    if (bUIMode)
    {
        // Common UI recommends using its input mode over vanilla SetInputMode
        UCommonInputSubsystem* CIS = UCommonInputSubsystem::Get(GetLocalPlayer());
        if (CIS) { CIS->SetInputTypeFilter(ECommonInputType::Gamepad, false); }

        FInputModeUIOnly InputMode;
        InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
        SetInputMode(InputMode);
        bShowMouseCursor = true;
    }
    else
    {
        FInputModeGameOnly InputMode;
        SetInputMode(InputMode);
        bShowMouseCursor = false;
    }
}
```

`UCommonActivatableWidget` subclasses override `GetDesiredInputConfig()` to declare their required input mode — the stack applies it automatically when the widget becomes active:

```cpp
// WB_PauseMenu.cpp
TOptional<FUIInputConfig> UWB_PauseMenu::GetDesiredInputConfig() const
{
    // This widget wants UI-only input; game input suspended while it's on top
    return FUIInputConfig(ECommonInputMode::Menu, EMouseCaptureMode::NoCapture);
}
```

---

## Widget Conventions

| Prefix | Type |
|--------|------|
| `WB_` | Any Widget Blueprint or C++ widget class |
| `WBP_` | Widget Blueprint (Content Browser) |
| `VM_` | C++ view model class |

**File layout in Content:**

```
Content/
└── UI/
    ├── HUD/
    │   ├── WBP_HUD.uasset
    │   ├── WBP_HealthBar.uasset
    │   └── WBP_AmmoCounter.uasset
    ├── Menus/
    │   ├── WBP_PauseMenu.uasset
    │   ├── WBP_MainMenu.uasset
    │   └── WBP_InventoryScreen.uasset
    ├── Modals/
    │   ├── WBP_ConfirmDialog.uasset
    │   └── WBP_LoadingScreen.uasset
    ├── Shared/
    │   ├── WBP_ActionButton.uasset
    │   └── WBP_TooltipBase.uasset
    └── Styles/
        ├── ST_ButtonPrimary.uasset    (UCommonButtonStyle)
        └── ST_BodyText.uasset         (UCommonTextStyle)
```

---

## Common UI Style System

Define one `UCommonButtonStyle` asset per button variant (primary, secondary, danger). Blueprint button widgets reference the style asset — no per-widget color overrides.

```
ST_ButtonPrimary:
  NormalBase:  MI_Button_Normal
  HoveredBase: MI_Button_Hovered
  PressedBase: MI_Button_Pressed
  DisabledBase: MI_Button_Disabled
  NormalForeground: TextStyle_White
  PressedForeground: TextStyle_White_Dim
```

Colors and padding live in style assets only. Never hard-code RGBA in widget Blueprints.

---

## Animation — Widget Animations vs. UMG Tick

- **Idle / loop animations** (health bar pulse, radar ping): UMG Widget Animations with looping enabled.
- **State transitions** (menu slide-in, fade-out): `UCommonActivatableWidget` `BP_OnActivated` / `BP_OnDeactivated` → play the named UMG animation.
- **GAS-driven effects** (damage number pop, hit indicator flash): spawn a `WB_DamageNumber` via the HUD's `SpawnDamageNumber(float Amount, FVector WorldLocation)` C++ helper — pooled, not created per-frame.
- **No Blueprint Tick on widgets** — if you need per-frame updates (minimap rotation, cooldown progress), bind to a C++ timer or the view model delegate.

---

## Key Rules

1. **Every screen is a `UCommonActivatableWidget`** pushed onto a named stack layer. Never `AddToViewport()` directly from game logic except for the HUD root.
2. **View models mediate all data** — widgets bind to `UObject` view models, never to game actors directly.
3. **No business logic in Blueprint widgets** — Blueprint binds delegates and calls view model functions. C++ decides what data looks like.
4. **Common UI buttons everywhere** — `UCommonButtonBase` handles focus, gamepad confirm, and platform icons automatically.
5. **Input mode declared by widget** — override `GetDesiredInputConfig()` on each activatable widget. Never call `SetInputMode()` from widget logic.
6. **Styles in assets** — `UCommonButtonStyle`, `UCommonTextStyle`. No inline color or font overrides in individual widgets.
7. **`meta=(BindWidget)`** for all C++ widget bindings — compile-time validation that the named slot exists in the Blueprint.
