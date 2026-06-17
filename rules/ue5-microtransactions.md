---
paths:
  - "Source/**/Store/**"
  - "Source/**/Monetization/**"
  - "Source/**/Ecom/**"
  - "Content/UI/Store/**"
---

# UE5 Microtransaction Rules

## Baseline philosophy

This game's monetization is **cosmetics-first**. Every rule below flows from two premises:

1. No player can pay real money to gain a gameplay advantage.
2. No player should feel deceived, pressured, or manipulated into spending.

Violating either is a product failure, not just a compliance failure.

## Currency model

| Currency | Obtained how | Spent on | Convertible? |
|---|---|---|---|
| **Hard currency** (e.g., Gems) | Purchase with real money only | Cosmetics, hard-currency bundles | No — cannot be converted to soft |
| **Soft currency** (e.g., Credits) | Earned via gameplay milestones, daily rewards, achievements | Cosmetics, gameplay unlocks (balance items only) | No — cannot be purchased with real money |

- **Soft currency is earned, never sold** — the moment soft currency can be bought with real money, you've blurred the line between cosmetic spend and gameplay advantage.
- **Hard currency cannot buy gameplay power** — no weapon upgrades, stat boosts, ammo packs, health kits, lives, continues, or revives for real money. Cosmetics only.
- **No cross-currency conversion in either direction** — soft → hard or hard → soft conversions are prohibited. They're used to obscure the real price of items.

## What can be sold

| Allowed | Prohibited |
|---|---|
| Character skins and emotes | Weapons with better base stats |
| Weapon cosmetics (reskins, charms) | Ammo, consumables, heal items |
| XP boost cosmetics (visual flair) | XP multipliers that affect game outcome |
| Cosmetic Battle Pass tiers | Pay-to-unlock gameplay levels or story content |
| Name tags, banners, profile icons | Loot boxes with gameplay items |
| Cosmetic Seasonal Pass | Exclusive gameplay abilities |

**Loot boxes are prohibited** — never randomize a real-money purchase. If RNG is used, it must be purely cosmetic and the probability of each item must be disclosed on the purchase screen (many jurisdictions legally require this).

## Pricing display

- **Always show the real-currency equivalent at point of purchase** — when a bundle costs 800 Gems, show "$7.99 USD" (or the regional equivalent) alongside the gem price. Players must never need to mentally convert.
- **No price anchoring via inflated "original price" strike-through** unless the discount is genuine and time-limited with a visible end date.
- **No bundled currency that doesn't cleanly map to item prices** — bundles of 550 gems when items cost 600 gems exist solely to cause leftover currency. Use round numbers or document the overage explicitly.

## Purchase flow (technical requirements)

```
1. Player sees item + real currency price clearly displayed
2. Player taps "Buy" — shows a confirmation dialog with price
3. Confirmation submits purchase to platform SDK (Steam/EOS/Console)
4. Platform SDK prompts for player authentication (fingerprint, password, PIN)
5. Platform returns a receipt / transaction ID
6. Client sends receipt to your game server — NEVER apply ownership client-side
7. Server validates receipt with the platform's receipt validation API (server-to-server)
8. Server records ownership in the database
9. Server responds to client — client unlocks the cosmetic
```

- **Never apply ownership client-side** — a player who owns a skin because the client says so is trivially spoofable. All entitlements are set server-side after server-side receipt validation.
- **Receipt validation is server-to-server** — your server calls Steam's `CheckFileSignature` / `GetPurchaseStatus`, EOS `QueryOwnership`, or the console platform's equivalent validation endpoint. Never trust a receipt the client hands you without re-verifying it.
- **Idempotent purchase processing** — the receipt transaction ID is the idempotency key. If the client submits the same receipt twice (network retry), the server grants ownership once and returns success both times.
- **Never auto-charge** — no subscriptions, no recurring billing, no "buy now, confirm later" patterns. Every transaction requires explicit user confirmation at time of purchase.

## Entitlement storage (server-side)

