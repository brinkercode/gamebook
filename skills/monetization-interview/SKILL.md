---
name: monetization-interview
description: Use when a UE5 FPS project needs to design its monetization model — virtual currency, cosmetics catalogue, purchase cadence, FTC/COPPA/GDPR compliance, and no-pay-to-win red lines — before any store UI or IAP integration is wired up. Invoke when the user says "do the monetization interview", "design the store", or "how do we monetize".
version: "1.0.0"
---

# Monetization Interview

> Conversational intake that locks in currency model, cosmetics catalogue structure, purchase cadence, store UX, legal compliance requirements (FTC, COPPA, GDPR), and pay-to-win red lines — then writes `docs/MONETIZATION.md`.

## When to use

Invoke before any store UI, IAP integration, or premium currency system is built. The locked decisions here drive the `microtransaction-store` recipe. Skip when `docs/MONETIZATION.md` exists and only adding a new item type — update in place.

## How it works

1. **Open the question bank** — read `resources/questions.md`; start with the no-pay-to-win red lines before discussing currency, so the constraints are set before design begins.
2. **Lock the pay-to-win contract** — get explicit confirmation on what can and cannot be purchased. This becomes a non-negotiable constraint in `docs/MONETIZATION.md`.
3. **Design the currency model** — soft currency (earned in-game), hard currency (purchased), or premium direct (no virtual currency, real money only). Confirm platform implications.
4. **Scope the cosmetics catalogue** — what categories exist at launch, what the cadence looks like, how seasonal or battle-pass content works.
5. **Map legal requirements** — read `resources/legal-mapping.md`; flag COPPA (under-13 audience), GDPR (EU players), FTC disclosures, and loot-box regulations.
6. **Map to systems** — read `resources/systems-mapping.md`; translate decisions to Steam MicroTxn, EOS Ecom, or console store integration requirements.
7. **Write `docs/MONETIZATION.md`** — use `resources/output-template.md`.
8. **Hand off** — note that `microtransaction-store` skill reads this doc; flag any legal review items before store goes live.

## Resources (read on demand)

- `resources/questions.md` — all interview questions.
- `resources/legal-mapping.md` — FTC, COPPA, GDPR, loot-box law summary and required disclosures.
- `resources/systems-mapping.md` — maps currency/catalogue decisions to Steam MicroTxn API, EOS Ecom, and console store integration.
- `resources/output-template.md` — `docs/MONETIZATION.md` template.

## Output

A populated `docs/MONETIZATION.md` with pay-to-win contract, currency model, cosmetics catalogue, purchase cadence, legal requirements, and platform integration notes. `microtransaction-store` recipe and `eng-build` read this before store work begins.
