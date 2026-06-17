# Microtransactions — Steam IAP, EOS Ecom, Console Stores, Server-Side Validation

> In-game microtransactions are cosmetics-first and never pay-to-win. Every purchase flows through a platform-specific payment overlay, lands a receipt on the game server, the server validates the receipt with the platform SDK, and only then grants the entitlement to the player. The client never grants entitlements directly. This guide walks the full Steam MicroTxn flow end-to-end and maps it to the EOS and console equivalents. Cross-reference [rules/ue5-microtransactions.md](../rules/ue5-microtransactions.md) for the full policy checklist.

---

## Platform Support Matrix

| Platform | SDK | Receipt validation |
|----------|-----|-------------------|
| Steam (PC) | Steam Web API MicroTxn | Server calls `ISteamMicroTxn/InitTxn` + `FinalizeTxn` |
| Epic Games Store | EOS Ecom SDK | Server calls `EOS_Ecom_QueryOwnership` |
| PlayStation 5 | PSN Commerce (np-commerce-service) | Server-side entitlement verification |
| Xbox Series | Xbox Commerce (XBL Marketplace) | Server calls Xbox Services API |
| iOS / Android | Apple StoreKit 2 / Google Play Billing | Server-side receipt validation |

All stores share the same game-server entitlement grant path. Only the receipt validation call differs per platform.

---

## Cosmetics Catalog

Define the purchasable item catalog as a Data Table:

```cpp
// DT_ItemCatalog row struct
USTRUCT(BlueprintType)
struct FCatalogItem : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    TObjectPtr<UTexture2D> PreviewImage;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    int32 PriceUSD_Cents = 0;                      // Shown in UI; Steam sets final price

    // Platform-specific SKU IDs
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FString SteamItemID;                           // Numeric string: "101"

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FString EOSOfferId;                            // EOS offer ID from dev portal

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FGameplayTag GrantedTag;                       // Tag applied to player on purchase
};
```

The server reads the same `DT_ItemCatalog` table to validate that a purchased SKU maps to a real grantable item.

---

## Full Steam MicroTxn Flow — End-to-End

```
1. Client: player taps "Buy" on WB_ItemStore
2. Client → Game Server: RequestPurchase(SteamID, ItemID, Quantity)
3. Game Server → Steam Web API: POST ISteamMicroTxn/InitTxn/v3
4. Steam Web API → Game Server: { transactionid, steamurl }
5. Game Server → Client: { transactionid, steamurl }
6. Client: open Steam Overlay to steamurl (ISteamFriends::ActivateGameOverlayToWebPage)
7. User: confirms/cancels purchase in Steam Overlay
8. Steam → Game Server: POST /steam/txn-callback (UserInitiatedCallback)
9. Game Server → Steam Web API: POST ISteamMicroTxn/FinalizeTxn/v3 { transactionid }
10. Steam Web API → Game Server: { result: "OK" }
11. Game Server: grant entitlement (write to DB, broadcast GameplayTag to player)
12. Game Server → Client: PurchaseComplete(ItemID, GrantedTag)
13. Client: refresh inventory, play purchase VFX
```

### Step 3–5: Server-Side InitTxn

**Go implementation:**

