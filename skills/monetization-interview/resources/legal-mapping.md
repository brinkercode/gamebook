# Monetization Legal Requirements

This is a reference summary, not legal advice. Flag items that apply and recommend independent legal review before store launch.

---

## FTC (USA)

**Applies to:** All US players.

**Required disclosures:**
- If streamers / influencers are paid or receive free items to promote the game: must disclose "Ad" or "#sponsored" visibly.
- If loot boxes are used: FTC recommends (but does not yet mandate) probability disclosure. Treat as mandatory — regulators are watching.
- Virtual currency pricing must make the real-money cost clear. Do not obscure the exchange rate.

**Red flag:** Never describe a random-drop cosmetic as "rare" without defining what rare means by probability.

---

## COPPA (USA — Children Online Privacy Protection Act)

**Applies to:** Games that target players under 13, or where the developer has actual knowledge they have users under 13.

**Requirements if triggered:**
- No targeted advertising to under-13 players.
- No collection of personal information without verifiable parental consent.
- No in-app purchases without parental consent flow.
- Store must block under-13 accounts from purchasing.

**Practical implication:** If the game has cartoon aesthetics, bright colors, or references children's media — COPPA may apply even without an explicit age target. Rate M (ESRB) is not a COPPA shield.

---

## GDPR (EU/UK)

**Applies to:** Any game with EU/UK players (which is almost all PC games).

**Requirements:**
- Privacy policy required — must describe what purchase data is collected, how it is stored, how long it is retained, and how players can request deletion.
- Right to erasure: a player can request all their purchase/account data be deleted.
- Consent must be explicit and unbundled — cannot pre-tick consent boxes.
- Data breach notification within 72 hours to the relevant supervisory authority.

**Practical implication:** Steam and EOS handle payment data — but the game's own backend (if any) must comply. If storing player IDs with purchase history: GDPR applies.

---

## Loot Box Laws by Region

| Region | Status |
|---|---|
| Belgium | Paid loot boxes banned. Must offer all items via direct purchase. |
| Netherlands | Randomized paid loot boxes banned. Probability disclosure + direct-purchase alternative required. |
| China | Probability of each item must be disclosed publicly. |
| UK | Not yet banned but under Parliamentary review (as of 2025). Treat as high-risk. |
| Australia | ACCC investigating — treat as high-risk. |
| USA | No federal ban; FTC monitoring. State laws vary. |

**Recommendation:** Use direct purchase as the primary model. If any randomized mechanic is used (even "bonus loot"), disclose all probabilities in-game and on the store page.

---

## Platform Store Policies

| Platform | Key restriction |
|---|---|
| Steam | All IAP must go through Steam MicroTxn API or Steam Inventory Service. No third-party payment on Steam. |
| Epic Games Store | Must use EOS Ecom for any EGS-exclusive IAP. |
| PlayStation Store | Sony review required for all DLC/IAP. Age-gate required for M-rated IAP. |
| Xbox Store | Microsoft review required. Parental controls enforced at OS level. |
| iOS App Store | 30% platform cut. Apple IAP only — no external payment links allowed. |
| Google Play | 30% platform cut (15% for first $1M/year). Play Billing only for digital goods. |
