# WB_InteractionPrompt — Widget

## Structure

```
WB_InteractionPrompt (UCommonUserWidget — non-activatable, HUD layer)
└── HorizontalBox (centered bottom-third of screen)
    ├── Image: KeyGlyph    (E key icon or gamepad glyph)
    ├── TextBlock: ActionLabel ("Open", "Pick Up", "Talk")
    └── TextBlock: ObjectLabel (optional — "Door", "Medkit")
```

Set `SetIsFocusable(false)` in constructor. This widget never takes input focus.

## Lifecycle

Subscribe to `UInteractionComponent::OnFocusedInteractableChanged` in `NativeConstruct`:

```cpp
void WB_InteractionPrompt::NativeConstruct()
{
    Super::NativeConstruct();

    AMyCharacter* Char = Cast<AMyCharacter>(GetOwningPlayerPawn());
    if (!Char) return;

    InteractionComp = Char->FindComponentByClass<UInteractionComponent>();
    if (InteractionComp)
    {
        InteractionComp->OnFocusedInteractableChanged.AddDynamic(
            this, &WB_InteractionPrompt::OnFocusedInteractableChanged);
    }
}

void WB_InteractionPrompt::OnFocusedInteractableChanged(AActor* NewFocusedActor)
{
    if (!NewFocusedActor)
    {
        SetVisibility(ESlateVisibility::Collapsed);
        return;
    }

    FText Prompt = IInteractableInterface::Execute_GetInteractPrompt(NewFocusedActor);
    ActionLabel->SetText(Prompt);

    bool bCanInteract = IInteractableInterface::Execute_CanInteract(
        NewFocusedActor, GetOwningPlayerPawn());
    // Grey out if blocked
    ActionLabel->SetColorAndOpacity(bCanInteract
        ? FSlateColor(FLinearColor::White)
        : FSlateColor(FLinearColor(0.5f, 0.5f, 0.5f)));

    // Update glyph based on current input device
    UpdateKeyGlyph();

    SetVisibility(ESlateVisibility::Visible);
}
```

## Key Glyph

Use `UCommonUILibrary::GetInputTypeFromController` to detect current input:

```cpp
void WB_InteractionPrompt::UpdateKeyGlyph()
{
    ECommonInputType InputType = UCommonUILibrary::GetInputTypeFromController(
        GetOwningPlayer());

    if (InputType == ECommonInputType::Gamepad)
    {
        KeyGlyph->SetBrushFromTexture(T_Glyph_Square_PS5); // or Y for Xbox
    }
    else
    {
        KeyGlyph->SetBrushFromTexture(T_Glyph_E_KBM);
    }
}
```

Store glyph textures as `UPROPERTY(EditDefaultsOnly)` on the widget class so they can be swapped per platform without code changes.

## Placement

Added to HUD via `AMyHUD::BeginPlay`:
```cpp
UCommonUIExtensions::PushContentToLayer_ForPlayer(
    GetOwningLocalPlayer(),
    FGameplayTag::RequestGameplayTag("UI.Layer.HUD"),
    WB_InteractionPromptClass);
```

Starts collapsed. Becomes visible only when `OnFocusedInteractableChanged` fires with a non-null actor.
