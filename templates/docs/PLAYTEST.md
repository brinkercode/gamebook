# Playtest

> Functional Test specs, Gauntlet configs, manual playtest scripts, and feedback tracking for {{PROJECT_NAME}}.

## Test Architecture

| Layer | Tool | Location | Runs in |
|---|---|---|---|
| Unit (C++) | `FAutomationTestBase` | `Source/{{PROJECT_NAME}}Tests/` | `make automation-critical` |
| Functional (Blueprint + C++) | `AAutomationUtilsAutomationTestBase` / `FGameAutomationTest` | `Content/Tests/Functional/` | `make automation-critical` |
| Stress / perf | Gauntlet | `Source/{{PROJECT_NAME}}Tests/Gauntlet/` | `make gauntlet-critical` |
| Manual | Playtest scripts (this doc) | — | Human tester |

## Critical Tag (@critical)

Tests tagged `@critical` (via `ADD_TEST_META(EAutomationTestFlags::CriticalPriority)`) run in every PR gate.
Total budget: ≤ 60 s. If a test exceeds its budget, move it to `@regression`.

## Functional Test Specs

Each spec lives in `Content/Tests/Functional/` as a `AFunctionalTest` Blueprint subclass.
Naming: `FT_<SystemName>_<Scenario>`.

| Test | Tags | Passes when |
|---|---|---|
| `FT_PlayerSpawn_Default` | `@critical` | Player pawn spawns at `PlayerStart` with full health |
| `FT_Ability_Sprint_Activate` | `@critical` | `UGA_Sprint` activates, stamina decreases, tag `Status.Sprinting` applied |
| `FT_Ability_PrimaryFire_HitEnemy` | `@critical` | Projectile/hitscan from `IA_PrimaryFire` registers damage on `BP_Enemy_Grunt` |
| `FT_SaveLoad_RoundTrip` | `@critical` | Save to slot → load → player position + inventory matches |
| `FT_Encounter_VictoryCondition` | `@regression` | Encounter completes after all enemies defeated; `OnEncounterComplete` fires |

_(add rows as features are added)_

## Gauntlet Stress Tests

| Test | Tags | Scenario |
|---|---|---|
| `ProjGauntletTest_60FPS_Encounter` | `@critical` | 5-minute encounter at max enemy budget; assert ≥ 55 FPS p95 |
| `ProjGauntletTest_MemLeak_Session` | `@regression` | 30-minute session; assert no unbounded memory growth |

Config: `Source/{{PROJECT_NAME}}Tests/Gauntlet/ProjGauntletTests.ini`

## Manual Playtest Script — Vertical Slice

Run before each milestone build. One tester, approximately 45 minutes.

### Session setup
- [ ] Fresh install from `make package-dev` output
- [ ] No editor running (test standalone)
- [ ] Note frame rate with `stat fps` at key checkpoints

### Flow
1. **Main menu** — launch, confirm audio, confirm FPS ≥ 60 at idle
2. **Tutorial** — complete tutorial encounter without guidance; note friction points
3. **Core loop** — play 3 encounters in Act 1; measure TTK, feel of abilities
4. **Death + respawn** — intentionally die; confirm respawn state is correct
5. **Save / quit / reload** — save mid-level, quit to desktop, relaunch, load — verify state preserved
6. **Audio log** — collect 1 audio log; confirm codex entry appears in `WB_AudioLog_Codex`
7. **Pause / resume** — pause in combat; confirm audio ducks correctly; resume
8. **Settings** — change keybind, audio volume; verify persists after restart

### Checkpoints

| Checkpoint | Min FPS | Notes |
|---|---|---|
| Main menu | 60 | |
| Tutorial (low density) | 60 | |
| Act 1 encounter (max enemies) | 55 | Brief dips acceptable |
| Boss encounter | 50 | Budget stretch for vertical slice |

## Feedback Tracking

Log all playtest findings in `docs/PLAYTEST_LOG.md` (per-session file, not version-controlled).
Format: `[BLOCKER|MAJOR|MINOR|NOTE] <description> — reported by <tester> — repro steps`.

Blockers ship-stop. Majors fix before next milestone. Minors backlog.
