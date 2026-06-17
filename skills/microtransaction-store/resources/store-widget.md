# Store Widget — WB_Store and WB_StoreItemTile

## WB_Store

`Content/UI/Store/WB_Store.uasset` — parent: `UCommonActivatableWidget`

### UMG Layout

```
WB_Store (CommonActivatableWidget)
└── Canvas Panel
    ├── HorizontalBox: TopBar
    │   ├── TextBlock: "Store"
    │   └── WB_CurrencyDisplay (hard currency balance + buy-more button)
    ├── ScrollBox: ItemGrid (WrapBox inside)
    │   └── WB_StoreItemTile × N (populated in NativeOnActivated)
    └── WB_MenuButton: "Close" (bottom right)
```

### NativeOnActivated

```cpp
void WB_Store::NativeOnActivated()
{
    Super::NativeOnActivated();

    // Subscribe to purchase results
    UCurrencySubsystem* CS = GetGameInstance()->GetSubsystem<UCurrencySubsystem>();
    CS->OnPurchaseResult.AddDynamic(this, &WB_Store::OnPurchaseResult);
    CS->OnBalanceChanged.AddDynamic(this, &WB_Store::OnBalanceChanged);

    PopulateItemGrid();
}

void WB_Store::PopulateItemGrid()
{
    ItemGrid->ClearChildren();

    // Load all DA_Cosmetic assets from Content/Data/Store/
    UAssetManager& AM = UAssetManager::Get();
    TArray<FAssetData> CosmeticAssets;
    AM.GetPrimaryAssetDataList(FPrimaryAssetType("Cosmetic"), CosmeticAssets);

    for (const FAssetData& Asset : CosmeticAssets)
    {
        UDA_Cosmetic* Cosmetic = Cast<UDA_Cosmetic>(Asset.GetAsset());
        if (!Cosmetic || Cosmetic->PriceHardCurrency == 0) continue; // skip non-purchasable

        UWB_StoreItemTile* Tile = CreateWidget<UWB_StoreItemTile>(this, StoreItemTileClass);
        Tile->Initialize(Cosmetic);
        ItemGrid->AddChildToWrapBox(Tile);
    }
}
```

---

## WB_StoreItemTile

`Content/UI/Store/WB_StoreItemTile.uasset` — parent: `UCommonButtonBase`

### UMG Layout

```
WB_StoreItemTile (CommonButtonBase, 200×280px)
└── VerticalBox
    ├── Image: PreviewImage        (200×200)
    ├── TextBlock: ItemName        (bold)
    ├── HorizontalBox
    │   ├── Image: CurrencyIcon    (coin icon)
    │   └── TextBlock: PriceText
    └── Overlay
        └── Image: OwnedBadge     (visible if owned — "OWNED" green banner)
```

### Logic

```cpp
void WB_StoreItemTile::Initialize(UDA_Cosmetic* Cosmetic)
{
    ActiveCosmetic = Cosmetic;

    // Set preview image
    if (UTexture2D* Preview = Cosmetic->StorePreviewImage.LoadSynchronous())
        PreviewImage->SetBrushFromTexture(Preview);

    ItemNameText->SetText(Cosmetic->DisplayName);
    PriceText->SetText(FText::AsNumber(Cosmetic->PriceHardCurrency));

    // Rarity color on border
    static const TMap<ECosmeticRarity, FLinearColor> RarityColors = {
        {ECosmeticRarity::Common,    FLinearColor(0.7f, 0.7f, 0.7f)},
        {ECosmeticRarity::Rare,      FLinearColor(0.2f, 0.4f, 1.0f)},
        {ECosmeticRarity::Epic,      FLinearColor(0.6f, 0.0f, 1.0f)},
        {ECosmeticRarity::Legendary, FLinearColor(1.0f, 0.6f, 0.0f)},
    };
    // Apply rarity color to tile border...

    RefreshOwnedState();
}

void WB_StoreItemTile::RefreshOwnedState()
{
    USaveGameSubsystem* SS = GetGameInstance()->GetSubsystem<USaveGameSubsystem>();
    bool bOwned = SS && SS->GetCurrentSave() &&
        SS->GetCurrentSave()->OwnedCosmeticIDs.Contains(ActiveCosmetic->ItemID);

    OwnedBadge->SetVisibility(bOwned
        ? ESlateVisibility::Visible
        : ESlateVisibility::Collapsed);

    // Disable buy button if owned
    SetIsEnabled(!bOwned);
}
```

### On Click (buy)

```cpp
void WB_StoreItemTile::NativeOnClicked()
{
    UCurrencySubsystem* CS = GetGameInstance()->GetSubsystem<UCurrencySubsystem>();

    if (!CS->CanAfford(ActiveCosmetic->PriceHardCurrency))
    {
        // Show "Not enough currency" toast + open currency purchase flow
        // Parent WB_Store broadcasts "buy more currency" message
        return;
    }

    // Show confirmation dialog
    // On confirm:
    CS->PurchaseCosmetic(ActiveCosmetic->ItemID, ActiveCosmetic->PriceHardCurrency);
}
```

---

## WB_CurrencyDisplay

Small persistent widget showing the player's hard currency balance:

```
WB_CurrencyDisplay (UserWidget)
└── HorizontalBox
    ├── Image: CoinIcon
    ├── TextBlock: BalanceText   (bound to UCurrencySubsystem::GetHardCurrencyBalance)
    └── CommonButton: "+ Add"    (opens currency bundle purchase)
```

Subscribe to `UCurrencySubsystem::OnBalanceChanged` in `NativeConstruct`; update `BalanceText` on change.
