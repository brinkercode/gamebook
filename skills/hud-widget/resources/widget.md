# WB_<Name> — Widget Setup

## Class

- Parent: `UCommonUserWidget` (not plain `UUserWidget` — CommonUI handles input routing)
- Create: `Content/UI/HUD/WB_<Name>.uasset`

## MVVM Binding

1. Open `WB_<Name>` in the UMG editor.
2. In the **View Bindings** panel (Window → View Bindings), click **+ Add Widget**.
3. Set **ViewModel Class**: `UVM_<Name>`.
4. Set **Creation Type**: `Resolver` — resolved by `UMVVMViewModelCollectionObject` on the HUD manager.
5. Bind widget properties:
   | Widget property | ViewModel field | Conversion |
   |---|---|---|
   | ProgressBar.Percent | `GetNormalizedValue()` | None (0–1 float) |
   | TextBlock.Text | `CurrentValue` | `FText::AsNumber` |

## Input Routing

`WB_<Name>` must be on a non-interactive layer. In the HUD manager:

```cpp
// Correct — non-interactive layer, HUD draws but never takes focus
UCommonUIExtensions::PushContentToLayer_ForPlayer(
    GetOwningLocalPlayer(), FGameplayTag::RequestGameplayTag("UI.Layer.HUD"), WB_HealthBar);
```

Layers in priority order (configure in `Project Settings → Common UI → Registered Layers`):
```
UI.Layer.HUD        — always-on HUD elements (non-interactive)
UI.Layer.Game       — gameplay popups, interaction prompts
UI.Layer.Menu       — pause menu, main menu
UI.Layer.Modal      — confirmation dialogs, fullscreen overlays
```

## Hit-Test Invisible

Set `bIsHitTestInvisible = true` on the root canvas panel of `WB_<Name>`. Prevents mouse interaction even if accidentally placed on an interactive layer. Add to the widget constructor:

```cpp
// In WB_<Name> C++ or Blueprint constructor
SetIsFocusable(false);
```

## Damage Flash Animation

Create a UMG animation `Anim_DamageFlash`:
- Track: ProgressBar → Fill Color and Opacity
- Keyframe 0.0s: palette `ColorAccent` (normal)
- Keyframe 0.1s: palette `ColorDanger` (flash)
- Keyframe 0.5s: palette `ColorAccent` (fade back)

Play from ViewModel when `CurrentValue` decreases:

```cpp
void UVM_<Name>::OnAttributeChanged(const FOnAttributeChangeData& Data)
{
    bool bTookDamage = Data.NewValue < CurrentValue;
    SetCurrentValue(Data.NewValue);
    if (bTookDamage)
    {
        // Fire a FieldNotify or custom delegate; widget Blueprint plays the animation
        UE_MVVM_BROADCAST_FIELD_VALUE_CHANGED(bPlayDamageFlash);
    }
}
```
