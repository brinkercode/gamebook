# UCurrencySubsystem — GameInstance Subsystem

```cpp
// CurrencySubsystem.h
#pragma once
#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "CurrencySubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnBalanceChanged, int32, NewBalance);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnPurchaseResult, bool, bSuccess, FString, ItemID);

UCLASS()
class MYGAME_API UCurrencySubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    // Called on session start — loads balance from server or from save game cache
    void Initialize(FSubsystemCollectionBase& Collection) override;

    UFUNCTION(BlueprintPure, Category="Currency")
    int32 GetHardCurrencyBalance() const { return HardCurrencyBalance; }

    UFUNCTION(BlueprintCallable, Category="Currency")
    bool CanAfford(int32 Price) const { return HardCurrencyBalance >= Price; }

    // Initiates IAP for currency bundle (redirects to platform payment UI)
    UFUNCTION(BlueprintCallable, Category="Currency")
    void PurchaseCurrencyBundle(int32 BundleSKU);

    // Spends currency to buy a cosmetic — server-authoritative
    UFUNCTION(BlueprintCallable, Category="Currency")
    void PurchaseCosmetic(const FString& ItemID, int32 Price);

    // Server grants currency after successful IAP
    void ServerGrantCurrency(int32 Amount);

    // Server grants cosmetic after verified purchase
    void ServerGrantCosmetic(const FString& ItemID);

    UPROPERTY(BlueprintAssignable)
    FOnBalanceChanged OnBalanceChanged;

    UPROPERTY(BlueprintAssignable)
    FOnPurchaseResult OnPurchaseResult;

private:
    int32 HardCurrencyBalance = 0;

    void SetBalance(int32 NewBalance);
};
```

```cpp
// CurrencySubsystem.cpp
#include "CurrencySubsystem.h"
#include "Systems/SaveGameSubsystem.h"

void UCurrencySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);

    // Load cached balance from save game (display only — server is authoritative)
    USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();
    if (SS && SS->GetCurrentSave())
    {
        HardCurrencyBalance = SS->GetCurrentSave()->HardCurrencyBalance;
    }
}

void UCurrencySubsystem::PurchaseCurrencyBundle(int32 BundleSKU)
{
    // Initiate Steam MicroTxn or EOS Ecom purchase
    // See steam-microtxn.md for the server-side flow
    // The game server calls InitTxn, then SteamOverlay shows the payment UI
    // On success, server calls ServerGrantCurrency()
}

void UCurrencySubsystem::PurchaseCosmetic(const FString& ItemID, int32 Price)
{
    if (!CanAfford(Price))
    {
        OnPurchaseResult.Broadcast(false, ItemID);
        return;
    }

    // Send to game server for validation and deduction
    // Server validates balance, deducts, calls ServerGrantCosmetic on success
    // This is a server RPC in multiplayer — local prediction only for UX responsiveness
    SetBalance(HardCurrencyBalance - Price); // optimistic UI update
}

void UCurrencySubsystem::ServerGrantCurrency(int32 Amount)
{
    SetBalance(HardCurrencyBalance + Amount);

    // Persist to save game
    USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();
    if (SS && SS->GetCurrentSave())
    {
        SS->GetCurrentSave()->HardCurrencyBalance = HardCurrencyBalance;
        SS->SaveAsync(USaveGameSubsystem::DefaultSlot);
    }
}

void UCurrencySubsystem::ServerGrantCosmetic(const FString& ItemID)
{
    USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();
    if (SS && SS->GetCurrentSave())
    {
        SS->GetCurrentSave()->OwnedCosmeticIDs.AddUnique(ItemID);
        SS->SaveAsync(USaveGameSubsystem::DefaultSlot);
    }
    OnPurchaseResult.Broadcast(true, ItemID);
}

void UCurrencySubsystem::SetBalance(int32 NewBalance)
{
    HardCurrencyBalance = FMath::Max(0, NewBalance);
    OnBalanceChanged.Broadcast(HardCurrencyBalance);
}
```
