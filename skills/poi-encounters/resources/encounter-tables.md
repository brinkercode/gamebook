# Encounter Tables

> Seeded encounter rolls per POI type/danger tier, loot handoff into inventory, respawn/lockout as world deltas, and the exploration-reward loop that feeds tech-progression. Read this when implementing `UPOIEncounterDirector`, authoring `DT_EncounterTable` rows, or wiring the loot/progression payout.

## `DT_EncounterTable` schema

One row per `(POIType, DangerTier)` combination — never a bespoke table per POI instance. Designers tune rows; code only reads.

```cpp
// Source/<Project>/Public/Data/EncounterTableRow.h
USTRUCT(BlueprintType)
struct FEncounterTableRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere) FName POIID;             // matches UDA_POIArchetype::POIID
    UPROPERTY(EditAnywhere) int32 DangerTier = 1;

    // Spawn composition — weighted list of enemy/boss classes with count ranges.
    UPROPERTY(EditAnywhere) TArray<FEncounterSpawnEntry> SpawnRoll;   // {TSubclassOf<APawn>, MinCount, MaxCount, Weight}

    // Loot — resolves through the same yield-table pattern as resource-gathering.
    UPROPERTY(EditAnywhere) FDataTableRowHandle LootTable;            // -> DT_HarvestTable-shaped rows

    // Reward loop
    UPROPERTY(EditAnywhere) float TechProgressionPoints = 0.f;        // base grant on clear; scaled by tier elsewhere

    UPROPERTY(EditAnywhere) FGameplayTagContainer ClearGrantsTags;    // e.g. Encounter.Cleared.BanditCamp
};
```

Naming: `DT_EncounterTable_<POIKind>` under `Content/Data/`, e.g. `DT_EncounterTable_Camp`, `DT_EncounterTable_BossArena`.

## Seeded encounter rolls

Every roll derives from the POI's own stream — never a shared/global `FRandomStream`, never `FMath::Rand`. This mirrors `procgen-world`'s seed-discipline rule and `resource-gathering`'s per-node stream.

```cpp
// Source/<Project>/Public/World/POI/POIEncounterComponent.h
UCLASS(ClassGroup = (World), meta = (BlueprintSpawnableComponent))
class MYPROJECT_API UPOIEncounterComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UPROPERTY() FName POIID;
    UPROPERTY() FGuid POIInstanceID;   // stable per-placement GUID, derived at placement time, saved in the delta record

    void RollEncounter(int64 WorldSeed);

private:
    FRandomStream MakeInstanceStream(int64 WorldSeed) const
    {
        return FRandomStream(HashCombine(GetTypeHash(WorldSeed), GetTypeHash(POIInstanceID)));
    }
};
```

`RollEncounter` looks up the `DT_EncounterTable` row for `(POIID, Region.DangerTier)`, walks `SpawnRoll` weighted entries using the instance stream, and spawns the resulting pawns through the encounter director (server-only — see Multiplayer below). Determinism contract: rolling the same `(WorldSeed, POIInstanceID)` twice — e.g. after a save/reload before the encounter is cleared — must produce the same spawn composition.

## Loot handoff

On encounter clear, resolve `LootTable` exactly the way `resource-gathering` resolves node yield: roll through the instance stream, then hand items to inventory — never spawn intermediate pickup actors unless the project explicitly wants physical drops.

```cpp
TArray<FInventoryEntry> Loot = UEncounterLootLibrary::RollLoot(Row.LootTable, InstanceStream);
if (UInventoryComponent* Inv = PlayerState->FindComponentByClass<UInventoryComponent>())
{
    Inv->TryAddItems(Loot);
}
```

## The exploration-reward loop → tech-progression points

Clearing a POI is a primary source of the currency that gates the tech/civilization progression layer (Anno-style unlocks). Route the grant through a subsystem call, not a hardcoded stat mutation on the player:

```cpp
if (UTechProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UTechProgressionSubsystem>())
{
    const float Grant = Row.TechProgressionPoints * DangerTierMultiplier(Region.DangerTier);
    Progression->GrantPoints(PlayerState, Grant, Row.ClearGrantsTags);
}
```

- If the project doesn't yet have a tech-progression subsystem, this is the seam where `eng-gameplay` adds one (multi-surface — escalate to `/ship`, not `/fix`).
- Higher danger tier and rarer POI archetypes (boss arenas > dungeon entrances > camps > ruins, by convention) should carry higher `TechProgressionPoints` — tune via the DataTable, not code branches.
- `ClearGrantsTags` lets a boss-arena clear grant a permanent `FGameplayTag` (e.g. unlocking a recipe or region) — apply via a `GameplayEffect` with `Infinite` duration per the shared GAS pattern, not a raw tag-add on the ASC.

## Respawn / lockout as world deltas

POI state never lives in the level or in full actor serialization — it's a delta record appended to the same log `procgen-world` owns, exactly like `resource-gathering`'s node depletion.

```cpp
USTRUCT()
struct FPOIStateDelta
{
    GENERATED_BODY()
    UPROPERTY() FGuid POIInstanceID;
    UPROPERTY() EPOIState State = EPOIState::Uncleared;   // Uncleared | Cleared | Respawning
    UPROPERTY() FDateTime ClearedAtUTC;                     // used to evaluate RespawnLockoutHours
};
```

- On encounter clear: append `{POIInstanceID, Cleared, Now}` to the world delta log.
- On load / region stream-in: replay deltas for that region's POIs; a POI whose `RespawnLockoutHours` window has not elapsed reports `Cleared` (no encounter re-roll, empty interior); one whose window has elapsed re-evaluates to `Uncleared` and will roll a fresh encounter (same instance stream, so composition is still deterministic for that reroll epoch — see below).
- `bRespawns = false` archetypes (e.g. a one-time boss arena tied to a main story beat) never transition back to `Uncleared` regardless of elapsed time — check this before the lockout-window math, not after.
- If the project wants encounter variety across respawns rather than an identical replay, key the instance stream off `(WorldSeed, POIInstanceID, RespawnEpoch)` where `RespawnEpoch` increments each time the lockout window elapses — still fully deterministic, just no longer constant across respawns.

## Multiplayer

If `project.config.json` sets `networking != single-player`: encounter rolls, loot rolls, and delta-log writes happen exclusively on the server. Clients receive replicated pawn spawns (standard actor replication — GAS already replicates any ability activation on spawned enemies, don't reimplement) and a lightweight `OnEncounterStateChanged` notify for UI; a client never rolls its own encounter composition or trusts a locally-computed loot list. Cross-reference `[[save-system]]`/`procgen-world`'s delta-save pattern for how the encrypted delta log itself is written and replicated.

## Verify

1. Regenerate a fixed seed, walk into a POI, record the spawn composition and loot roll; regenerate the same seed again, confirm both match exactly.
2. Clear a POI, save, reload — confirm it reports `Cleared` and no encounter re-rolls while inside the lockout window.
3. Advance past `RespawnLockoutHours` (or fire the respawn event trigger), confirm the POI transitions back to `Uncleared` and rolls a fresh encounter.
4. Confirm `TechProgressionPoints` were granted exactly once per clear (not re-granted on a subsequent visit to an already-`Cleared` POI).
