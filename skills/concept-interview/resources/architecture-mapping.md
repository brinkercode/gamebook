# Concept Decisions → UE5 Architecture Implications

Read at step 4. Call out any flagged items before writing `docs/CONCEPT.md`.

---

## Genre subtype flags

| Subtype | Architecture implication |
|---|---|
| Tactical / mil-sim | Slow projectile simulation required; GAS cost/cooldown effects must express ammunition economy; consider `UAbilityTask_WaitGameplayEvent` for coordinated team abilities |
| Arena shooter | Movement must be replicated with high frequency; `UCharacterMovementComponent` prediction lag must be tuned; matchmaking surface needed (EOS Sessions or Steam Lobbies) |
| Immersive sim | Heavy interaction-system surface; every interactive actor must implement `IInteractableInterface`; level streaming budget matters more than raw poly count |
| Extraction / looter-shooter | Inventory system needed from day one; GAS attributes for carry weight / slot count; `USaveGame` must handle item serialization |
| Campaign / narrative FPS | Dialogue tree skill required; Wwise state machines per narrative zone; level streaming is the primary content delivery mechanism |

---

## Multiplayer flags

| Stance | Implication |
|---|---|
| Single-player only | GAS attributes can be `COND_OwnerOnly`; no server-side validation needed in Phase 1 |
| Optional later | Set `bReplicates = true` on `UAbilitySystemComponent` from day one; mark all gameplay-relevant `UPROPERTY` with `Replicated`; do not use client-only shortcuts |
| Multiplayer day one | Replication Graph plugin must be enabled in `DefaultEngine.ini`; `UReplicationGraphNode_GridSpatialization2D` for large maps; dedicated server build target in `<Project>.Target.cs` |

---

## Team size flags

| Size | Implication |
|---|---|
| Solo | Blueprints for iteration, C++ only for GAS + performance-critical paths; Megascans-only art strategy; Functional Tests over Gauntlet |
| 2–3 | Shared `Config/DefaultGame.ini` as source of truth for balance data; Data Tables for all tunable values; Perforce is not used — Git LFS conventions enforced |
| 4–5 | Content-locking workflow needed (two devs cannot modify the same uasset simultaneously without conflict); World Partition for collaborative level editing |

---

## GAS complexity flags

| Feature | GAS requirement |
|---|---|
| Health / stamina / ammo | `UAttributeSet` subclass with `UPROPERTY(ReplicatedUsing=OnRep_*)` per attribute |
| Status effects (burn, stun, slow) | `UGameplayEffect` with duration and periodic magnitude; `FGameplayTagContainer` for immunity tags |
| Active abilities (sprint, ADS, grenade) | `UGameplayAbility` subclass per ability; `FGameplayAbilitySpec` added at pawn possession |
| Passive perks / upgrades | `UGameplayEffect` with `EGameplayEffectDurationType::Infinite`; magnitude driven by a `FScalableFloat` curve table |
| Ability combos / chains | `UAbilityTask_WaitGameplayEvent` fires on tag event; combo window managed via `AddLooseGameplayTag` / `RemoveLooseGameplayTag` |
