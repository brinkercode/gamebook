# Steam MicroTxn API Flow

Steam MicroTxn uses a server-side WebAPI. The client NEVER calls Steam payment directly — the game server initiates the transaction, Steam confirms it, then the game server grants the item.

## Flow

```
Client                    Game Server              Steam WebAPI
  │                            │                        │
  │── PurchaseCurrencyBundle ──►│                        │
  │                            │── ISteamMicroTxn/      │
  │                            │   InitTxn ────────────►│
  │                            │◄─────────── txnid ─────│
  │◄─────── txnid ─────────────│                        │
  │── OpenSteamOverlay(txnid) ─►│                        │
  │                            │                        │
  │ (Steam Overlay payment UI shown to player)           │
  │                            │                        │
  │                            │◄────── Webhook ────────│
  │                            │   UserInitiatedPurchase│
  │                            │── FinalizeTxn ────────►│
  │                            │◄──────── OK ───────────│
  │                            │── GrantCurrency ───────►Client (RPC)
```

## Game Server: InitTxn

```
POST https://partner.steam-api.com/ISteamMicroTxn/InitTxn/v3/
Content-Type: application/x-www-form-urlencoded

key=<STEAM_PUBLISHER_KEY>
&steamid=<PLAYER_STEAMID>
&appid=<APP_ID>
&orderid=<UNIQUE_ORDER_ID>
&itemcount=1
&language=en
&currency=USD
&usersession=client
&ipaddress=<CLIENT_IP>
&itemid[0]=<SKU_ID>
&qty[0]=1
&amount[0]=<PRICE_IN_CENTS>
&description[0]=<ITEM_DESCRIPTION>
&category[0]=<CATEGORY>
```

On success: Steam returns `{"response":{"result":"OK","params":{"orderid":"...","transid":"..."}}}`

Store `transid` server-side with the player's SteamID and order status = PENDING.

## Client: Open Steam Overlay

```cpp
// In UCurrencySubsystem::PurchaseCurrencyBundle, after receiving transid from server
SteamFriends()->ActivateGameOverlayToWebPage(
    TCHAR_TO_UTF8(*FString::Printf(
        TEXT("https://store.steampowered.com/checkout/startpurchase/%s"), *TransactionID)));
```

Or use the Steam In-Game Overlay payment page — Steam handles all payment UI.

## Game Server: FinalizeTxn (webhook or polling)

Steam calls the game server's registered webhook URL on purchase completion:
```
POST <GAME_SERVER_WEBHOOK>/steam/purchase_complete
{
  "steamid": "...",
  "orderid": "...",
  "transid": "...",
  "result": "Approved"
}
```

Game server calls FinalizeTxn to confirm:
```
POST https://partner.steam-api.com/ISteamMicroTxn/FinalizeTxn/v2/
key=<STEAM_PUBLISHER_KEY>
&appid=<APP_ID>
&orderid=<ORDER_ID>
```

Only after FinalizeTxn succeeds → grant the currency to the player.

## Sandbox Testing

Use `ISteamMicroTxnSandbox/InitTxn/v3/` during development:
```
POST https://partner.steam-api.com/ISteamMicroTxnSandbox/InitTxn/v3/
```

Sandbox transactions do not charge real money. Confirm the sandbox behaves identically to production before switching.

## Security Requirements

- NEVER call InitTxn or FinalizeTxn from the game client — only from the game server
- Store the Steam Publisher API key as an environment variable on the server — never in source code
- Verify the `steamid` in the webhook matches the player session before granting items
- Implement idempotency: if the same `orderid` is finalized twice, grant only once (check DB)
