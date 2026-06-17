# Monetization Interview — Question Bank

Start with pay-to-win red lines. The rest of the interview is constrained by what you lock here.

---

## Section 1: Pay-to-Win Red Lines (Lock First)

1. **Can real money or premium currency purchase anything that affects gameplay balance?**
   - Weapon stats, damage multipliers, movement speed, health — any of these: YES or NO.
   - Locked answer for this project is **NO**. Confirm the user agrees and understands this is non-negotiable.
2. **What exactly can be purchased?** (Ask in prose — let the user describe it, then confirm it is cosmetics-only)
   - Character skins, weapon skins, emotes, sprays, player cards — cosmetics only.
   - Anything that changes gameplay (XP boosts, unlock shortcuts, early access to weapons) is a red line violation — flag it explicitly if the user proposes it.
3. **Can cosmetics be earned without paying?** (There must be a path to every cosmetic through play — confirm this)

---

## Section 2: Currency Model

4. **Single premium currency or dual-currency model?**
   - Single premium (Robux-style): all store items priced in one purchased currency. Simpler, cleaner.
   - Dual currency (soft + hard): soft currency earned through play; hard currency purchased. More complex grind/monetization balance.
5. **What is the premium currency called?** (Name, symbol)
6. **What are the purchase tiers?** (The bundles: e.g., 500 coins / $4.99, 1100 coins / $9.99, 2400 coins / $19.99 — standard 10% bonus at mid tier, 20% at high tier)
7. **Is there a starter pack?** (One-time discounted bundle for new players — high conversion, common in F2P)

---

## Section 3: Cosmetics Catalogue

8. **What cosmetic categories exist at launch?** (Character skins, weapon skins, emotes, sprays, kill effects, voice packs — confirm cosmetics-only)
9. **How many items in each category at launch?** (Scope constraint — every item needs art, implementation, and QA)
10. **Are there rarity tiers?** (Common / Rare / Epic / Legendary — affects drop rates if loot boxes are used, affects pricing if direct purchase)
11. **Are loot boxes / gacha mechanics used?** (If yes: mandatory probability disclosure by law in most markets — flag immediately. Strongly discouraged for indie teams due to legal complexity.)
12. **Direct purchase, battle pass, or both?**
    - Direct purchase: player buys exactly what they want. No surprise costs. Preferred.
    - Battle pass: seasonal paid progression track. Recurring revenue. Requires seasonal content cadence team commitment.

---

## Section 4: Cadence and Seasons

13. **Is there a seasonal content model?** (How often does new content drop? What happens to old content — vaulted / permanently available / discounted?)
14. **Is there limited-time content?** (FOMO mechanics — legal in most markets but creates player resentment if over-used. Flag if yes.)
15. **What is the content creation rate the team can sustain?** (Be honest — two skins per month is more than most indie teams can ship reliably)

---

## Section 5: Business Model

16. **Is the base game paid or free-to-play?**
    - Paid base game + cosmetics: established model, better player quality, lower total player count
    - Free-to-play + cosmetics: largest funnel, but requires more anti-cheat investment and higher content cadence
17. **What is the revenue target for the vertical slice?** (Helps scope the store infrastructure complexity)
18. **Which platforms are the primary store?** (Steam MicroTxn / Epic Online Services Ecom / PlayStation Store / Xbox Store — each has different payment API and approval process)

---

## Section 6: Legal and Compliance

19. **Is the game targeting players under 13?** (If yes: COPPA compliance required — no targeted ads, no data collection without parental consent, payment restricted)
20. **Are EU players in scope?** (GDPR: explicit consent for any purchase data; right to erasure; DPA registration may be required)
21. **FTC disclosure requirement:** Any streamer or influencer paid to promote the game must disclose the relationship. Confirm the team understands this before any influencer marketing.
22. **Loot-box laws:** Belgium and the Netherlands have banned paid loot boxes. China requires probability disclosure. If loot boxes are used, these markets need region-locking or direct-purchase alternatives.
