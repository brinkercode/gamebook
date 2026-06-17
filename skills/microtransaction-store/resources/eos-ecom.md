# EOS Ecom — Entitlement Check and Item Grant

EOS Ecom is used for Epic Games Store distribution and cross-platform entitlement tracking. It does not replace Steam MicroTxn on Steam — both systems run in parallel for cross-platform releases.

## EOS Ecom Flow

```
On Session Start:
  EOS_Ecom_QueryEntitlements(LocalUserId) →
    EOS_Ecom_GetEntitlementsCount() →
      iterate EOS_Ecom_CopyEntitlementByIndex() →
        for each unacknowledged entitlement:
          GrantItem(entitlement.ItemId) →
          EOS_Ecom_RedeemEntitlements([entitlement.Id]) → acknowledge

On Purchase:
  EOS_Ecom_Checkout(CheckoutOptions) →
    EOS_UI_ShowNativeUIAddOns (Epic Games launcher overlay) →
    On complete: re-run QueryEntitlements to pick up new items
```

## C++ Implementation

```cpp
// In UGameInstance::OnLoginSuccess() or on session start

void UMyGameInstance::QueryEOSEntitlements()
{
    EOS_Ecom_QueryEntitlementsOptions Options = {};
    Options.ApiVersion = EOS_ECOM_QUERYENTITLEMENTS_API_LATEST;
    Options.LocalUserId = EcomHandle; // EOS_EcomHInterface from EOS_Platform
    Options.bIncludeRedeemed = EOS_FALSE;

    EOS_Ecom_QueryEntitlements(EcomHandle, &Options,
        this,
        [](const EOS_Ecom_QueryEntitlementsCallbackInfo* Data) {
            if (Data->ResultCode == EOS_EResult::EOS_Success)
            {
                static_cast<UMyGameInstance*>(Data->ClientData)->OnEntitlementsQueried();
            }
        });
}

void UMyGameInstance::OnEntitlementsQueried()
{
    EOS_Ecom_GetEntitlementsCountOptions CountOptions = {};
    CountOptions.ApiVersion = EOS_ECOM_GETENTITLEMENTSCOUNT_API_LATEST;
    CountOptions.LocalUserId = LocalUserId;
    uint32_t Count = EOS_Ecom_GetEntitlementsCount(EcomHandle, &CountOptions);

    TArray<EOS_Ecom_EntitlementId> ToRedeem;

    for (uint32_t i = 0; i < Count; ++i)
    {
        EOS_Ecom_CopyEntitlementByIndexOptions CopyOptions = {};
        CopyOptions.ApiVersion = EOS_ECOM_COPYENTITLEMENTBYINDEX_API_LATEST;
        CopyOptions.LocalUserId = LocalUserId;
        CopyOptions.EntitlementIndex = i;

        EOS_Ecom_Entitlement* Entitlement = nullptr;
        if (EOS_Ecom_CopyEntitlementByIndex(EcomHandle, &CopyOptions, &Entitlement)
            == EOS_EResult::EOS_Success)
        {
            FString ItemId = UTF8_TO_TCHAR(Entitlement->ItemId);
            // Grant the item
            UCurrencySubsystem* CS = GetSubsystem<UCurrencySubsystem>();
            CS->ServerGrantCosmetic(ItemId);

            ToRedeem.Add(Entitlement->EntitlementId);
            EOS_Ecom_Entitlement_Release(Entitlement);
        }
    }

    // Acknowledge all granted entitlements
    if (ToRedeem.Num() > 0)
    {
        EOS_Ecom_RedeemEntitlementsOptions RedeemOptions = {};
        RedeemOptions.ApiVersion = EOS_ECOM_REDEEMENTITLEMENTS_API_LATEST;
        RedeemOptions.LocalUserId = LocalUserId;
        RedeemOptions.EntitlementIdCount = static_cast<uint32_t>(ToRedeem.Num());
        RedeemOptions.EntitlementIds = ToRedeem.GetData();
        EOS_Ecom_RedeemEntitlements(EcomHandle, &RedeemOptions, nullptr, nullptr);
    }
}
```

## EOS Checkout (In-Game Purchase)

```cpp
void UCurrencySubsystem::PurchaseCurrencyBundle_EOS(const FString& OfferId)
{
    EOS_Ecom_CheckoutEntry Entry = {};
    Entry.ApiVersion = EOS_ECOM_CHECKOUTENTRY_API_LATEST;
    Entry.OfferId = TCHAR_TO_UTF8(*OfferId);

    EOS_Ecom_CheckoutOptions Options = {};
    Options.ApiVersion = EOS_ECOM_CHECKOUT_API_LATEST;
    Options.LocalUserId = LocalUserId;
    Options.EntryCount = 1;
    Options.Entries = &Entry;

    EOS_Ecom_Checkout(EcomHandle, &Options, this,
        [](const EOS_Ecom_CheckoutCallbackInfo* Data) {
            if (Data->ResultCode == EOS_EResult::EOS_Success)
            {
                // Re-query entitlements to pick up the new purchase
                static_cast<UMyGameInstance*>(Data->ClientData)->QueryEOSEntitlements();
            }
        });
}
```

## Offer IDs

EOS Offers are configured in the Epic Developer Portal → Ecom → Offers. Each currency bundle and each direct-purchase cosmetic has a unique Offer ID. Map Offer IDs to in-game item IDs in `Content/Data/DT_EOSOfferMapping.uasset` (Data Table).

## EOS Credentials in DefaultEngine.ini

```ini
[OnlineSubsystemEOS]
ProductId={{ EOS_PRODUCT_ID }}
SandboxId={{ EOS_SANDBOX_ID }}
DeploymentId={{ EOS_DEPLOYMENT_ID }}
ClientCredentialsId={{ EOS_CLIENT_ID }}
ClientCredentialsSecret={{ EOS_CLIENT_SECRET }}
```

Store `ClientCredentialsSecret` in environment variables on the build server. Do not commit to git.
