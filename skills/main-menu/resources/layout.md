# WBP_MainMenuLayout — CommonUI Root Layout

## Purpose

`WBP_MainMenuLayout` is the persistent root widget for the main menu level. It hosts a `UCommonActivatableWidgetStack` per UI layer. All sub-panels (main screen, settings, save slots) are pushed and popped on this stack.

## Structure

```
WBP_MainMenuLayout (UserWidget — NOT CommonActivatableWidget; this is the root)
└── Canvas Panel (full screen)
    ├── Image: BackgroundArt (full screen, static or animated)
    └── CommonActivatableWidgetStack: MenuStack (fills canvas)
        └── (initial content: WB_MainMenu — set as Default Widget in stack properties)
```

## Initial Widget

Set `WB_MainMenu` as the Default Widget on `MenuStack`. It is created and activated automatically when the layout is added to the viewport.

## Stack Navigation

```cpp
// Push Settings screen
MenuStack->AddWidget<WB_SettingsMenu>();

// WB_SettingsMenu's back button or ESC calls:
// DeactivateWidget() — pops self, returns to WB_MainMenu
```

CommonActivatableWidgetStack handles back-navigation automatically when `bAutoActivate = true` on each widget and the widget calls `DeactivateWidget()` or when the platform Back input is received.

## Input Config for WBP_MainMenuLayout

Since this is a plain `UUserWidget` (not activatable), set input mode in `AMainMenuGameMode::BeginPlay`. Each pushed `UCommonActivatableWidget` overrides input config via `GetDesiredInputConfig()`.

`WB_MainMenu::GetDesiredInputConfig()`:
```cpp
TOptional<FUIInputConfig> WB_MainMenu::GetDesiredInputConfig() const
{
    return FUIInputConfig(ECommonInputMode::Menu, EMouseCaptureMode::NoCapture);
}
```
