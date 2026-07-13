# Crash & Bug Response

> Crash triage, callstack reading, repro capture, and hotfix process for UE5 FPS. Replaces generic incident-response for game development.

---

## Severity Classification

| Severity | Definition | Response |
|----------|-----------|----------|
| **P0 — Crash / Data loss** | Hard crash or save corruption in any shipping build path | Same session — drop everything |
| **P1 — Blocker** | Feature completely non-functional; crash reproducible in playtests | Same day |
| **P2 — Significant** | Feature broken in a specific case; workaround exists | Within 2 days |
| **P3 — Polish / Minor** | Visual glitch, minor behavior deviation, edge-case jank | Next sprint |

A crash that loses a player's save is P0 even if infrequent.

---

## Crash Report Uploader

UE5 includes a built-in Crash Report Client (`CrashReportClient.exe`). Configure it in `Config/DefaultEngine.ini`:

```ini
[CrashReportClient]
CrashReportClientVersion=1.0
DataRouterUrl=https://your-crash-backend.example.com/api/crashes
bSendUnattended=true
bImplicitSend=false         ; Player is prompted before sending
UserComment=                ; Pre-populated comment (leave blank, let player fill)
```

Crash reports include:
- Minidump (`.dmp`) — full callstack + registers at crash point
- Log (`MyGame.log`) — full session log up to the crash
- Machine info (GPU, OS, driver version)
- `CrashContext.runtime-xml` — engine version, changelist, module list

**Test the uploader in every shipping build before external playtests.** A crash report that never arrives is worse than no crash reporting.

For small indie teams without a backend: use Epic's hosted crash report receiver (linked in UE documentation) or forward `.dmp` files via email/Sentry.

---

## Callstack Triage

### Reading a UE5 crash log

```
# Typical UE5 crash log excerpt (from MyGame.log)
Fatal error!

Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000008

[Callstack]
0x00007ff6b2a3e1c2 MyGame-Win64-Shipping.exe!UGA_WeaponFire::ActivateAbility() [D:/Build/Source/MyGame/GAS/Abilities/GA_WeaponFire.cpp:87]
0x00007ff6b28f4a10 MyGame-Win64-Shipping.exe!UAbilitySystemComponent::TryActivateAbility() [...]
0x00007ff6b1c22398 MyGame-Win64-Shipping.exe!AHeroCharacter::Input_Fire_Started() [D:/Build/Source/MyGame/Characters/HeroCharacter.cpp:142]
```

**What to look for:**

1. The topmost frame with your project's source file — that's where the crash happened.
2. `EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000008` → null pointer dereference on an 8-byte-offset member. The object was null or already garbage-collected.
3. `EXCEPTION_ACCESS_VIOLATION writing address` → writing to freed memory (use-after-free).
4. `Stack overflow` → infinite recursion. Check GAS ability activation loops.
5. `Pure virtual function call` → UObject subclass method called after `BeginDestroy`.

### Symbol resolution

Shipping builds strip symbols by default. To get readable callstacks:
- Enable **generate debug info** in `Config/DefaultGame.ini` or project packaging settings: `bGenerateSymbols = true`.
- Store `.pdb` / `.sym` files alongside each build in an internal symbol server (or just an S3 bucket keyed by changelist).
- Use WinDbg or the UE crash report tools with symbol paths set to your S3/local directory.

```powershell
# Resolve a minidump locally (Windows)
& "C:\Program Files\Debugging Tools for Windows (x64)\cdb.exe" `
  -z path/to/MyGame.dmp `
  -sympath "SRV*C:\Symbols*https://your-symbol-store.example.com" `
  -c ".ecxr; k; q"
```

---

## Repro Capture

Before attempting a fix, capture a reproducible case. A bug without a repro is a guess.

### In-editor repro

1. Identify the last action sequence before the crash from `MyGame.log` (every `UE_LOG` call is timestamped).
2. Reproduce in PIE with `Log Verbosity: Verbose` and the relevant log category enabled.
3. If the crash only happens in shipping: reproduce in `-DebugGame` build — full symbols, all `check()` / `ensure()` macros active.

### `ensure()` vs `check()` — know the difference

```cpp
// ensure() — logs a callstack and continues. Use for "this should not happen but we can recover."
ensure(WeaponComponent != nullptr);

// check() — crashes immediately. Use for "this invariant MUST hold or the game state is corrupt."
check(AbilitySystemComponent != nullptr);
checkf(DamageEffect != nullptr, TEXT("GA_WeaponFire: DamageEffect is not set on CDO — asset misconfigured"));
```

In DebugGame builds, `ensure()` failures print to the log with a full callstack. Review ensures regularly — an ensure that fires every session is a bug, not a warning.

### Repro document template

```markdown
## Bug: [Short description]
**Severity:** P0 / P1 / P2 / P3
**Build:** [Changelist or version tag]
**Platform:** PC Win64 / PS5 / Steam Deck