```sql
-- Example schema
CREATE TABLE player_entitlements (
    player_id     UUID NOT NULL REFERENCES players(id),
    item_id       VARCHAR(64) NOT NULL,           -- cosmetic asset ID
    platform      VARCHAR(32) NOT NULL,            -- steam / eos / psn / xbox
    transaction_id VARCHAR(128) NOT NULL UNIQUE,  -- receipt ID from platform
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player_id, item_id)
);
```

- **`transaction_id` is UNIQUE** — idempotency constraint at the database level. Double-submission cannot double-grant.
- **`(player_id, item_id)` primary key** — a player can own an item once. Re-purchasing an already-owned cosmetic returns success without a duplicate row.
- **Never store the full receipt blob in the database** — store the transaction ID and verification timestamp. Raw receipt data may contain PII.

## Refund and restore

- **Restore purchases flow** — provide a "Restore Purchases" button in the store UI (required by Apple/Google; good UX everywhere). It re-calls the platform's ownership verification API and re-syncs entitlements.
- **Refunded purchases** — when a platform refund is issued, the platform's webhook or the next `QueryOwnership` call will show the item as no longer owned. Revoke server-side entitlement on detection.
- **Never remove gameplay-functional items on refund** — cosmetics only. Refunding a cosmetic skin makes the player's character use the default skin again. No gameplay disruption.

## Platform SDK integration

```cpp
// EOS Ecom — query what the player owns
void UEcomSubsystem::QueryOwnedItems(const FUniqueNetIdPtr& LocalUserId)
{
    if (!IsValid(EosEcomHandle)) { return; }

    EOS_Ecom_QueryOwnershipOptions Options = {};
    Options.ApiVersion = EOS_ECOM_QUERYOWNERSHIP_API_LATEST;
    // ... fill CatalogItemIds from your DT_StoreItems data table
    EOS_Ecom_QueryOwnership(EosEcomHandle, &Options, this,
        &UEcomSubsystem::OnQueryOwnershipComplete);
}

// The actual entitlement grant happens server-side after this callback
// returns a receipt token — never trust the local QueryOwnership result
```

- **All SDK calls go through a `UEcomSubsystem`** — never call `EOS_Ecom_*` or Steamworks `ISteamMicroTxn` functions from UI code or actor Blueprints.
- **Steam MicroTxn (`ISteamMicroTxn`)** for Steam purchases — `InitTxn` on your game server, `FinalizeTxn` after Steam returns a successful callback. The flow is server-initiated, not client-initiated.
- **Console stores** (PlayStation Store, Xbox Marketplace) follow the same pattern — your server validates entitlements via the console's entitlement service, not via client-reported ownership.

## Legal and regulatory requirements

| Requirement | Rule |
|---|---|
| **FTC (US)** | Clearly disclose if game has in-app purchases on storefronts and in-game. No deceptive pricing. |
| **COPPA (US)** | If the game targets or is accessible to children under 13, no real-money purchases without verified parental consent. |
| **GDPR (EU)** | Purchase history is personal data — include in data export and right-to-erasure flows. Anonymize, don't delete transaction records (needed for financial compliance). |
| **Belgium / Netherlands loot box law** | Loot boxes with real-money purchase are illegal. Already prohibited above. |
| **UK Gambling Commission** | Disclose odds for any randomized cosmetic paid with real money. Already handled by loot box prohibition and odds disclosure rule. |
| **Platform store rules** | Apple, Google, Steam, PlayStation, Xbox each have their own IAP guidelines. Read them. Violations cause delisting. |

## Anti-dark-pattern checklist

Review every store UI against this list before shipping:

- [ ] No countdown timers on offers that aren't genuinely time-limited
- [ ] No "only 2 left" scarcity claims unless inventory is genuinely finite
- [ ] No characters or NPCs that express disappointment when the player doesn't buy
- [ ] No purchase confirmation pre-checked or on a short timeout
- [ ] No full-screen purchase prompts on game launch or after every match
- [ ] No spend-to-skip design — players can unlock the same cosmetics by playing
- [ ] No premium currency amounts that don't divide evenly into item prices
- [ ] Real price shown in local currency at all times, not just in the currency purchase flow
- [ ] "Close" / "No thanks" button is at least as prominent as the purchase CTA
- [ ] Minors can be restricted from spending via parental controls (platform-level + in-game confirmation flow)
