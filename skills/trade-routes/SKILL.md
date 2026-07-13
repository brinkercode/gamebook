---
name: trade-routes
description: Use when a survival/crafting/civilization project needs inter-region trade — trade-post buildings, scheduled routes moving a goods manifest between two settlements via a carrier (creature caravan or boat), and simple scarcity-driven pricing. Invoke when the design brief says "trade route", "caravan", "trade post", "shipping lane", "market price", or when [[production-chains]]/[[procgen-world]] region scarcity means no settlement is self-sufficient and goods must move. Reach for it from a feature wave's design-economy or eng-gameplay role. Skip for single-settlement goods flow with no cross-region movement (`production-chains` alone covers that) and for a full dynamic supply/demand simulation — see `resources/market-pricing.md#why-not-dynamic` for why that's a trap for a first slice.
version: "1.0.0"
---

# Trade Routes

> A `ATradePost` building exposes buy/sell slots against a settlement's shared item store. An `FTradeRoute` is data — origin post, destination post, a goods manifest, and a carrier assignment — advanced on the same coarse settlement tick [[production-chains]] uses. Travel time comes from the region-graph distance [[procgen-world]] already computed; prices are static base values modified by each region's scarcity profile, not a simulated market. Everything server-authoritative; routes persist as delta-log entries, not snapshots.

## When to use

