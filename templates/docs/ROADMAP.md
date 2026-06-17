# Roadmap

> Milestone targets for {{PROJECT_NAME}} vertical slice (6–12 month scope).

## Milestone 0 — Scaffold

_Target: week 1_

- [ ] `project-scaffolder` run: `project.config.json` complete
- [ ] Makefile verified: `make build` green on all team machines
- [ ] Git LFS configured: `.gitattributes` covers `*.uasset`, `*.umap`, `*.ubulk`, `*.uexp`, `*.upk`
- [ ] Smoke test level `LT_SmokeCook` created: `make cook-smoke` green
- [ ] Placeholder character with Enhanced Input functional

## Milestone 1 — Core Loop Alpha

_Target: week 4–6_

**Must have:**
- [ ] Player movement + sprint + jump (GAS + Enhanced Input)
- [ ] Primary weapon: hitscan fire with Data Asset tuning
- [ ] Health / stamina attribute set + HUD display
- [ ] One enemy type with Behavior Tree
- [ ] One encounter (3–5 enemies) with `DT_Encounters` row
- [ ] Save / load round-trip (position + health)

**Should have:**
- [ ] Secondary weapon slot
- [ ] Ammo system
- [ ] Footstep audio via `UAudioStateSubsystem`

**Gate:** `make gate` + 30-minute manual playtest with no BLOCKER findings.

## Milestone 2 — Content Pass

_Target: week 8–10_

**Must have:**
- [ ] First full level (art pass, not blockout)
- [ ] 3 enemy archetypes
- [ ] Boss encounter
- [ ] 3 audio logs (narrative)
- [ ] Store UI shell + one purchasable cosmetic item

**Should have:**
- [ ] Adaptive music via Wwise
- [ ] Niagara VFX on all abilities and weapon impacts
- [ ] Input rebinding with persistence

**Gate:** `make gauntlet-critical` (60 FPS p95 on target hardware).

## Milestone 3 — Vertical Slice

_Target: week 12–16_

**Must have:**
- [ ] All Act 1 encounters complete and balanced
- [ ] Full narrative pass (dialogue + audio logs + subtitles)
- [ ] Platform submission build (Steam / EOS Ecom wired)
- [ ] All `@critical` Functional Tests green
- [ ] Performance budgets met on GTX 1060 target hardware
- [ ] Localization ready (strings extracted to loc table)

**Gate:** `make package-shipping` green + external playtest with ≥ 5 testers + no BLOCKER findings.

## Post-Slice Backlog

_(ideas deferred until vertical slice ships — add freely)_

- Lumen / Nanite evaluation pass
- Multiplayer (dedicated server + Replication Graph)
- Console platform ports
- Additional levels / acts
- Seasonal store catalog
