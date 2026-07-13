---
name: tech-progression
description: Use when a wave needs a research/unlock tree gating crafting recipes, buildings, capture devices, or production-chain tiers — tech nodes as DataTable rows with prerequisites and GameplayTag grants, a UProgressionSubsystem that applies those tags to the player/settlement ASC, and progression-currency sources (tier-ups, POI discovery, first-craft bonuses). Invoke when the design brief says "tech tree", "research", "unlock system", "skill tree", or when crafting-system/building-system/production-chains/creature-taming need a shared gate instead of bespoke unlock booleans. Reach for it from a feature wave's design-technical or eng-gameplay role. Skip for a single one-off unlock with no tree structure (grant the tag directly via an existing GameplayEffect) and for pure stat-point leveling with no node graph (that's an AttributeSet concern, not this skill).
version: "1.0.0"
---

# Tech Progression

> Tech nodes are `DT_TechTree` rows, not code branches: cost, `prerequisites[]`, and `grants[]` (GameplayTags). A `UProgressionSubsystem` is the single write-path that applies granted tags to the player or settlement `UAbilitySystemComponent` — every gated system (crafting, building placement, capture devices, production-chain tiers) checks a tag it owns, never a bespoke `bool bUnlocked` flag. Currency accrues from settlement tier-ups, exploration POIs, and first-craft bonuses; spending and granting are both server-authoritative and logged to the save delta stream.

## When to use

Invoke when a feature needs a persistent unlock tree that other systems gate on: research points spent on nodes, prerequisite chains, or currency sources that feed those nodes. One tree (or one clearly-scoped subtree, e.g. "smithing branch") per invocation. Escalate to `/ship` (feature wave) when this is the first progression pass on a project — new `UProgressionSubsystem` + tag taxonomy + save schema is multi-surface. Use `/fix` for adding a handful of nodes to an existing tree. Skip entirely for a single ungated unlock (apply the tag via a normal `UGameplayEffect`) and for pure numeric leveling (XP → AttributeSet, not this skill).

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Tech tree data** — author `DT_TechTree` rows (`NodeID`, `Cost`, `TierID`, `prerequisites[]` as `FName` node IDs, `grants[]` as `FGameplayTagContainer`) per `resources/tech-tree-data.md#schema`. Nodes are data; prerequisite logic is generic graph traversal in C++, never per-node branches.
2. **Currency sources** — settlement tier-ups, exploration POI discovery, and first-craft bonuses each call `UProgressionSubsystem::AddPoints` through their own system (never mutate points directly) per `resources/tech-tree-data.md#currency-sources`.
3. **Unlock application** — `UProgressionSubsystem::UnlockNode(NodeID)` validates prerequisites + cost server-side, deducts points, and grants `grants[]` tags to the target ASC via `UAbilitySystemComponent::SetTagMapCount` (or a persistent `UGameplayEffect` if the tag must survive respec cleanly) — never a raw bool. See `resources/unlock-gates.md#subsystem`.
4. **Consumer gating** — crafting recipe rows, building placement checks, capture-device eligibility, and production-chain tier unlocks each query `HasMatchingGameplayTag()` against the granted tags — see `resources/unlock-gates.md#consumers` for the exact query points in `crafting-system`, `building-system`, `creature-taming`, and `production-chains`.
5. **Respec policy** — decide up front whether respec exists (full refund vs partial-cost, tree-wide vs per-node) and gate it the same way as any other consumer — see `resources/unlock-gates.md#respec`.
6. **Tree UI** — `WB_TechTree` reads `DT_TechTree` directly for node layout/cost display and binds to `UProgressionSubsystem`'s unlock-changed delegate for live lock/unlock state — see `resources/unlock-gates.md#ui`.
7. **Persistence** — unlocked node IDs and current points are appended to the save delta log, not re-derived — see `resources/unlock-gates.md#persistence`, cross-reference `[[procgen-world]]` for the delta-log convention this reuses.
8. **Verify** — attempt to unlock a node whose prerequisite is not yet granted and confirm server rejection; unlock the prerequisite, then the node, and confirm the target ASC receives the `grants[]` tags and a gated consumer (e.g. a crafting recipe) becomes available.

## UE5 context

- Modules affected: `Source/<Project>/Public/Progression/` (`UProgressionSubsystem`, `FTechNodeRow` struct), `Source/<Project>/Public/Save/` (progression save fields), `Source/<Project>Tests/` (prerequisite-enforcement Functional Test).
- Asset paths: `Content/Data/Progression/DT_TechTree_<Domain>.uasset`, `Content/UI/WB_TechTree.uasset`.
- Config files: `Config/DefaultGameplayTags.ini` (`Unlock.Recipe.*`, `Unlock.Building.*`, `Unlock.Capture.*`, `Unlock.Chain.Tier.*`).

## Resources (read on demand)

- `resources/tech-tree-data.md` — `FTechNodeRow` schema, `ue5-editor-python` DataTable-from-CSV generation, prerequisite-graph validation (cycle detection), currency-source wiring (tier-up/POI/first-craft).
- `resources/unlock-gates.md` — `UProgressionSubsystem` C++ template (`UnlockNode`, `AddPoints`, tag-grant path), consumer query points in sibling systems, respec policy options, `WB_TechTree` UI wiring, save delta-log persistence, the prerequisite-enforcement Functional Test.

## Output

A wave using this skill delivers: `DT_TechTree_<Domain>` (+ generator script per `ue5-editor-python`), `UProgressionSubsystem` (C++, `UGameInstanceSubsystem` for player-scoped trees or a settlement-owned equivalent for civ-scoped trees) exposing `UnlockNode`/`AddPoints`/an unlock-changed delegate, and `WB_TechTree` reading the DataTable for layout and the subsystem for live state. `systems_surface[]` entries: `type: "subsystem"` for `UProgressionSubsystem` — `eng-gameplay` exposes the C++ class and the `FTechNodeRow` struct; `type: "data"` for `DT_TechTree_<Domain>` — `design-technical` authors the rows, the `Unlock.*` tag taxonomy in `Config/DefaultGameplayTags.ini`, and wires `WB_TechTree` plus each consumer system's tag check. Proven by a Functional Test named `<Project>.Progression.<Domain>.EnforcesPrerequisites` that attempts `UnlockNode` on a node with an ungranted prerequisite (expects server rejection, no tags granted, no points spent), then unlocks the prerequisite and the node in order and asserts the target ASC holds every tag in `grants[]`. Cross-reference [[procgen-world]] for the delta-log persistence convention, and [[crafting-system]], [[building-system]], [[creature-taming]], [[production-chains]] for the consumer-side tag checks this skill's grants feed.
