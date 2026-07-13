---
name: building-system
description: Use when a wave needs player base-building on generated terrain — a placement component with ghost preview, surface validation against the procgen heightmap (slope/water/region rules), snap-grid/socket-snapping for modular pieces (walls/floors/roofs), and build plots as the local-destructibility answer (flatten/dig without global voxels). Invoke when the design brief says "building", "base-building", "placement system", "modular construction", "build plot", or when settlement-population needs structure counts or a production-chains station needs to exist as a placed building. Reach for it from a feature wave's eng-gameplay or design-technical role. Skip for pure inventory/pickup placement (use `interaction-system`/`pickup-system`) and for terrain generation itself (use `procgen-world`).
version: "1.0.0"
---

# Building System

> Structural pieces as Data Assets (cost, footprint, snap sockets). A placement component previews a ghost mesh, validates the candidate transform against the procgen heightmap and region rules, and snaps to a build grid or neighboring sockets. Confirmed placements write to the world as a delta — persisted, replicated, and locally destructible via build plots, never a global voxel grid.

## When to use

Invoke for any feature where the player places structures on the world: foundations, walls, roofs, fences, production stations, decorative pieces. One structure *family* per invocation (e.g. "wood tier" vs "stone tier" are separate `DA_Structure` sets sharing the same component). Escalate to `/ship` (feature wave) when this is the first placement pass on a project (new `UBuildPlacementComponent` + snap-socket schema + delta-log integration is multi-surface) or when introducing build plots for the first time. Use `/fix` for adding one new structural piece to an existing placement system. Skip entirely if the project has no player construction — use `design-level` for hand-placed level geometry instead.

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Structure data** — author `DA_Structure_<Piece>` (`UPrimaryDataAsset`): mesh, footprint (bounding shape), inventory cost, snap sockets, build-plot requirement flag. See `resources/structures-persistence.md#structure-data`.
2. **Placement component** — `UBuildPlacementComponent` on the player pawn drives a ghost-preview actor, traces against the heightmap/collision, and offers a valid/invalid transform each tick while active. See `resources/placement-validation.md#component`.
3. **Surface validation** — reject placement on slope beyond threshold, underwater, or outside the structure's allowed region tags (queried from `UWorldGenSubsystem`, per `[[procgen-world]]`). See `resources/placement-validation.md#surface-rules`.
4. **Snap resolution** — grid snap for freeform footprints, socket snap (`FSnapSocket` on adjacent placed structures) for modular walls/floors/roofs; socket match takes priority over grid. See `resources/placement-validation.md#snapping`.
5. **Build plots (local destructibility)** — a structure that needs terrain edits (foundation leveling, cellar dig) claims a bounded `ABuildPlot` volume; flatten/dig operations only mutate within that plot's local heightmap patch, never the global terrain array. See `resources/structures-persistence.md#build-plots`.
6. **Confirm & persist** — on confirm, spawn the real actor server-side, append a placement delta to the world's delta log (`[[procgen-world]]` convention), and replicate the spawned actor normally — the delta log is truth, the actor is a replay of it. See `resources/structures-persistence.md#persistence`.
7. **Ownership/permission** — every placed structure carries `Owner.Player.<ID>` / `Owner.Settlement.<ID>` tags plus a permission tag (`Build.Permission.Public`, `Build.Permission.Owner`, `Build.Permission.Allied`) checked server-side before edit/demolish. See `resources/structures-persistence.md#ownership`.

## UE5 context

- Modules affected: `Source/<Project>/Public/Building/` (`UBuildPlacementComponent`, `ABuildPlot`, `AStructureBase`), `Source/<Project>/Public/Data/` (`UDA_Structure`), `Source/<Project>Tests/` (placement + persistence Functional Tests).
- Asset paths: `Content/Building/DA_Structure_<Piece>.uasset`, `Content/Building/BP_Structure_<Piece>.uasset`, `Content/Building/BP_GhostPreview.uasset`.
- Config files: `Config/DefaultGameplayTags.ini` (`Owner.*`, `Build.Permission.*`, `Structure.RequiresPlot`).

## Resources (read on demand)

- `resources/placement-validation.md` — `UBuildPlacementComponent` implementation, heightmap/slope/water/region validation against `UWorldGenSubsystem`, grid-snap and socket-snap (`FSnapSocket`) resolution, ghost-preview material feedback (valid/invalid).
- `resources/structures-persistence.md` — `UDA_Structure` schema, `ABuildPlot` local flatten/dig, delta-log placement/demolish entries, ownership/permission tags, replication of spawned structures, integration notes for settlement-population (structure counts) and production-chains (stations as buildings).

## Rules

- Placement is proposed client-side (ghost preview only); the actual spawn, cost deduction, and delta-log write are server-authoritative — the client never trusts its own ghost as a placed result. Cross-reference `[[procgen-world]]` for the delta-log convention this must follow.
- Never mutate the global heightmap array for a build edit. Local terrain changes (leveling, digging) are scoped to an `ABuildPlot`'s own patch — this is the project's answer to "can players dig," not a voxel engine.
- Snap sockets and grid resolution are deterministic given the same candidate transform and neighboring structures — no per-frame randomness in placement math.
- Structure inventory cost is data (`UDA_Structure`), never hardcoded per-piece in the placement component.
- Demolish/edit requires a server-side permission check against the structure's `Owner.*`/`Build.Permission.*` tags before the delta-log entry is written.

## Output

A wave using this skill delivers: `UBuildPlacementComponent` (C++, ghost preview + validation + snap), `ABuildPlot` (C++, local flatten/dig), `AStructureBase` (C++ base for placed pieces), one or more `DA_Structure_<Piece>` Data Assets (+ `BP_Structure_<Piece>` content wrappers), and delta-log placement/demolish entries wired into the project's `[[procgen-world]]` save schema. `systems_surface[]` entries: `type: "component"` for `UBuildPlacementComponent`, `type: "actor"` for `ABuildPlot` and `AStructureBase`, `type: "data"` for `UDA_Structure` — `eng-gameplay` exposes the C++ classes and validation API; `design-technical` wires the Data Assets, snap-socket layouts, and `Owner.*`/`Build.Permission.*` tags into `Config/DefaultGameplayTags.ini`. Proven by a Functional Test named `<Project>.Building.<Piece>.PlacementValidatesAndPersists` that attempts placement on invalid terrain (expects rejection), then valid terrain (expects spawn + delta-log entry), reloads the level from the delta log, and asserts the structure reconstructs at the same transform. Cross-reference `[[settlement-population]]` (counts placed structures toward settlement tier) and `[[crafting-system]]`'s station pattern (a production-chains station is an `AStructureBase` subclass with `WorkSlots[]`, not a separate placement path).
