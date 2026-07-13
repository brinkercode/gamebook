---
name: settlement-population
description: Use when a survival/crafting/civilization project needs an Anno-style population layer — an abstracted settler pool per settlement that consumes needs tiers from settlement stores, grows/upgrades on sustained fulfillment, and falls into unrest/exodus on sustained failure. Invoke when the design brief says "population growth", "settler needs", "residence tier", "settlement happiness", "colony growth", or when [[production-chains]] output needs a consumer sink and [[creature-work-assignment]] needs higher-tier workforce unlocks to draw from. Reach for it from a feature wave's design-economy or eng-gameplay role. Skip for a single-player-only survival loop with no settlement/colony layer (plain [[survival-stats]] covers personal vitals) and for individually-simulated NPC schedules below the abstraction cutover (see "Abstraction cutover" below) — use `enemy-ai-behavior-tree`/creature-work patterns for those.
version: "1.0.0"
---

# Settlement Population

> Each settlement is a `USettlementPopulationComponent` on an `ASettlementCenter` actor: a pool count (not N actors), a residence-tier sum for capacity, a per-tier needs-fulfillment ratio pulled from the settlement's shared item store, and a happiness score that integrates fulfillment over time. Growth, tier-upgrades, unrest, and exodus are all state transitions driven off that one happiness curve — deterministic, server-authoritative, and logged as deltas, never snapshotted.

## Abstraction cutover

Population is **a number, not a crowd of Characters**, until a settlement crosses a per-project visibility/perf threshold (`project.config.json` → `population.individual_sim_cutover`, default 12 pops per settlement). Below the cutover: pure data (`PopulationCount`, `HappinessScore`, needs ledger) — the world shows a handful of representative `APawn_Settler` cosmetic actors spawned/despawned to match the count, driven by the pool, never the reverse. Above the cutover (a metropolis end-state some projects never reach): individual pops still don't get full AI — they get lightweight scheduling only if the design explicitly asks for it; this skill does not cover that escalation. The player is always simulated individually via [[survival-stats]] regardless of settlement size — the player is never abstracted into the pool, only *counted as a resident* if they choose to bind to a settlement (see the survival twist below).

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Residence capacity** — `AResidenceBuilding` (an `AStructureBase` subclass per [[building-system]]) exposes `int32 CapacityProvided` by tier; `USettlementPopulationComponent::MaxPopulation` sums capacity across all residences owned by the settlement. See `resources/needs-tiers.md#residences`.
2. **Needs tiers** — `UDA_NeedsTier` Data Assets define per-tier consumption (food variety count, goods items, service-building access) drawn each cycle from the settlement's shared item store (the same inventory [[production-chains]] writes output into). See `resources/needs-tiers.md`.
3. **Fulfillment → happiness** — a periodic `USettlementPopulationComponent::TickNeedsCycle` (throttled world-subsystem tick, not per-frame) computes a fulfillment ratio per need, feeds a `UGameplayEffect`-driven `HappinessAttributeSet` (reuse the survival-stats AttributeSet pattern) via `SetByCaller`, decaying/growing happiness toward the ratio. See `resources/happiness-growth.md`.
4. **Growth & tier-upgrade** — sustained happiness above a threshold accrues growth points; crossing a capacity/growth gate raises `PopulationCount` (bounded by `MaxPopulation`) and, at design-set breakpoints, raises `SettlementTier`, unlocking higher-tier [[creature-work-assignment]] workforce slots and awarding tech-progression points. See `resources/happiness-growth.md#growth`.
5. **Unrest & exodus** — sustained happiness below a threshold grants `State.Settlement.Unrest`; continued failure ticks an exodus counter that removes population and can demote `SettlementTier`. All threshold flips are `FGameplayTag`s, never raw float compares scattered in gameplay code. See `resources/happiness-growth.md#unrest`.
6. **The survival twist** — the player is a settler too: personal survival-stats consumption ([[survival-stats]]) and settlement needs draw from the *same* shared item store when the player is physically present/bound to a settlement, so hoarding food for yourself starves the colony and vice versa. See `resources/needs-tiers.md#player-as-settler`.
7. **Persistence** — settlement population never saves a raw snapshot count; `PopulationCount`, `SettlementTier`, and the needs ledger are reconstructed by replaying the settlement's entries in the world delta log ([[procgen-world]] convention) alongside terrain/building deltas.
8. **UI** — `WB_SettlementOverview` (Common UI) surfaces population/capacity, per-need fulfillment bars, happiness trend, and tier-upgrade progress; binds to the component's delegates, never polls in Tick.

