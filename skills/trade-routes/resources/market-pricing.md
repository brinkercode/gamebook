# Market Pricing

Static base-price-plus-scarcity-modifier pricing, why a full dynamic economy is a trap for a
first slice, and the optional NPC faction trade extension.

## Pricing model {#model}

`DT_GoodsPricing` is a Data Table, one row per good, holding a **static base price** — the price
never drifts from player transaction volume:

```cpp
// Source/<Project>/Public/Economy/Trade/GoodsPricingTypes.h
USTRUCT(BlueprintType)
struct FGoodsPricingRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FGameplayTag GoodTag;       // Good.Ore, Good.Ingot, Good.Tools, ...

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BasePrice = 1.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float ScarcityWeight = 1.f; // how strongly regional scarcity moves this good's price
};
```

Generate the table via [[ue5-editor-python]]'s DataTable-from-CSV recipe, not by hand-editing the
`.uasset`.

The **sell price at a given trade post** is computed at the moment of the transaction, not
cached or accumulated:

```cpp
float UTradeRouteSubsystem::ComputeSellPrice(const FGameplayTag& GoodTag, const ATradePost* At) const
{
    const FGoodsPricingRow* Row = GoodsPricingTable->FindRow<FGoodsPricingRow>(GoodTag.GetTagName(), TEXT("TradeSell"));
    check(Row);

    const UWorldGenSubsystem* WorldGen = GetWorld()->GetSubsystem<UWorldGenSubsystem>();
    const FRegionProfile& Region = WorldGen->GetRegionProfile(WorldGen->GetRegionForActor(At));

    // Scarcity is a [0,1] value already computed per region by procgen-world's region-graph
    // pass (0 = abundant locally, 1 = this region cannot produce the good at all).
    const float Scarcity = Region.GetScarcityForGood(GoodTag);
    const float Multiplier = FMath::Lerp(0.75f, 1.75f, Scarcity * Row->ScarcityWeight);

    return Row->BasePrice * Multiplier;
}
```

This reads `FRegionProfile` — the same per-region resource/fertility data [[procgen-world]]'s
region graph assigns and [[production-chains]] already queries for fertility gating. Trade
pricing and production fertility gating are two views of the *same* scarcity data, not two
independent systems that could disagree.

## Why not dynamic {#why-not-dynamic}

A fully dynamic supply/demand market (prices that rise/fall from live buy/sell volume, decay
over time, propagate across regions) is tempting but a trap for a first slice, for concrete
reasons:

- **No stable target for playtesting or balance.** Static-base-plus-scarcity gives designers a
  spreadsheet they can reason about (`resources/market-pricing.md` is that spreadsheet). A live
  market's equilibrium is only knowable by running the simulation, which makes "is trade route X
  worth it" unanswerable at design time.
- **Determinism gets much harder.** Every trade transaction becomes a state mutation that must
  replay identically from the delta log across save/reload and multiplayer clients. Static
  pricing only needs the region scarcity value (already deterministic, already logged) — no
  additional state to reconcile.
- **Multiplayer desync surface.** A live market shared across clients needs its own
  authority/replication/conflict-resolution story on top of the trade-route replication this
  skill already needs. Scarcity-modified static pricing has zero extra replication cost — it's a
  pure function of data already on the server.
- **It doesn't serve the actual design goal.** The forcing function this skill exists for is
  *"no region is self-sufficient, so routes matter"* — that comes entirely from the scarcity
  values [[procgen-world]] bakes into the region graph. A live market adds volatility without
  adding to that core pressure.

If a project's design brief genuinely calls for a living market later (post-vertical-slice), treat
it as a new, separate `/ship`-sized feature that *layers on top of* this static model — don't
retrofit accumulation state into `DT_GoodsPricing` rows.

## NPC faction trade (optional) {#faction-trade}

Scope this section only if the design brief explicitly asks for AI-run trade. An NPC faction can
own `ATradePost` instances and run `FTradeRoute`s against player (or other-faction) settlements
under the exact same schema — no parallel "faction economy" system:

- A faction-owned `ATradePost` is flagged `bFactionOwned = true` and its `OwningSettlement` points
  at a faction settlement (or a lightweight `AFactionTradeHub` if the project has no full faction
  settlement layer).
- Faction routes are created by a coarse `UFactionTradeDirector` (`UWorldSubsystem`) that
  periodically (same coarse tick cadence, not per-frame) evaluates faction settlements' surplus vs
  deficit against `FRegionProfile` scarcity and calls the same `UTradeRouteSubsystem::CreateRoute`
  player routes use.
- Faction route randomness (which surplus good to route, which destination to prefer among ties)
  draws from `FRandomStream(WorldSeed, FactionId, DecisionTick)` — deterministic-by-seed like every
  other roll in this skill.
- Faction routes are still server-authoritative and still write the same
  `TradeRoute.Created`/`LegCompleted` delta-log entries — a save/reload must reproduce faction
  route state identically to player route state, because it's the same code path.
- Player interaction (raiding a faction caravan, competing on the same route) is out of scope for
  this skill — route relative to the region graph is not a combat or diplomacy state machine.