### Repro steps
1. [Exact starting state]
2. [Action 1]
3. [Action 2]
4. Crash / incorrect behavior occurs

### Expected
[What should have happened]

### Actual
[What happened — include log excerpt or callstack]

### Attachments
- [ ] MyGame.log
- [ ] CrashDump.dmp
- [ ] Screenshot or OBS clip
```

---

## Common UE5 Crash Patterns and Fixes

| Crash pattern | Root cause | Fix |
|---|---|---|
| Null ptr on GAS component | `GetAbilitySystemComponent()` called before `InitAbilityActorInfo` | Always call `InitAbilityActorInfo` in `PossessedBy` (server) and `OnRep_PlayerState` (client) |
| Crash after level transition | `TWeakObjectPtr` pointing to destroyed actor from previous level | Use `IsValid()` guard before deref; prefer Subsystems for cross-level state |
| `check` fail in `EndAbility` | `EndAbility` called twice (duplicate call path) | Add `if (IsActive())` guard before calling `EndAbility` |
| Crash in `PostGameplayEffectExecute` | Accessing attribute not owned by the ASC on this actor | Validate the attribute belongs to this `UAttributeSet` instance |
| Crash on save load | Deserialized object reference no longer valid (class removed or renamed) | Version your `USaveGame` structs; add `FArchive` version guards |
| Stack overflow in ability task | Ability task activates the same ability in a loop | Tag-gate with `ActivationBlockedTags` and verify no re-entry path |
| Crash in UMG widget | Widget accessing gameplay object after level unload | Widgets must hold `TWeakObjectPtr<>` to actors/components, never raw `UPROPERTY` object refs that outlive GC |

---

## Hotfix Process

For P0 and P1 bugs that need to ship before the next regular build.

### 1. Branch from the released changelist

```bash
git checkout tags/build-v0.4.2   # Or the shipped commit SHA
git checkout -b hotfix/crash-ga-weaponfire-null-asc
```

Hotfix from the exact shipped revision, not from main. Main may have unverified work.

### 2. Fix + regression test

Write a Functional Test tagged `@regression` that reproduces the crash before your fix:

```cpp
/**
 * @regression GH-412
 * Verifies: activating GA_WeaponFire when ASC is not yet initialized does not crash.
 */
UCLASS()
class AFT_WeaponFire_NullASC_NoCrash : public AFunctionalTest { ... };
```

Watch it fail (crash or `check` violation) without the fix. Apply the fix. Watch it pass.

### 3. Expedited review

- One reviewer from `eng-gameplay` or `eng-director` — not full `/ship` pipeline.
- Review scope: does the fix work, does it introduce a regression, is the regression test adequate.
- No Phase 1–4 orchestration. Direct commit to hotfix branch.

### 4. Cherry-pick to main

```bash
git checkout main
git cherry-pick hotfix/crash-ga-weaponfire-null-asc
# Verify regression test still passes on main
make automation-critical
```

Never merge hotfix → main without running `make automation-critical`. Hotfixes frequently clash with in-progress work.

### 5. Build and ship

See [agents/eng-build guidance] for cook and Steam upload. Hotfix builds skip Gauntlet perf scenarios — `make cook-smoke` + `make automation-critical` only.

---

## Post-Crash Post-Mortem

Required for every P0. Optional but encouraged for repeat P1s.

```markdown
# Post-Mortem: [Crash title]

**Date:** YYYY-MM-DD
**Severity:** P0
**Build affected:** [version tag]
**Players impacted:** [approximate count from crash reporter]

## What happened
[2-3 sentences: trigger, callstack, player impact]

## Timeline
| Time | Event |
|------|-------|
| HH:MM | First crash report received |
| HH:MM | Root cause identified |
| HH:MM | Hotfix deployed |

## Root cause
[The specific code path, GAS state, or asset configuration that caused it]

## Fix
[PR / commit link and one-line description]

## Regression test
[FT_ test name and tag]

## Why it wasn't caught earlier
[Functional test gap? Only triggered by specific gameplay sequence? Platform-specific?]

## Action items
| Action | Owner | Due |
|--------|-------|-----|
| [Preventive measure] | | |
| [Test coverage gap] | | |
```

---

## Bug Tracker Workflow

Gamebook does not prescribe a specific tracker. Use whatever the team already has (GitHub Issues, Linear, Notion). Required fields for every bug:

- Severity (P0–P3)
- Build / changelist where it was found
- Platform
- Repro steps (use the template above)
- Assignee from the agent roster (or human dev)
- Regression test link once fixed

P0 bugs skip the tracker queue and are handled directly in the dev channel. Everything else goes through normal triage.
