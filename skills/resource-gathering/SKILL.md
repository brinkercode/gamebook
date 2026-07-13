---
name: resource-gathering
description: Use when a survival/crafting/civilization-shaped gamebook project needs harvestable world resources — procgen-placed nodes (trees, ore veins, plant clusters), a gathering ability with tool-tier gating, seeded yield rolls, and depletion/respawn that persists as world deltas. Invoke when the user says "add resource nodes", "implement harvesting/gathering", "add a mining/logging/foraging system", or "wire tool tiers to resource yield". Not for crafting recipes or inventory UI themselves — this skill produces the loot that feeds [[inventory-system]].
version: "1.0.0"
---

# Resource Gathering

> Procgen-placed harvest nodes, a GAS-based `GA_Harvest` ability with GameplayTag tool-tier gating, deterministic per-node yield rolls, and depletion/respawn tracked as world deltas so a chopped tree stays chopped.

## When to use

Invoke for any survival/crafting/civ-builder project that needs the player (or a worker/settler AI) to extract raw materials from the world — wood, ore, fiber, stone, game meat, etc. One node *type* (e.g. `DA_Node_OakTree`) per invocation; batch a family (all tree species) in one pass if they share a yield/respawn shape. Escalate to `/ship` if this is the first resource system in the project (needs the AttributeSet for node Health, the tool-tier tag taxonomy, and the delta-log hookup all at once — multi-surface). Skip if the "resource" is a quest pickup or a one-off scripted item; use `pickup-system` for that instead.

## How it works

Keep this section short — it is always loaded. Push depth into `resources/` and only read those files when the step calls for them (progressive disclosure).

1. **Node data** — define `UDA_HarvestNodeDef` (health, yield table, required tool tier, respawn policy) per `resources/harvest-nodes.md`. One Data Asset per node type, never hardcoded per-actor values.
2. **Node actor** — `AHarvestNode` is spawned exclusively by procgen/PCG placement (never hand-placed in a level) per `resources/harvest-nodes.md`. It holds an `FRandomStream` seeded from `(WorldSeed, NodeID)` for deterministic yield rolls.
3. **Tool tiers** — define the `Tool.<Category>.Tier<N>` GameplayTag ladder per `resources/tool-tiers.md`; nodes gate harvest by minimum tier via `RequireGameplayTagsExact`/`AbilityTagsToBlock` checks.
4. **Harvest ability** — `GA_Harvest` (C++ base, thin BP wrapper) validates tool tier, applies damage-to-node via a `GameplayEffect`, and on node-death rolls yield through the node's `FRandomStream` per `resources/harvest-nodes.md`.
5. **Persistence** — node depletion/respawn is a delta record (`FResourceNodeDelta`) appended to the [[procgen-world]] delta log, not saved as full actor state. Respawn is time- or event-gated and re-evaluated on load.
6. **Loot handoff** — rolled yield is handed to [[inventory-system]] via `IInventoryReceiver` / `UInventoryComponent::TryAddItems`; never spawn pickup actors as an intermediate step unless the project explicitly wants physical drops.
7. **Multiplayer** — if `project.config.json` sets `networking != single-player`, yield rolls and node-health mutation happen server-side only; clients predict the swing animation, not the loot.
8. **Verify** — harvest a node to depletion in PIE, confirm loot lands in inventory, confirm the node stays depleted across a save/load cycle, confirm a lower-tier tool is rejected.

## UE5 context

- Modules affected: `Source/<Project>/Public/World/HarvestNode.h`, `Source/<Project>/Public/Abilities/GA_Harvest.h`, `Source/<Project>/Public/Data/DA_HarvestNodeDef.h`
- Asset paths: `Content/World/Resources/DA_Node_*`, `Content/GAS/Abilities/GA_Harvest`, `Content/GAS/Effects/GE_HarvestDamage`
- Config files: `Config/DefaultGameplayTags.ini` (Tool.* and Resource.* tags)
- Interlocks: [[procgen-world]] (placement + delta log), [[inventory-system]] (loot destination), `gas-ability` (ability/effect authoring conventions this skill specializes)

## Resources (read on demand)

- `resources/harvest-nodes.md` — `UDA_HarvestNodeDef` schema, `AHarvestNode` actor, procgen spawn contract, seeded `FRandomStream` yield rolls, delta-log respawn/depletion.
- `resources/tool-tiers.md` — `Tool.<Category>.TierN` tag taxonomy, `GA_Harvest` tool-gating logic, server-authoritative yield in multiplayer.

## Output

A wave run using this skill delivers: `DA_Node_<Type>` Data Asset(s), `AHarvestNode` C++ class (or confirmation an existing one is reused), `GA_Harvest` ability (C++ base + BP child if tuned), the `Tool.*`/`Resource.*` tag entries, and a `systems_surface[]` handoff describing them (see below). The proving Functional Test is `<Project>.Resources.Harvest.DepletionPersists` — spawn a node with a fixed seed, harvest it to zero health, save, reload, and assert the node reports `Depleted` with no respawn timer fired early; a companion `<Project>.Resources.Harvest.ToolGate` asserts a Tier1 tool is rejected by a Tier2-required node.

`systems_surface[]` entry types this skill produces (for `eng-gameplay` → `systems.json`):
- `type: "ability"` — `GA_Harvest` (and any per-resource-family BP children)
- `type: "effect"` — `GE_HarvestDamage`, `GE_HarvestYieldGrant` (if yield is modeled as a meta-attribute rather than direct inventory call)
- `type: "data_asset"` — `UDA_HarvestNodeDef` and its instances
- `type: "actor"` — `AHarvestNode`
- `type: "subsystem"` — hook into the world delta subsystem owned by `procgen-world` (this skill does not own that subsystem, only appends to it)

`design-technical` wires: the yield `DT_HarvestTable` (DataTable of item/weight/count-range rows per node type), tool-tier tag assignment on tool Data Assets, and respawn-policy tuning (fixed timer vs. seasonal/event trigger) per node type.
