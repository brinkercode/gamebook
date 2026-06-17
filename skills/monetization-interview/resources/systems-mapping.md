# Monetization Decisions → Game Systems

---

## Platform IAP API

| Platform | API | Integration |
|---|---|---|
| Steam | Steam MicroTxn API (WebAPI `ISteamMicroTxn`) | `microtransaction-store` skill handles — server-side initiation, client SteamOverlay payment, server-side finalize |
| EOS / Epic Games Store | EOS Ecom (`EOS_Ecom_*` functions) | EOS SDK C++ wrapper; `UEOS_EcomSubsystem` (custom) or OSS Ecom interface |
| PlayStation Store | PSN Commerce SDK | Console platform NDA — separate build target; not covered in vertical slice |
| Xbox Store | Xbox Services API (XSAPI) | Console platform NDA — not covered in vertical slice |

Default for vertical slice: Steam + EOS dual-target. See `microtransaction-store` skill for implementation.

---

## Currency System Architecture

### Single premium currency

```
GameInstance Subsystem: UCurrencySubsystem
  UPROPERTY: int32 HardCurrencyBalance (replicated from server)
  void PurchaseCurrency(int32 SKUAmount)   // initiates IAP flow
  void SpendCurrency(int32 Amount, FString ItemID)
  void OnPurchaseComplete(bool bSuccess, int32 AmountGranted)
```

Hard currency balance is **authoritative on the server**. Client UI shows a local cached value; server confirms on every session start.

### Dual currency (if chosen)

Add `int32 SoftCurrencyBalance` to `UCurrencySubsystem`. Soft currency earned via:
- Match completion reward (server-awarded `GE_SoftCurrencyReward`)
- Daily login (server-side daily claim endpoint)
- Never purchasable for real money directly

---

## Item Grant Flow

1. Player taps "Buy" in `WB_StoreItemTile`
2. Store widget calls `UCurrencySubsystem::InitiatePurchase(ItemID)`
3. Subsystem calls Steam MicroTxn `InitTxn` (server-side via game server HTTP call)
4. SteamOverlay payment UI shown to player
5. Steam calls game server webhook: `FinalizeTxn`
6. Game server validates, marks item as owned in DB, calls `IPlayerInventoryService::GrantItem(PlayerID, ItemID)`
7. EOS Achievement/Ecom entitlement recorded if EOS platform
8. Server sends `UGameplayMessage` to client: `GameplayMessage.Store.PurchaseComplete`
9. Client `WB_StoreItemTile` receives message, updates UI state to "Owned"

---

## Entitlement Storage

Items owned by a player are stored:
- Server-side in the player inventory database (authoritative)
- Locally cached in `USaveGame` slot `SaveSlot_Inventory` (for offline display only — never trust for server-authoritative grants)

Cosmetics are applied via `UDA_Cosmetic` Primary Data Asset:
```cpp
UCLASS()
class UDA_Cosmetic : public UPrimaryDataAsset
{
    UPROPERTY(EditDefaultsOnly) FString ItemID;
    UPROPERTY(EditDefaultsOnly) TSoftObjectPtr<USkeletalMesh> CharacterMesh;
    UPROPERTY(EditDefaultsOnly) TSoftObjectPtr<UMaterialInstance> WeaponMaterial;
    UPROPERTY(EditDefaultsOnly) FGameplayTag CosmeticCategory; // e.g., "Cosmetic.Skin.Character"
};
```

---

## Battle Pass (if chosen)

`UDA_BattlePassTier` per tier:
```cpp
UPROPERTY(EditDefaultsOnly) int32 TierNumber;
UPROPERTY(EditDefaultsOnly) int32 XPRequired;
UPROPERTY(EditDefaultsOnly) TArray<FString> FreeRewardItemIDs;
UPROPERTY(EditDefaultsOnly) TArray<FString> PremiumRewardItemIDs;
```

`UBattlePassSubsystem` (GameInstance) tracks current tier and XP. XP awarded server-side only via `GE_BattlePassXP` GameplayEffect.