## Rules

- **Pool, not actors.** Never spawn one `Character`/`AIController` per settler below the cutover. Cosmetic `APawn_Settler` representatives are visual only and carry no gameplay state.
- **Needs cycle runs server-authoritative**, on a `UWorldSubsystem` throttled tick (e.g. every N seconds, not every frame); clients only receive replicated `PopulationCount`/`HappinessScore`/`SettlementTier` for HUD display.
- **Happiness math lives in GAS** (`HappinessAttributeSet`, `PreAttributeChange` clamp, `PostGameplayEffectExecute` for growth/decay) — no hand-rolled float accumulators outside the AttributeSet, matching the [[survival-stats]] pattern.
- **Deterministic-by-seed** wherever growth/exodus timing involves randomness (e.g. jitter on which residence a new pop occupies) — derive from the settlement's own `FRandomStream` seeded off the world seed + settlement ID, never `FMath::Rand`. Re-simulating from the delta log must reproduce identical population curves.
- **Item pools are shared, not duplicated.** The settlement needs ledger reads/writes the same inventory container [[production-chains]] and the player's own inventory draw from — do not maintain a parallel "settlement warehouse" data structure that can desync from the real store.
- **Tags, not magic numbers**, for every threshold: `State.Settlement.Thriving`, `State.Settlement.Unrest`, `State.Settlement.Exodus`, `SettlementTier.<N>`.

## UE5 context

- Modules affected: `Source/<Project>/Public/Settlement/` (`USettlementPopulationComponent`, `ASettlementCenter`, `HappinessAttributeSet`), `Source/<Project>/Public/Data/` (`UDA_NeedsTier`), `Source/<Project>Tests/` (needs-cycle + growth/exodus Functional Tests).
- Asset paths: `Content/Settlement/DA_NeedsTier_<Tier>.uasset`, `Content/Settlement/BP_SettlementCenter.uasset`, `Content/Building/BP_Structure_Residence_<Tier>.uasset`, `Content/UI/WB_SettlementOverview.uasset`.
- Config files: `Config/DefaultGameplayTags.ini` (`State.Settlement.*`, `SettlementTier.*`, `SetByCaller.NeedsFulfillment.*`).

## Resources (read on demand)

- `resources/needs-tiers.md` — `UDA_NeedsTier` schema, residence capacity summation, shared item-store consumption per cycle, the player-as-settler shared-pool wiring.
- `resources/happiness-growth.md` — `HappinessAttributeSet` C++ (fulfillment → happiness GE chain), growth/tier-upgrade gates, unrest/exodus tag flips and population removal, delta-log persistence shape, Functional Test specs.

## Output

A wave using this skill delivers: `USettlementPopulationComponent` (C++, attached to `ASettlementCenter`), `HappinessAttributeSet` (GAS AttributeSet), `UDA_NeedsTier` Data Assets per tier, the `SettlementTier.*`/`State.Settlement.*` tags, and `WB_SettlementOverview`. `systems_surface[]` entries this skill produces: `type: "component"` for `USettlementPopulationComponent`, `type: "attribute"` for `HappinessAttributeSet`, `type: "effect"` for the `GE_Settlement_NeedsFulfillment`/`GE_Settlement_Growth`/`GE_Settlement_Unrest` chain, `type: "data"` for `UDA_NeedsTier` — `eng-gameplay` exposes the component/AttributeSet/effect C++, `design-technical` wires the Data Assets, tag thresholds, and `WB_SettlementOverview` layout. Proven by a Functional Test named `<Project>.Settlement.Population.GrowsOnSustainedFulfillmentDecaysOnSustainedFailure` that stocks a settlement's shared store above its needs threshold for N cycles and asserts `PopulationCount` grows and `SettlementTier` upgrades, then starves the same settlement and asserts `State.Settlement.Unrest` grants and population declines toward exodus — run twice from the same seed and delta log to assert identical curves. Cross-reference [[procgen-world]] for the delta-log persistence convention, [[production-chains]] for the shared item-store source, [[building-system]] for residence capacity, [[creature-work-assignment]] for the workforce-tier unlock consumer, and [[survival-stats]] for the player's personal-vitals pattern this reuses.
