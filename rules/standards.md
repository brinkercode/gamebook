# Development Standards

> These rules apply to EVERY task. No exceptions.

## Architecture

- **Subsystems over singletons** — use `UGameInstanceSubsystem`, `UWorldSubsystem`, or `ULocalPlayerSubsystem` for shared state. Never `GetGameInstance()->Cast<UMyGameInstance>()` to reach a one-off field. Subsystem lifecycle is managed by the engine and is testable.
- **Data-driven systems** — designers configure systems via `UPrimaryDataAsset` and `UDataTable`. Programmers write systems; designers set numbers. Hard-coded gameplay constants in C++ are a bug.
- **Thin Blueprints** — Blueprint classes that own significant logic are tech debt. BP is for wiring and content; C++ is for systems. If a Blueprint function body exceeds 20 nodes, extract it to a C++ `BlueprintCallable` function.
- **GAS for all abilities** — every active player/enemy capability uses `UGameplayAbility` + `UGameplayEffect` + `UAttributeSet`. Never build a parallel ability system with custom damage floats and boolean state.
- **Enhanced Input for all player input** — no direct `BindAxis`/`BindAction` calls on `InputComponent`. No legacy input bindings in `Project Settings > Input`.
- **File-based agent handoffs** — `.claude/handoffs/systems.json` is the contract between `gameplay-systems-engineer` and `blueprint-feature-builder`. Never proceed with Blueprint content work before `systems.json` exists and has `"status": "ready"`.

## C++

- **Interfaces in C++** — `UInterface`-derived types with `UINTERFACE()`. Pure C++ interfaces that UE reflection doesn't know about cannot be `Cast<>` to.
- **One class per header** — no header should define more than one `UCLASS`, `USTRUCT`, or `UENUM` unless they are tightly coupled value types (e.g., a component and its config struct).
- **No raw `new` or `delete`** — use `NewObject<T>`, `SpawnActor<T>`, `TSharedPtr<>`, `TUniquePtr<>`, or `MakeShared<>`. Raw heap allocation skips UE's GC and allocation tracking.
- **`UPROPERTY` on every UObject pointer** — unregistered raw `UObject*` pointers are invisible to the GC and will dangling-pointer crash on collection. No exceptions.

## Blueprints

- **Logic in C++, wiring in BP** — BP calls `BlueprintCallable` functions; it does not implement significant logic inline.
- **No Blueprint-only game systems** — gameplay abilities, attribute math, save/load serialization, input binding, networking — these are C++ domains. BP can call into them.
- **Widget Blueprints via `IUserObjectListEntry` or viewmodel binding** — never reach into a widget from another actor to set state directly. Widgets are reactive, not imperative.

## GAS

- **`GameplayTag` for all state flags** — never `bool bIsStunned`, `bool bIsAiming`. Use `FGameplayTagContainer` queries via the `UAbilitySystemComponent`. Tags are replicatable, debuggable, and addable without recompiling.
- **`UGameplayEffect` for all attribute modification** — never `MyAttributeSet->Health -= Damage`. All attribute writes go through `ApplyGameplayEffectToSelf` or `ApplyGameplayEffectToTarget`.
- **Predict client-side, validate server-side** — abilities that move the player or deal damage must use prediction keys so the client doesn't wait for a round trip before visual feedback.

## Replication (when multiplayer is enabled)

- **All gameplay state is server-authoritative** — clients display, server decides. Never trust a client-supplied damage or position value.
- **`HasAuthority()` before every state mutation** — check `GetLocalRole() == ROLE_Authority` in any code path that modifies replicated state.
- **Replication Graph is opt-in but configured at project start** — if the scaffolder sets `multiplayer: true`, the `AReplicationGraphNode_ActorList` grid node is set up from day one. Retrofitting Replication Graph to an existing project is painful.

## Performance

- **60 FPS on GTX 1060** is the vertical-slice baseline. Nanite and Lumen are off by default. Every frame budget decision starts from this constraint.
- **Profile before optimizing** — `stat unit`, `stat game`, `stat gpu`, Unreal Insights trace. Never "fix" perceived slowness without profiler data.
- **No Tick unless necessary** — `SetComponentTickEnabled(false)` at construction, enable only when the component is active. Idle ticks are a budget tax.

## Save / Load

- **`USaveGame` subclasses only** — no flat file I/O, no `FArchive` directly in actors, no `PlayerPrefs`-style hacks. Save slots map to encrypted files via the async `AsyncSaveGameToSlot` / `AsyncLoadGameFromSlot` API.
- **Never trust save data without validation** — a corrupted or tampered save file must degrade gracefully, not crash.

## Audio

- **Wwise events, not UE sound cues in gameplay code** — `UAkGameplayStatics::PostEvent` for one-shots, `UAkComponent::PostAssociatedAkEvent` for attached looping audio. MetaSounds is the fallback when Wwise is not set up on the project.
- **No raw `PlaySound2D` calls in gameplay C++** — route through a `UAudioSubsystem` or a Wwise abstraction so sounds can be globally mocked in automation.

## Quality

- **Functions do one thing** — if described with "and", split it.
- **Small functions (<40 lines in C++), small files (<500 lines).** Files approaching the limit should be split by responsibility.
- **Naming over comments** — `ActivatePrimaryFire()` is better than `void Shoot() // fires the primary weapon`.
- **Delete dead code** — don't comment it out. Git has history.
- **Regression test every crash fix** — add a Functional Test or Gauntlet spec that exercises the repro path.

## Documentation

- **Update `docs/GAMEPLAY_SYSTEMS.md` when adding a GAS ability, attribute, or subsystem** — `blueprint-feature-builder` reads this before touching content.
- **`project.config.json` is the single source of truth for stack choices** — multiplayer, audio backend, save encryption key length, monetization flag. Agents read it; never hard-code stack assumptions.

## What Claude Must Never Do

- **Never commit to git** — provide a commit message, never execute `git commit`.
- **Never run Unreal Editor in non-headless mode** — use `-unattended -nullrhi` flags for automation/cook tasks.
- **Never run `cook` or `package` against a production Steam AppID** — development only, unless explicitly authorized.
- **Never hardcode secrets** — no API keys, Steam dev tokens, or EOS client secrets in source. All credentials come from environment variables or the platform's secrets manager.
- **Never modify `.uasset` or `.umap` files as text** — binary Unreal assets corrupt silently. BP changes go through the editor or the generated C++ surface.
