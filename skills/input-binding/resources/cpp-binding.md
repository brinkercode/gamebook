# C++ Binding Patterns

## SetupPlayerInputComponent

```cpp
void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EIC = CastChecked<UEnhancedInputComponent>(PlayerInputComponent);

    // Digital — press
    EIC->BindAction(IA_Jump, ETriggerEvent::Started, this, &AMyCharacter::Input_Jump);
    EIC->BindAction(IA_Interact, ETriggerEvent::Started, this, &AMyCharacter::Input_Interact);

    // Digital — hold duration
    EIC->BindAction(IA_Fire, ETriggerEvent::Triggered, this, &AMyCharacter::Input_Fire);      // full-auto
    EIC->BindAction(IA_Fire, ETriggerEvent::Started,   this, &AMyCharacter::Input_FireStart); // semi-auto
    EIC->BindAction(IA_Fire, ETriggerEvent::Completed, this, &AMyCharacter::Input_FireStop);

    // Axis2D — movement
    EIC->BindAction(IA_Move, ETriggerEvent::Triggered, this, &AMyCharacter::Input_Move);
    EIC->BindAction(IA_Look, ETriggerEvent::Triggered, this, &AMyCharacter::Input_Look);

    // Duration ability — started+completed pair
    EIC->BindAction(IA_Sprint, ETriggerEvent::Started,   this, &AMyCharacter::Input_SprintStart);
    EIC->BindAction(IA_Sprint, ETriggerEvent::Completed, this, &AMyCharacter::Input_SprintStop);
}
```

## Handler Signatures

```cpp
// Digital Started — no value needed
void AMyCharacter::Input_Jump()
{
    Jump();
}

// Axis2D Triggered — value is FInputActionValue
void AMyCharacter::Input_Move(const FInputActionValue& Value)
{
    FVector2D MoveAxis = Value.Get<FVector2D>();
    AddMovementInput(GetActorForwardVector(), MoveAxis.Y);
    AddMovementInput(GetActorRightVector(),   MoveAxis.X);
}

void AMyCharacter::Input_Look(const FInputActionValue& Value)
{
    FVector2D LookAxis = Value.Get<FVector2D>();
    AddControllerYawInput(LookAxis.X);
    AddControllerPitchInput(-LookAxis.Y); // negate for natural invert
}

// Duration — sprint (activate GAS ability or set state flag)
void AMyCharacter::Input_SprintStart()
{
    AbilitySystemComponent->TryActivateAbilityByClass(UGA_Sprint::StaticClass());
}

void AMyCharacter::Input_SprintStop()
{
    AbilitySystemComponent->CancelAbilitiesByFunc(
        [](const UGameplayAbility* A, FGameplayAbilitySpecHandle) {
            return A->IsA(UGA_Sprint::StaticClass()); }, true);
}
```

## UPROPERTY declarations (set in editor)

```cpp
// AMyCharacter.h
UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_Move;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_Look;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_Jump;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_Fire;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_ADS;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_Reload;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_Interact;

UPROPERTY(EditDefaultsOnly, Category="Input")
TObjectPtr<UInputAction> IA_Sprint;
```

Set each IA_ reference in `BP_MyCharacter` defaults panel.