```go
// internal/store/steam_store.go
package store

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "os"
    "strings"
)

const steamAPIBase = "https://partner.steam-api.com"

type SteamMicroTxnClient struct {
    publisherKey string
    appID        string
    httpClient   *http.Client
}

func NewSteamMicroTxnClient() *SteamMicroTxnClient {
    return &SteamMicroTxnClient{
        publisherKey: mustEnv("STEAM_PUBLISHER_KEY"),
        appID:        mustEnv("STEAM_APP_ID"),
        httpClient:   &http.Client{},
    }
}

type InitTxnRequest struct {
    SteamID   string
    OrderID   string    // Your generated unique order ID
    ItemID    string    // Numeric Steam item ID
    ItemDesc  string
    Currency  string    // "USD"
    Amount    int       // Cents
    Language  string    // "en"
    Country   string    // "US"
}

type InitTxnResponse struct {
    Response struct {
        Result     string `json:"result"`
        Params struct {
            OrderID       string `json:"orderid"`
            TransactionID string `json:"transid"`
            SteamURL      string `json:"steamurl"`
        } `json:"params"`
        Error *struct {
            ErrorCode int    `json:"errorcode"`
            ErrorDesc string `json:"errordesc"`
        } `json:"error"`
    } `json:"response"`
}

func (c *SteamMicroTxnClient) InitTxn(ctx context.Context, req InitTxnRequest) (*InitTxnResponse, error) {
    params := url.Values{
        "key":           {c.publisherKey},
        "orderid":       {req.OrderID},
        "steamid":       {req.SteamID},
        "appid":         {c.appID},
        "itemcount":     {"1"},
        "language":      {req.Language},
        "currency":      {req.Currency},
        "usersession":   {"client"},
        "ipaddress":     {"127.0.0.1"},   // Use real client IP in production
        "itemid[0]":     {req.ItemID},
        "qty[0]":        {"1"},
        "amount[0]":     {fmt.Sprintf("%d", req.Amount)},
        "description[0]":{req.ItemDesc},
    }

    endpoint := fmt.Sprintf("%s/ISteamMicroTxn/InitTxn/v3/", steamAPIBase)
    httpReq, _ := http.NewRequestWithContext(ctx, "POST", endpoint,
        strings.NewReader(params.Encode()))
    httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("steam InitTxn http: %w", err)
    }
    defer resp.Body.Close()

    var result InitTxnResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("steam InitTxn decode: %w", err)
    }

    if result.Response.Result != "OK" && result.Response.Error != nil {
        return nil, fmt.Errorf("steam InitTxn error %d: %s",
            result.Response.Error.ErrorCode,
            result.Response.Error.ErrorDesc)
    }

    return &result, nil
}

func (c *SteamMicroTxnClient) FinalizeTxn(ctx context.Context, transactionID string) error {
    params := url.Values{
        "key":    {c.publisherKey},
        "appid":  {c.appID},
        "orderid": {transactionID},
    }

    endpoint := fmt.Sprintf("%s/ISteamMicroTxn/FinalizeTxn/v3/", steamAPIBase)
    httpReq, _ := http.NewRequestWithContext(ctx, "POST", endpoint,
        strings.NewReader(params.Encode()))
    httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return fmt.Errorf("steam FinalizeTxn http: %w", err)
    }
    defer resp.Body.Close()

    var result struct {
        Response struct {
            Result string `json:"result"`
            Error  *struct {
                ErrorCode int    `json:"errorcode"`
                ErrorDesc string `json:"errordesc"`
            } `json:"error"`
        } `json:"response"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return fmt.Errorf("steam FinalizeTxn decode: %w", err)
    }

    if result.Response.Result != "OK" {
        if result.Response.Error != nil {
            return fmt.Errorf("steam FinalizeTxn error %d: %s",
                result.Response.Error.ErrorCode, result.Response.Error.ErrorDesc)
        }
        return fmt.Errorf("steam FinalizeTxn unexpected result: %s", result.Response.Result)
    }

    return nil
}

func mustEnv(key string) string {
    v := os.Getenv(key)
    if v == "" { panic("required env: " + key) }
    return v
}
```

**Node.js implementation (alternative backend):**

```js
// src/store/steamMicroTxn.js
import { URLSearchParams } from 'url';

const STEAM_API_BASE = 'https://partner.steam-api.com';

export class SteamMicroTxnClient {
  constructor() {
    this.publisherKey = requireEnv('STEAM_PUBLISHER_KEY');
    this.appId        = requireEnv('STEAM_APP_ID');
  }

