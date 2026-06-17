---
paths:
  - "Source/**/*.h"
  - "Source/**/*.cpp"
---

# UE5 Replication Rules

> These rules apply only when `multiplayer: true` in `project.config.json`. Single-player projects skip this file.

## Roles and authority

```cpp
// Check before mutating replicated state
if (GetLocalRole() == ROLE_Authority)
{
    CurrentHealth -= DamageAmount;
}

// Actor helper — same as above
if (HasAuthority())
{
    CurrentHealth -= DamageAmount;
}

// Check on a component
if (GetOwner()->HasAuthority())
{
    bIsActive = true;
}
```

- **`HasAuthority()` before every replicated state mutation** — without it, clients overwrite server state and desync.
- **`IsLocallyControlled()` for client-only cosmetics** — camera shake, local sound, screen effects. These should not RPC to the server.
- **`GetNetMode() == NM_Client`** is rarely the right check — prefer role-based checks. `NM_Client` is only for listen-server vs dedicated server distinctions.

## Replicating properties

```cpp
// In the .h
UPROPERTY(Replicated)
int32 AmmoCount;

UPROPERTY(ReplicatedUsing=OnRep_Health)
float CurrentHealth;

// Required boilerplate in .cpp
void AMyCharacter::GetLifetimeReplicatedProps(
    TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    DOREPLIFETIME(AMyCharacter, AmmoCount);
    DOREPLIFETIME_CONDITION(AMyCharacter, CurrentHealth, COND_OwnerOnly);
}

UFUNCTION()
void AMyCharacter::OnRep_Health(float OldHealth)
{
    // Update HUD, play hurt animation — cosmetics only
}
```

- **`GetLifetimeReplicatedProps` is mandatory** — UE will not replicate the property without it, even with `UPROPERTY(Replicated)`.
- **Use `DOREPLIFETIME_CONDITION` to narrow replication scope** — common conditions:
  - `COND_OwnerOnly` — only the owning client (ammo, stamina, local HP)
  - `COND_SkipOwner` — all clients except the owner (third-person anim state)
  - `COND_SimulatedOnly` — simulated proxies only
  - `COND_InitialOnly` — sent once on connection (spawn data)
- **`OnRep_` callbacks are cosmetic only** — don't apply gameplay logic in `OnRep_`. The authoritative state already changed on the server; the callback updates the visual representation.

## RPC types

| Macro | Direction | Use |
|---|---|---|
| `UFUNCTION(Server, Reliable)` | Client → Server | Player input requests, ability activation requests |
| `UFUNCTION(Server, Unreliable)` | Client → Server | High-frequency updates where loss is acceptable (rarely correct) |
| `UFUNCTION(Client, Reliable)` | Server → Owner | Targeted feedback: hit confirmation, death, respawn |
| `UFUNCTION(Client, Unreliable)` | Server → Owner | Cosmetic owner-only effects |
| `UFUNCTION(NetMulticast, Reliable)` | Server → All | Critical events all clients must see: game over, level transition |
| `UFUNCTION(NetMulticast, Unreliable)` | Server → All | Cosmetic effects: particles, sounds, hit reactions |

```cpp
// Declaration in .h
UFUNCTION(Server, Reliable, WithValidation)
void ServerFireWeapon(const FVector& AimOrigin, const FVector& AimDirection);

// Implementation in .cpp — note the _Implementation and _Validate suffixes
bool AMyCharacter::ServerFireWeapon_Validate(
    const FVector& AimOrigin, const FVector& AimDirection)
{
    // Return false to kick the client for cheating
    return AimDirection.IsNormalized() && !AimOrigin.ContainsNaN();
}

void AMyCharacter::ServerFireWeapon_Implementation(
    const FVector& AimOrigin, const FVector& AimDirection)
{
    if (!HasAuthority()) { return; }
    // Authoritative fire logic
}
```

