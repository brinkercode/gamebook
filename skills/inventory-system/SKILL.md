---
name: inventory-system
description: Use when a UE5 project needs item storage and transfer — player backpacks, creature/mount carry slots, chests, crafting-station input/output buffers, or any container that holds stackable items. Invoke when the user says "add an inventory", "add a chest/container", "wire crafting station input", "let creatures carry loot", or when design-technical specs slot/weight capacity for a survival/crafting/civilization-shaped project. Not for single-shot world pickups (see pickup-system) or for equipment slots with active gameplay effects (see gas-ability for the GE side; this skill only moves item structs).
version: "1.0.0"
---

# Inventory System

> Creates `UInventoryComponent` (a reusable `UActorComponent`, attachable to players, creatures, chests, and crafting stations alike), `UDA_ItemDefinition` (Primary Data Asset per item type), `FInventoryEntry` (lightweight instance struct), and server-authoritative transfer functions. One component, many owners — a chest and a backpack are the same C++ class configured differently.

## When to use

Invoke once per project to establish the system, then reuse the same `UInventoryComponent` for every container. Escalate to `/ship` if the request also needs new crafting logic, a new UMG screen, or new world-pickup actors — those are `design-technical` / `pickup-system` territory that consumes this skill's surface. Depends on nothing; `[[pickup-system]]` and `[[procgen-world]]` depend on this skill (drops feed in, save deltas feed out).

## How it works

1. **Item definitions** — create `UDA_ItemDefinition` (`UPrimaryDataAsset`) per `resources/item-data.md`: stack size, weight, gameplay tags, icon, world-drop mesh.
2. **Instance struct** — add `FInventoryEntry` (definition ID + count + optional instance payload for durability/rolled stats) per `resources/item-data.md`.
3. **Component** — create `UInventoryComponent` per `resources/containers-replication.md`; same class for `BP_PlayerCharacter`, `BP_Creature_*`, `BP_Chest`, `BP_CraftingStation` (input/output buffer instances).
4. **Capacity model** — pick slot count, weight cap, or hybrid per `resources/item-data.md#capacity-model`; encode on the component instance, not hardcoded.
5. **Transfers** — implement `Server_TransferItem` RPCs with `WithValidation`, predicted client-side UI update, server-corrected on reject, per `resources/containers-replication.md`.
6. **UMG binding** — expose a `UInventoryViewModel` per `resources/containers-replication.md#viewmodel`; widgets bind to the view model, never read the component directly (eng-ui seam).
7. **Persistence** — serialize `TArray<FInventoryEntry>` per component instance into the save delta log per `resources/containers-replication.md#persistence`; interlocks with `[[procgen-world]]`'s delta log and the `save-system` skill.
8. **Verify** — transfer an item between two `UInventoryComponent`s in PIE (client + listen server), confirm server-authoritative reject on overweight/overfull, confirm save/reload round-trips exact stack counts.

## UE5 context

- Modules affected: `Source/<Project>/Public/Inventory/`, `Source/<Project>/Public/Data/`
- Asset paths: `Content/Data/Items/DA_Item_*.uasset`, `Content/Inventory/`
- Config files: none required; item tag taxonomy appends to `Config/DefaultGameplayTags.ini` if item categories double as GAS tags (e.g. `Item.Category.Consumable`)

## Resources (read on demand)

- `resources/item-data.md` — `UDA_ItemDefinition` C++ template, `FInventoryEntry` struct, stack/weight/slot capacity models, deterministic-seed notes for procedurally rolled item instances.
- `resources/containers-replication.md` — `UInventoryComponent` C++ template, server-authoritative transfer RPCs, prediction UX, `UInventoryViewModel` UMG binding, save-delta persistence, pickup-system handoff.

## Output

A wave run using this skill delivers: `UInventoryComponent` + `UDA_ItemDefinition` + `FInventoryEntry` (C++, committed to `systems.json` as `systems_surface[]` entries of type `component`, `data-asset`, and `struct`); at least one configured container instance (e.g. `BP_PlayerCharacter`'s inventory, or `BP_Chest`); and a `UInventoryViewModel` consumed by `eng-ui`. Proven by a Functional Test named `<Project>.Inventory.Transfer.ServerAuthoritative` — spawns two `UInventoryComponent`s, attempts a transfer that exceeds capacity, and asserts the server rejects it while a valid transfer replicates the resulting stack counts to both owners' `OnInventoryChanged` delegates.
