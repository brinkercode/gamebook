# Store Design

> In-game store, monetization model, item catalog, and platform integration for {{PROJECT_NAME}}.

## Model

{{MONETIZATION_MODEL}} — cosmetics-first, never pay-to-win.

Player purchases cosmetic items (skins, emotes, banners) only. No gameplay advantages for sale.
All gameplay-affecting content unlocked through play.

## Item Catalog

Catalog managed as `DT_StoreItems` (Data Table, row struct `FStoreItemRow`) in `Content/Data/Tables/`.
Designers add rows — no C++ recompile needed.

| Column | Type | Notes |
|---|---|---|
| `ItemId` | `FName` | Primary key — matches platform SKU suffix |
| `DisplayName` | `FText` | Localized |
| `Description` | `FText` | Localized |
| `Category` | `EStoreCategory` | Skin / Emote / Banner / Bundle |
| `PreviewAsset` | `TSoftObjectPtr<UTexture2D>` | Store tile image |
| `Price_USD` | `int32` | Cents (e.g., 499 = $4.99) |
| `PlatformSKU_Steam` | `FString` | Steam item ID |
| `PlatformSKU_EOS` | `FString` | EOS offer ID |
| `GrantedItems` | `TArray<FName>` | Item IDs included (for bundles) |
| `RequiredTag` | `FGameplayTag` | Gate behind tag (e.g., season pass) |

## Platform Integration

### Steam Microtransactions (MicroTxn)

- API: Steam Web API `ISteamMicroTxn` + `ISteamMicroTxnSandbox` (dev).
- Flow:
  1. Player initiates purchase → `UEcomSubsystem::InitiatePurchase(ItemId)`.
  2. Subsystem calls `ISteamMicroTxn/InitTxn` (server-side).
  3. Steam overlay displays payment.
  4. Webhook/poll confirms → `ISteamMicroTxn/FinalizeTxn`.
  5. `UEcomSubsystem::GrantItem(ItemId, PlayerId)` marks entitlement in save slot.
- Never trust client for grant — always verify via server call before marking owned.

### EOS Ecom

- Catalog configured in EOS Dev Portal under Product → Offers.
- Flow: `IEcomInterface::QueryOwnership` → `IEcomInterface::Checkout` → `IEcomInterface::QueryOwnership` (verify).
- Sandbox toggle: `EOS_PRODUCTION_ENVIRONMENT` in `DefaultEngine.ini`.

### Console Stores

_(populate when platforms confirmed — PS Store / Xbox Marketplace flow)_

## Store UI (UMG)

- Root widget: `WB_Store_Root` — `UCommonActivatableWidget` subclass.
- Category tabs: `WB_Store_CategoryTab` — drives filter on `DT_StoreItems`.
- Item tile: `WB_Store_ItemTile` — displays preview, name, price, owned state.
- Purchase flow: `WB_Store_ConfirmPurchase` — shows item details + price before API call.
- Owned badge: driven by `UEcomSubsystem::IsOwned(ItemId)` — checked on widget construction.

## Receipt / Entitlement

- Entitlements persisted in `USaveGame` slot `"Entitlements"` (server-authoritative copy wins on conflict).
- On session start: `UEcomSubsystem::SyncEntitlements()` — fetches from platform and reconciles local cache.
- Offline mode: last-known entitlement cache used. No purchases allowed offline.

## Analytics Events

| Event | Trigger | Payload |
|---|---|---|
| `store_open` | Player opens store | `session_id` |
| `item_viewed` | Item tile focused | `item_id`, `category` |
| `purchase_initiated` | Confirm button pressed | `item_id`, `price_cents`, `platform` |
| `purchase_complete` | Entitlement granted | `item_id`, `price_cents`, `platform`, `transaction_id` |
| `purchase_failed` | Platform error | `item_id`, `error_code` |

Send via `UAnalyticsSubsystem::RecordEvent`. See [ROADMAP.md](ROADMAP.md) for analytics milestone.