- **`WithValidation` on every Server RPC** — provides a `_Validate` function. Return `false` to disconnect the offending client. Never trust client-supplied positions, directions, or damage values without validation.
- **Never send sensitive game state in Server RPCs as parameters** — health remaining, score, item IDs. The server already knows those; the client is requesting an action, not reporting state.
- **`Reliable` only when loss is unacceptable** — ability activation, death, respawn, purchase. Never `Reliable` for cosmetics (VFX, sounds) — they degrade gracefully when dropped.
- **Batch one-off data into `Replicated` properties instead of RPCs** — if you need to sync a float on respawn, use a `UPROPERTY(Replicated)` that changes on the server. RPCs are for events, not state.

## Actor replication setup

```cpp
// In constructor
AMyProjectile::AMyProjectile()
{
    bReplicates = true;
    bReplicateMovement = true;   // Only if movement is not driven by CharacterMovementComponent
    NetUpdateFrequency = 60.f;
    MinNetUpdateFrequency = 20.f;
    NetPriority = 2.f;
}
```

- **`bReplicates = true` in the constructor** — not in `BeginPlay`. Setting it after the actor is spawned on a client has no effect.
- **`NetUpdateFrequency`** — lower for slow/static actors (2–5 Hz), higher for fast gameplay actors like projectiles (60 Hz). Default is 100 Hz, which is wasteful.
- **`NetPriority`** — higher values get preference in the replicated property budget. Player characters: `3.0`. Important pickups: `2.0`. Background actors: `1.0`.
- **Spawn with `SpawnActorDeferred` when you need to set properties before replication** — `FinishSpawning` triggers the first replication tick.

## Replication Graph (opt-in)

When `multiplayer: true` and `replication_graph: true` are set in `project.config.json`, the Replication Graph module is active. Do not skip this setup — it cannot be retrofitted cheaply.

```cpp
// MyReplicationGraph.cpp — minimal spatial grid node
void UMyReplicationGraph::InitGlobalActorClassSettings()
{
    Super::InitGlobalActorClassSettings();

    // Always relevant — replicate to all connections always
    AddAlwaysRelevantClass(AGameState::StaticClass());
    AddAlwaysRelevantClass(APlayerState::StaticClass());

    // Spatially relevant — replicate only to nearby connections
    FClassReplicationInfo ProjectileInfo;
    ProjectileInfo.DistanceCutoffSqr = 150000.f * 150000.f;  // 150m
    AddClassRepInfo(AMyProjectile::StaticClass(), EClassRepNodeMapping::Spatially_Dynamic_Relevancy);
    DefineReplicationInfo(AMyProjectile::StaticClass(), ProjectileInfo);
}
```

- **Spatial grid node for all gameplay actors** — character, enemies, projectiles, interactables. Actors outside the spatial relevancy radius are never sent.
- **Always-relevant for GameState, PlayerStates, global pickups** — these must be visible to all clients.
- **`NotAlwaysRelevantClass` for HUD actors, clientside-only effects** — no point replicating these to non-owners.
- **Never call `AActor::SetNetCullDistanceSquared` directly when Replication Graph is active** — the graph overrides it. Configure via `FClassReplicationInfo` in the graph.

## Common replication bugs

| Symptom | Root cause | Fix |
|---|---|---|
| State works in PIE standalone, breaks in multiplayer PIE | Mutating state without `HasAuthority()` check | Add role check |
| Ability activates twice | Ability activation not guarded server-only; client also activating | Gate `GiveAbility` / `TryActivateAbility` behind `HasAuthority()` |
| Health bar jumps | `OnRep_Health` fires before the new value is set | UE fires `OnRep` after setting; check you're not reading a stale cache |
| Server RPC silently dropped | Actor not owned by the calling client | Confirm the `PlayerController` owns the actor with `GetOwner()` chain |
| Replicated array changes not propagating | Modified array element, not the container | Reassign the entire array or call `MarkArrayDirty()` on a `FFastArraySerializer` |