Invoke once region scarcity ([[procgen-world]] region profiles + [[production-chains]] fertility gating) means at least two settlements need goods neither can produce locally. One route *family* per invocation (e.g. first pass wires the route data model + one carrier type; a second boat-carrier type is a `/fix`-sized addition once the model exists). Escalate to `/ship` for the first trade pass — new `ATradePost`, `FTradeRoute` schema, and route-tick subsystem is multi-surface. Use `/fix` to add one route instance, one manifest edit, or one new carrier BP to an existing system. Skip entirely for single-settlement economies (`production-chains` alone) and for player-only point-to-point selling with no scheduled route (a simple `ATradePost` buy/sell with no `FTradeRoute` covers that — don't build the route layer for it).

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Trade post building** — `ATradePost` (subclass of `AStructureBase` per [[building-system]]) exposes a buy/sell interface against the settlement's shared item store (the same store [[production-chains]] and [[settlement-population]] read/write). See `resources/route-planner.md#trade-post`.
2. **Route as data** — `FTradeRoute` struct: origin post, destination post, `TArray<FTradeManifestEntry>` (good, quantity, direction), assigned carrier, current leg/ETA. Routes live in a `UTradeRouteSubsystem` registry, not scattered actor state. See `resources/route-planner.md#route-schema`.
3. **Carrier assignment** — a route's carrier is either a creature caravan (`Work.Transport` slot via [[creature-work-assignment]]) or a boat/vehicle actor; both advance the same route-leg state machine. See `resources/route-planner.md#carriers`.
4. **Travel time** — derived from the region-graph edge distance [[procgen-world]] already builds, divided by the carrier's speed stat; never a hand-tuned per-route constant. See `resources/route-planner.md#travel-time`.
5. **Seeded events (optional)** — ambush/weather rolls along a leg draw from an `FRandomStream` seeded `(WorldSeed, RouteInstanceID, LegIndex)`, gated by a `project.config.json` flag; skip entirely for a calmer first slice. See `resources/route-planner.md#seeded-events`.
6. **Pricing** — static base price per good (`DT_GoodsPricing`) modified by the destination/origin region's scarcity value from its procgen profile. No live supply/demand simulation. See `resources/market-pricing.md`.
7. **NPC faction trade (optional)** — a faction-owned post can run routes against the player's settlements under the same `FTradeRoute` schema; scope only if the design brief asks for it. See `resources/market-pricing.md#faction-trade`.
8. **Route automation UI** — `WB_TradeRoutePlanner` lets a player set a manifest and mark a route repeating; the subsystem re-queues the route on completion rather than the UI polling. See `resources/route-planner.md#automation-ui`.
9. **Verify** — create a two-post route with a manifest, assign a carrier, advance the settlement tick past the computed travel time, confirm goods move origin→destination store and gold settles at scarcity-adjusted price; confirm a repeating route re-queues without duplicate goods; confirm save/reload round-trips an in-transit route's leg/ETA state.

## Rules

- **Server-authoritative.** Route creation, manifest edits, carrier assignment, and leg advancement all execute server-side; clients only receive replicated route state for UI. Never let a client apply a trade outcome locally and trust it.
- **Deterministic-by-seed** wherever a route involves randomness (event rolls, carrier travel jitter) — derive from `FRandomStream(WorldSeed, RouteInstanceID, ...)`, never `FMath::Rand`. Re-simulating from the delta log must reproduce identical route outcomes.
- **Routes persist as delta-log entries**, not snapshots — a route's creation, manifest changes, and each leg completion write an entry to the same world delta log [[procgen-world]] defines; on load, replay reconstructs current leg/ETA rather than deserializing a raw position.
- **No live economy simulation.** Prices are static-base-plus-scarcity-modifier, recomputed from data, not accumulated state that drifts — see `resources/market-pricing.md#why-not-dynamic`.

## UE5 context

- Modules affected: `Source/<Project>/Public/Economy/Trade/` (`ATradePost`, `UTradeRouteSubsystem`, `FTradeRoute`/`FTradeManifestEntry` structs, carrier actors), `Source/<Project>Tests/` (route travel-time + persistence Functional Tests).
- Asset paths: `Content/Data/Economy/DT_GoodsPricing.uasset`, `Content/Economy/BP_TradePost.uasset`, `Content/Economy/BP_Carrier_<Caravan|Boat>.uasset`, `Content/UI/WB_TradeRoutePlanner.uasset`.
- Config files: `Config/DefaultGameplayTags.ini` (`Building.TradePost`, `Work.Transport`, `Route.Event.Ambush`, `Route.Event.Weather`), `project.config.json` (`trade.seeded_events_enabled`, `trade.faction_trade_enabled`).

## Resources (read on demand)

- `resources/route-planner.md` — `ATradePost`/`FTradeRoute`/`UTradeRouteSubsystem` C++ templates, carrier assignment (creature caravan vs boat), travel-time-from-region-graph math, optional seeded ambush/weather event hooks, route automation UI wiring, delta-log persistence shape.
- `resources/market-pricing.md` — `DT_GoodsPricing` schema, base-price-plus-scarcity-modifier formula, why a full dynamic supply/demand economy is a trap for a first slice, optional NPC faction trade section.

## Output

A wave using this skill delivers: `ATradePost` (C++ building actor), `UTradeRouteSubsystem` (C++, `UWorldSubsystem`, owns the route registry and advances legs on the shared settlement tick), `FTradeRoute`/`FTradeManifestEntry` (C++ structs), `DT_GoodsPricing` (Data Table, + generator script per [[ue5-editor-python]]), at least one carrier implementation (creature caravan via [[creature-work-assignment]] or a boat/vehicle BP), and `WB_TradeRoutePlanner` (Common UI). `systems_surface[]` entries this skill produces: `type: "subsystem"` for `UTradeRouteSubsystem`, `type: "actor"` for `ATradePost`, `type: "data"` for `DT_GoodsPricing` and the `FTradeRoute` row struct — `eng-gameplay` exposes the subsystem/actor/struct C++, `design-technical` wires trade-post BP instances, pricing table rows, carrier BP assignments, and `WB_TradeRoutePlanner` layout. Proven by a Functional Test named `<Project>.Economy.TradeRoutes.RouteDeliversManifestAtScarcityPrice` that creates a route between two seeded regions with differing scarcity profiles, advances the settlement tick past the computed travel time, and asserts the manifest goods land in the destination store at the scarcity-adjusted price while a save/reload mid-transit reproduces identical leg/ETA state from the delta log. Cross-reference [[procgen-world]] for the region-graph distances and delta-log convention this skill's travel time and persistence build on, [[production-chains]] for the shared item-store buffers a trade post reads/writes, [[creature-work-assignment]] for the caravan carrier's `Work.Transport` slot, and [[settlement-population]] for the needs ledger a route's delivered goods ultimately feed.
