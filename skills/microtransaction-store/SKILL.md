---
name: microtransaction-store
description: Use when implementing the in-game cosmetics store for a UE5 FPS project — covers Steam IAP / EOS Ecom purchase flow (list → purchase → entitle → grant cosmetic), store UI, and currency display. Invoke when the user says "build the store", "implement microtransactions", "add the cosmetics shop", or "wire up Steam IAP".
version: "1.0.0"
---

# Microtransaction Store

> Implements the full cosmetics store: `UCurrencySubsystem` (GameInstance), `WB_Store` (UMG widget), Steam MicroTxn API server flow, EOS Ecom entitlement check, and `UDA_Cosmetic` grant on purchase complete. Cosmetics only — no pay-to-win items.

## Prerequisites

- `docs/MONETIZATION.md` must exist (monetization-interview skill)
- The pay-to-win contract in `docs/MONETIZATION.md` must be locked
- Steam App ID and EOS Product ID must be configured in `DefaultEngine.ini`
- `save-system` skill must be implemented (cosmetics persisted in `UMyGameSave.OwnedCosmeticIDs`)

## How it works

1. **Interview** — confirm platform targets, currency model, and launch catalogue from `docs/MONETIZATION.md`.
2. **Cosmetic data asset** — create `UDA_Cosmetic` per `resources/cosmetic-asset.md`.
3. **Currency subsystem** — create `UCurrencySubsystem` per `resources/currency-subsystem.md`; server-authoritative balance.
4. **Steam MicroTxn flow** — implement server-side initiation and finalization per `resources/steam-microtxn.md`.
5. **EOS Ecom flow** — implement entitlement check on session start per `resources/eos-ecom.md`.
6. **Store widget** — create `WB_Store` per `resources/store-widget.md`; item grid, owned state, buy flow.
7. **Grant flow** — on purchase complete, add item ID to `UMyGameSave.OwnedCosmeticIDs` and call save.
8. **Verify** — use Steam sandbox mode; initiate a test purchase; confirm item granted, balance updated, owned state shown in UI.

## Resources (read on demand)

- `resources/cosmetic-asset.md` — `UDA_Cosmetic` Primary Data Asset.
- `resources/currency-subsystem.md` — `UCurrencySubsystem` GameInstance Subsystem.
- `resources/steam-microtxn.md` — Steam MicroTxn API server flow (InitTxn → SteamOverlay → FinalizeTxn → grant).
- `resources/eos-ecom.md` — EOS Ecom entitlement check and item grant flow.
- `resources/store-widget.md` — `WB_Store` + `WB_StoreItemTile` widget implementation.

## Success Criteria

- [ ] Store opens from main menu and pause menu
- [ ] Item tiles show "Owned" badge for items in `OwnedCosmeticIDs`
- [ ] "Buy" button initiates Steam Overlay payment flow
- [ ] Server finalizes transaction; item granted to save game
- [ ] Hard currency balance updates after purchase
- [ ] Purchased cosmetic applies to character / weapon in-game
- [ ] No gameplay-affecting items in the catalogue (confirmed against pay-to-win contract)
- [ ] Purchase blocked if player balance is insufficient; prompt to buy currency shown

## What to Commit

```
Source/<Project>/Store/CurrencySubsystem.h
Source/<Project>/Store/CurrencySubsystem.cpp
Source/<Project>/Store/DA_Cosmetic.h
Content/Data/Store/DA_Cosmetic_<Name>.uasset
Content/UI/Store/WB_Store.uasset
Content/UI/Store/WB_StoreItemTile.uasset
Content/UI/Store/WB_CurrencyDisplay.uasset
```
