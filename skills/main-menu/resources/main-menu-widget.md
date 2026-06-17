# WB_MainMenu — Main Screen Widget

## Class: `UCommonActivatableWidget`

## UMG Layout

```
WB_MainMenu (CommonActivatableWidget)
└── Canvas Panel
    ├── Image: LogoImage (top-center)
    ├── TextBlock: GameTitle (large, center-top)
    └── VerticalBox: ButtonList (center-left or center)
        ├── WB_MenuButton: "New Game"    (always visible)
        ├── WB_MenuButton: "Continue"    (visible only if save exists)
        ├── WB_MenuButton: "Settings"
        └── WB_MenuButton: "Quit"
```

`WB_MenuButton` is a `CommonButtonBase` child with a `TextBlock`.

## Button Logic (Blueprint or C++)

**NativeOnActivated** (called when widget is pushed/activated):
```cpp
void WB_MainMenu::NativeOnActivated()
{
    Super::NativeOnActivated();

    // Show/hide Continue based on save existence
    USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();
    bool bHasSave = SS->DoesSaveExist(USaveGameSubsystem::DefaultSlot);
    ContinueButton->SetVisibility(bHasSave ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);

    // Set initial focus to first button for gamepad
    SetFocusToButton(NewGameButton);
}
```

**New Game** clicked:
```cpp
// Single-slot: directly start a new game
SS->DeleteSave(USaveGameSubsystem::DefaultSlot);  // discard any existing save
SS->GetCurrentSave()->SaveTimestamp = FDateTime::Now();
UGameplayStatics::OpenLevel(this, FName("L_GameIntro")); // or first gameplay level
```

**Continue** clicked:
```cpp
// Single-slot: load default slot and open game
SS->OnLoadComplete.AddDynamic(this, &WB_MainMenu::OnSaveLoaded);
SS->LoadAsync(USaveGameSubsystem::DefaultSlot);
```

**Settings** clicked:
```cpp
// Push settings onto the stack
if (UCommonActivatableWidgetStack* Stack = GetOwningActivatableWidget<UCommonActivatableWidgetStack>())
{
    Stack->AddWidget<WB_SettingsMenu>();
}
```

**Quit** clicked:
```cpp
UKismetSystemLibrary::QuitGame(this, nullptr, EQuitPreference::Quit, false);
```

## Transition Animation

Add a UMG animation `Anim_MenuIn`:
- 0.0s: entire canvas at 0.0 opacity and Y offset +30 UU
- 0.2s: 1.0 opacity, Y offset 0

Play `Anim_MenuIn` in `NativeOnActivated`.
