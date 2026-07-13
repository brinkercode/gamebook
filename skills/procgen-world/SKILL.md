---
name: procgen-world
description: Use when a project needs seed-generated open-world terrain — survival/crafting/civilization games, or any world that must regenerate deterministically from a 64-bit seed instead of storing baked terrain. Invoke when the user says "generate the world from a seed", "add procedural terrain", "region/biome generation", "chunk streaming", or when eng-gameplay needs a UWorldGenSubsystem. Skip for hand-authored single levels with no regeneration requirement — use level-streaming instead.
version: "1.0.0"
---

# Procgen World

> The world is a pure function of a 64-bit seed. Nothing about terrain is ever saved — only the seed and an ordered log of player-caused deltas. `UWorldGenSubsystem` owns generation; region graph → noise → biome → feature placement runs coarse-to-fine, per-chunk, with independent `FRandomStream`s so any chunk regenerates identically regardless of order or machine.

## When to use

Invoke for any world where terrain must be deterministic, replayable, or too large to hand-place — survival/crafting bases, civilization/economy layers (Anno-style resource scarcity), or streaming open worlds. Escalate to `/ship` when this is the first world-gen pass on a project (new `UWorldGenSubsystem` + region graph + save schema is multi-surface). Use `/fix` for a single noise-layer tweak or a new biome entry in an existing table. Skip entirely if the level is small, fully hand-authored, and never needs regeneration — plain `level-streaming` covers that.

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Seed discipline** — one `int64` world seed, never `FMath::Rand`, never a single global `FRandomStream`. Every generation call derives its own stream via `Hash(Seed, ChunkX, ChunkY, LayerID)`. See `resources/seed-discipline.md`.
2. **Region graph (km scale, first)** — partition the world into regions before any noise runs; assign biome + resource/fertility profile per region with deliberate scarcity (no region is self-sufficient). See `resources/region-graph.md`.
3. **Layered chunk pipeline (coarse → fine)** — elevation/moisture/temperature noise (FastNoiseLite/FastNoise2) → Whittaker biome lookup → Poisson-disc feature placement, all seeded per-chunk so chunks generate independently and in parallel. See `resources/chunk-pipeline.md`.
4. **Heightmap-vs-voxel fork** — default to heightmap + local destructible actors; only fork to full voxel + mesher when the design genuinely needs arbitrary excavation, and re-budget perf. See `resources/chunk-pipeline.md#fork`.
5. **Delta saves** — persist `{seed, region_graph_hash, delta_log[]}` in an encrypted `USaveGame`; on load, regenerate the world from the seed and replay deltas in order. Multiplayer: server sends the seed once, then replicates only deltas. See `resources/delta-saves.md`.
6. **Determinism test** — a Functional Test generates the same seed twice (same region graph + same chunk set) and compares a world hash; CI fails on mismatch.
7. **Lighting exception** — procgen terrain cannot use baked lightmaps (nothing is static at cook time). Record `perf.dynamic_lighting = true` in `project.config.json` and use Lumen or a dynamic-only fallback for this project's world level.

## UE5 context

- Modules affected: `Source/<Project>/Public/WorldGen/` (subsystem, region graph, chunk generator), `Source/<Project>/Public/Save/` (delta log save class), `Source/<Project>Tests/` (determinism Functional Test).
- Asset paths: `Content/WorldGen/` (biome Data Assets, feature Data Tables), `Content/WorldGen/BP_Feature_*` (spawned feature actors).
- Config files: `Config/DefaultGame.ini` (world seed default / debug override), `project.config.json` (`perf.dynamic_lighting`, `worldgen.mode` = heightmap|voxel).
- Plugin baseline: bundle **FastNoise2** (or FastNoiseLite as a header-only vendor drop) under `Plugins/` — not an engine-default plugin, add it explicitly during scaffolding.

## Rules

- Never `FMath::Rand`/`FMath::RandRange` anywhere in world-gen code. Never a single shared `FRandomStream` reused across chunks or layers — see `resources/seed-discipline.md` for the hashing scheme.
- Terrain height/biome/features are never stored per-tile in a save file. Only the seed and the delta log are persisted — see `resources/delta-saves.md`.
- Region assignment always runs before noise. A chunk never decides its own biome from local noise alone — it looks up its region's profile first (this is what keeps Anno-style trade pressure real).
- Server-authoritative: in multiplayer, the client never generates gameplay-affecting deltas locally and trusts them — the server seed and delta log are the source of truth (cross-reference `[[save-system]]` for the underlying `USaveGame`/encryption pattern this build on).
- Crafting/building placement that mutates the world (foundations, mining) writes through the delta log, not directly onto a runtime heightmap array — cross-reference `[[crafting-system]]` for the placement-validation side of that write.

## Resources (read on demand)

- `resources/seed-discipline.md` — `FRandomStream` hashing scheme, banned APIs, per-layer stream derivation code.
- `resources/region-graph.md` — km-scale region graph construction, biome/resource profile assignment, deliberate scarcity rules.
- `resources/chunk-pipeline.md` — noise layers, Whittaker biome lookup, Poisson-disc feature placement, heightmap-vs-voxel fork guidance.
- `resources/delta-saves.md` — delta log schema, encrypted `USaveGame`, regenerate-and-replay on load, multiplayer seed/delta replication.

## Output

A `UWorldGenSubsystem` (C++, `UGameInstanceSubsystem` or `UWorldSubsystem` depending on whether generation must survive level transitions) exposing a seed API, region query, chunk request, and delta store — with the `systems_surface[]` entries below written to `.claude/handoffs/systems.json` for `design-technical`/`design-level` to consume, and `design-technical` to wire biome/feature Data Assets against. Proven by `<Project>.WorldGen.Determinism.SameSeedSameHash` — a Functional Test that generates a seed twice and asserts the world hash matches, gating `make automation-critical`.
