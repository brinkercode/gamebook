# Binding Enhanced Input to GAS Ability Activation

## Step 1: Create Input Action

`Content/Input/Actions/IA_<Name>.uasset`
- Value Type: Digital (bool) for press/release
- Value Type: Axis1D for analog (e.g., sprint magnitude from trigger)

## Step 2: Add to Input Mapping Context

Open `Content/Input/IMC_Default.uasset` (or `IMC_Gamepad.uasset`).
Add mapping: `IA_<Name>` → `Key: <key>`.

For duration abilities (sprint, ADS) add:
- Trigger: Held — fires while held, stops on release
- Trigger: Released — fires on key up (use to cancel)

## Step 3: Bind in AMyPlayerController or AMyCharacter

```cpp
// In AMyCharacter::SetupPlayerInputComponent
void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EIC = CastChecked<UEnhancedInputComponent>(PlayerInputComponent);

    // Bind IA_Sprint to GAS activation
    EIC->BindAction(IA_Sprint, ETriggerEvent::Triggered,
        this, &AMyCharacter::Input_Sprint_Started);
    EIC->BindAction(IA_Sprint, ETriggerEvent::Completed,
        this, &AMyCharacter::Input_Sprint_Ended);
}

void AMyCharacter::Input_Sprint_Started()
{
    AbilitySystemComponent->TryActivateAbilityByClass(UGA_Sprint::StaticClass());
}

void AMyCharacter::Input_Sprint_Ended()
{
    // Cancel the ability on release (for duration abilities)
    AbilitySystemComponent->CancelAbilitiesByFunc(
        [](const UGameplayAbility* Ability, FGameplayAbilitySpecHandle Handle) {
            return Ability->IsA(UGA_Sprint::StaticClass());
        }, true);
}
```

## Alternative: AbilityInputID Pattern

Assign each ability an `int32 AbilityInputID` in `FGameplayAbilitySpec`:

```cpp
FGameplayAbilitySpec Spec(UGA_Sprint::StaticClass(), 1,
    static_cast<int32>(EAbilityInputID::Sprint), this);
AbilitySystemComponent->GiveAbility(Spec);
```

Then in input handler:
```cpp
AbilitySystemComponent->AbilityLocalInputPressed(
    static_cast<int32>(EAbilityInputID::Sprint));
```

The spec's `InputID` is matched — cleaner for many abilities, but requires the `EAbilityInputID` enum to stay in sync with input bindings. Choose one pattern and stick with it.
