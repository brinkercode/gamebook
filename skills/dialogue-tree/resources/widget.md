# WB_Dialogue — Widget Setup

## Structure

`Content/UI/Dialogue/WB_Dialogue.uasset` — parent: `UCommonActivatableWidget`

Using `UCommonActivatableWidget` (not plain `UUserWidget`) so the widget handles input mode correctly — it receives gamepad/keyboard navigation, and the underlying game input is suppressed while active.

## UMG Layout

```
WB_Dialogue (CommonActivatableWidget)
└── Canvas Panel (full screen, hit-test invisible background)
    └── Border (bottom third of screen, semi-transparent)
        ├── TextBlock: SpeakerName   (bold, 20pt)
        ├── TextBlock: LineText      (16pt, multiline, wrapped)
        └── WrapBox: ResponseList
            └── (dynamically populated) WB_DialogueResponse × N
```

## WB_DialogueResponse

A small button widget:
```
WB_DialogueResponse (CommonButtonBase)
└── TextBlock: ResponseText
```

## Blueprint Events

**`On Dialogue Line Changed`** delegate from `UDialogueSubsystem`:
1. Set `SpeakerName.Text` to `Line.SpeakerName`
2. Set `LineText.Text` to `Line.LineText`
3. Clear `ResponseList` children
4. For each response in Responses array: create `WB_DialogueResponse`, set text, bind click → `SelectResponse(Index)`

**`On Dialogue Ended`** delegate:
1. Call `DeactivateWidget()` — CommonUI pops this widget from the stack

## Widget Lifecycle

Push when dialogue starts:
```cpp
// In AMyPlayerController or in the NPC interaction handler
void AMyPlayerController::OpenDialogue(UDA_DialogueTree* Tree, AActor* NPC)
{
    UDialogueSubsystem* DS = GetWorld()->GetSubsystem<UDialogueSubsystem>();
    DS->StartDialogue(Tree, NPC);

    UCommonUIExtensions::PushContentToLayer_ForPlayer(
        GetLocalPlayer(),
        FGameplayTag::RequestGameplayTag("UI.Layer.Game"),
        WB_DialogueClass);
}
```

`WB_Dialogue`'s `NativeOnActivated()` subscribes to `UDialogueSubsystem::OnDialogueLineChanged`.
`WB_Dialogue`'s `NativeOnDeactivated()` unsubscribes all delegates.

## Input Routing

`UCommonActivatableWidget` sets `ESlateVisibility::SelfHitTestInvisible` on non-interactive elements and handles focus correctly. Override `GetDesiredInputConfig`:

```cpp
TOptional<FUIInputConfig> WB_Dialogue::GetDesiredInputConfig() const
{
    // Accept all gamepad + keyboard input; suppress game inputs
    return FUIInputConfig(ECommonInputMode::Menu, EMouseCaptureMode::NoCapture);
}
```