  async initTxn({ steamId, orderId, itemId, itemDesc, currency = 'USD', amountCents, language = 'en' }) {
    const params = new URLSearchParams({
      key:            this.publisherKey,
      orderid:        orderId,
      steamid:        steamId,
      appid:          this.appId,
      itemcount:      '1',
      language,
      currency,
      usersession:    'client',
      ipaddress:      '127.0.0.1',
      'itemid[0]':    itemId,
      'qty[0]':       '1',
      'amount[0]':    String(amountCents),
      'description[0]': itemDesc,
    });

    const res = await fetch(`${STEAM_API_BASE}/ISteamMicroTxn/InitTxn/v3/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (data.response.result !== 'OK') {
      throw new Error(`Steam InitTxn: ${data.response.error?.errordesc ?? 'unknown'}`);
    }
    return data.response.params;  // { orderid, transid, steamurl }
  }

  async finalizeTxn(transactionId) {
    const params = new URLSearchParams({
      key:     this.publisherKey,
      appid:   this.appId,
      orderid: transactionId,
    });

    const res = await fetch(`${STEAM_API_BASE}/ISteamMicroTxn/FinalizeTxn/v3/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (data.response.result !== 'OK') {
      throw new Error(`Steam FinalizeTxn: ${data.response.error?.errordesc ?? 'unknown'}`);
    }
  }
}

function requireEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Required env: ${key}`);
  return v;
}
```

### Step 8–9: Steam Callback Webhook

Steam POSTs to your registered callback URL (`https://game-server.example.com/steam/txn-callback`):

```go
// internal/handler/store_handler.go
func (h *StoreHandler) HandleSteamCallback(c *gin.Context) {
    var payload struct {
        OrderID       string `form:"orderid"`
        TransactionID string `form:"transid"`
        SteamID       string `form:"steamid"`
        Status        string `form:"status"`   // "Init" or "Approved"
    }
    if err := c.ShouldBind(&payload); err != nil {
        c.Status(http.StatusBadRequest)
        return
    }

    if payload.Status != "Approved" {
        // User cancelled — clean up pending order, respond 200
        _ = h.svc.Store.CancelPendingOrder(c.Request.Context(), payload.OrderID)
        c.Status(http.StatusOK)
        return
    }

    // Finalize with Steam, then grant entitlement
    if err := h.svc.Store.FinalizeSteamPurchase(c.Request.Context(),
        payload.SteamID, payload.OrderID, payload.TransactionID); err != nil {
        // Log, don't expose error detail to Steam
        slog.Error("finalize steam purchase", "error", err, "orderid", payload.OrderID)
        c.Status(http.StatusInternalServerError)
        return
    }

    c.Status(http.StatusOK)
}
```

```go
// internal/service/store_service.go (FinalizeSteamPurchase)
func (s *StoreService) FinalizeSteamPurchase(ctx context.Context,
    steamID, orderID, transactionID string) error {

    // 1. Verify the order belongs to the claimed steamID (DB check)
    order, err := s.queries.GetPendingOrder(ctx, orderID)
    if err != nil || order.SteamID != steamID {
        return fmt.Errorf("order mismatch or not found")
    }

    // 2. Idempotency: skip if already finalized
    if order.Status == "completed" {
        return nil
    }

    // 3. Finalize with Steam
    if err := s.steamClient.FinalizeTxn(ctx, transactionID); err != nil {
        return fmt.Errorf("steam finalize: %w", err)
    }

    // 4. Mark order completed in DB
    if err := s.queries.CompleteOrder(ctx, orderID); err != nil {
        return fmt.Errorf("complete order: %w", err)
    }

    // 5. Grant item to player
    catalogItem := s.catalog.FindBySteamItemID(order.ItemID)
    if catalogItem == nil {
        return fmt.Errorf("unknown catalog item: %s", order.ItemID)
    }

    return s.queries.GrantPlayerItem(ctx, repository.GrantPlayerItemParams{
        PlayerID:    order.PlayerID,
        ItemID:      catalogItem.ID,
        GrantedTags: catalogItem.GrantedTag,
    })
}
```

### Steps 12–13: Client Refreshes Inventory

```cpp
// UInventorySubsystem::PollServerInventory — call on PurchaseComplete event
void UInventorySubsystem::PollServerInventory()
{
    // HTTP GET /api/player/inventory — game server returns owned item IDs
    // On response: rebuild OwnedWeapons from DT_ItemCatalog lookup
    // Fire OnInventoryChanged → UI refreshes
}
```

---

## EOS Ecom Flow

EOS Ecom uses a different OAuth model: the client authenticates with EOS, the client requests the checkout, EOS handles payment, and the server queries ownership rather than receiving a webhook.

```
1. Client: EOS_Ecom_Checkout(OfferId)
2. EOS overlay opens → user confirms purchase
3. Server: EOS_Ecom_QueryOwnership(ProductUserId, CatalogItemId)
   → returns { owned: true/false }
4. If owned: grant entitlement
```

Server-side ownership check stub:

```go
// internal/store/eos_store.go
func (c *EOSStoreClient) QueryOwnership(ctx context.Context,
    productUserID, catalogItemID string) (bool, error) {

    // EOS backend API: https://api.epicgames.dev/ecom/v1/platforms/EPIC/ownership
    req, _ := http.NewRequestWithContext(ctx, "GET",
        "https://api.epicgames.dev/ecom/v1/platforms/EPIC/ownership", nil)
    q := req.URL.Query()
    q.Set("productUserId", productUserID)
    q.Set("catalogItemId", catalogItemID)
    req.URL.RawQuery = q.Encode()
    req.Header.Set("Authorization", "Bearer "+c.serverAccessToken())

    resp, err := c.httpClient.Do(req)
    // ... decode + return owned boolean
    _ = resp
    return false, err
}
```

---

## Console Stores

| Platform | Server API | Notes |
|----------|-----------|-------|
| PS5 | `https://m.np.playstation.com/api/commerce/...` | OAuth via PSN server-to-server auth |
| Xbox Series | `https://api.xboxlive.com/user/{xuid}/entitlements` | XSTS token exchange |

Console receipt validation stubs go in `internal/store/psn_store.go` and `internal/store/xbl_store.go`. The interface is identical to `EOSStoreClient` — implement `QueryOwnership(ctx, userID, itemID)`.

The `StoreService` routes to the right client based on the player's current platform (set in the player session at login).

---

## Environment Variables

```bash
# Steam
STEAM_PUBLISHER_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX    # From Steamworks Partner portal
STEAM_APP_ID=1234560
STEAM_TXN_CALLBACK_URL=https://game-server.example.com/steam/txn-callback

# Epic Online Services
EOS_CLIENT_ID=XXXX
EOS_CLIENT_SECRET=XXXX
EOS_PRODUCT_ID=XXXX
EOS_SANDBOX_ID=XXXX
EOS_DEPLOYMENT_ID=XXXX

# Console (set per platform)
PSN_CLIENT_ID=XXXX
PSN_CLIENT_SECRET=XXXX
```

Never hardcode these. Set via your CI secrets manager.

---

## Fraud / Abuse Rules

1. **Server-side finalization is non-negotiable** — if the client can grant items, players will exploit it within hours of launch.
2. **Idempotency on finalize** — Steam can re-send callback webhooks. Check `order.Status == "completed"` before calling `FinalizeTxn` twice.
3. **Order ownership check** — verify `order.SteamID == steamID` before finalizing. Prevents order ID enumeration attacks.
4. **Log every transaction** — `orderID`, `transactionID`, `steamID`, `itemID`, `timestamp` in a `transactions` table. Required for support and chargebacks.
5. **Never expose publisher key to clients** — `STEAM_PUBLISHER_KEY` is server-only. It grants the ability to create charges on any Steam account.
6. **Cosmetics only** — gameplay stats, damage, speed are not purchasable. See [rules/ue5-microtransactions.md](../rules/ue5-microtransactions.md).

---

## Key Rules

1. **All entitlement grants are server-authoritative** — client requests purchase, server validates with platform SDK, server grants item.
2. **One route per platform, one grant function** — `StoreService.GrantItem()` is called by all platform validation paths. Platform code diverges only at the receipt-validation call.
3. **Transaction table, always** — every purchase attempt (including failed ones) is logged with its platform receipt.
4. **Idempotent grant** — `GrantPlayerItem` is idempotent; re-granting an already-owned item is a no-op.
5. **Test with sandbox** — use Steam's test App ID (`480`) and `sandbox=1` flag on all API calls during development. Never send real charges in development.
6. **Cross-reference [rules/ue5-microtransactions.md](../rules/ue5-microtransactions.md)** before adding any purchasable item — that file contains the cosmetics-only policy, per-platform age-gate requirements, and console compliance notes.
