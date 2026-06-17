# UVM_<Name> — ViewModel

## Header: `Source/<Project>/UI/ViewModels/VM_<Name>.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "MVVMViewModelBase.h"
#include "VM_<Name>.generated.h"

UCLASS(BlueprintType)
class MYGAME_API UVM_<Name> : public UMVVMViewModelBase
{
    GENERATED_BODY()

public:
    // Bindable property — widget binds to this
    UPROPERTY(BlueprintReadWrite, FieldNotify, Setter, Getter, Category="HUD")
    float CurrentValue = 0.0f;

    UPROPERTY(BlueprintReadWrite, FieldNotify, Setter, Getter, Category="HUD")
    float MaxValue = 100.0f;

    // Derived property (computed, no separate notify needed if driven by above)
    UFUNCTION(BlueprintPure, FieldNotify, Category="HUD")
    float GetNormalizedValue() const { return MaxValue > 0.f ? CurrentValue / MaxValue : 0.f; }

    // Called from HUD manager after ASC is available
    UFUNCTION(BlueprintCallable, Category="HUD")
    void Initialize(UAbilitySystemComponent* ASC);

private:
    UFUNCTION()
    void OnAttributeChanged(const FOnAttributeChangeData& Data);

    TWeakObjectPtr<UAbilitySystemComponent> WeakASC;
    FDelegateHandle AttributeChangedHandle;

    void SetCurrentValue(float NewValue);
    float GetCurrentValue() const { return CurrentValue; }
    void SetMaxValue(float NewValue);
    float GetMaxValue() const { return MaxValue; }
};
```

## Implementation: `Source/<Project>/UI/ViewModels/VM_<Name>.cpp`

```cpp
#include "VM_<Name>.h"
#include "AbilitySystemComponent.h"
// Include the AttributeSet that owns the attribute
#include "GAS/AttributeSets/PlayerAttributeSet.h"

void UVM_<Name>::Initialize(UAbilitySystemComponent* ASC)
{
    if (!ASC) return;
    WeakASC = ASC;

    // Read initial value
    bool bFound = false;
    float Initial = ASC->GetGameplayAttributeValue(
        UPlayerAttributeSet::GetHealthAttribute(), bFound);
    if (bFound)
    {
        SetCurrentValue(Initial);
        SetMaxValue(ASC->GetGameplayAttributeValue(
            UPlayerAttributeSet::GetMaxHealthAttribute(), bFound));
    }

    // Subscribe to future changes
    AttributeChangedHandle = ASC->GetGameplayAttributeValueChangeDelegate(
        UPlayerAttributeSet::GetHealthAttribute())
        .AddUObject(this, &UVM_<Name>::OnAttributeChanged);
}

void UVM_<Name>::OnAttributeChanged(const FOnAttributeChangeData& Data)
{
    SetCurrentValue(Data.NewValue);
}

void UVM_<Name>::SetCurrentValue(float NewValue)
{
    if (FMath::IsNearlyEqual(CurrentValue, NewValue)) return;
    UE_MVVM_SET_PROPERTY_VALUE(CurrentValue, NewValue);
}

void UVM_<Name>::SetMaxValue(float NewValue)
{
    if (FMath::IsNearlyEqual(MaxValue, NewValue)) return;
    UE_MVVM_SET_PROPERTY_VALUE(MaxValue, NewValue);
}
```

`UE_MVVM_SET_PROPERTY_VALUE` macro fires the `FieldNotify` change notification — do not set the member directly or the widget binding will not update.
