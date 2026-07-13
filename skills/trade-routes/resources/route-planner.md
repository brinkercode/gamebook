# Route Planner

Concrete UE5 5.7 templates for the trade-post building, the `FTradeRoute` data model, carrier
assignment, travel time, optional seeded events, the automation UI, and delta-log persistence.

## Trade post {#trade-post}

`ATradePost` is a thin `AStructureBase` subclass ([[building-system]]) — it owns no goods buffer
of its own, it reads/writes the settlement's existing shared item store, the same one
[[production-chains]] and [[settlement-population]] use. Do not create a parallel warehouse.

```cpp
// Source/<Project>/Public/Economy/Trade/TradePost.h
UCLASS()
class MYGAME_API ATradePost : public AStructureBase
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category = "Trade")
    ASettlementCenter* GetOwningSettlement() const { return OwningSettlement; }

    // Convenience accessor the route subsystem uses to move goods in/out of the
    // settlement's shared store — never a post-local buffer.
    UFUNCTION(BlueprintCallable, Category = "Trade")
    UInventoryComponent* GetTradeStore() const;

protected:
    UPROPERTY(EditAnywhere, Category = "Trade")
    TObjectPtr<ASettlementCenter> OwningSettlement;
};
```

BP wiring: `BP_TradePost` sets a mesh/interaction widget only. All buy/sell math and manifest
movement live in C++ (`UTradeRouteSubsystem`), never in the post's Blueprint graph.

## Route schema {#route-schema}

```cpp
// Source/<Project>/Public/Economy/Trade/TradeRouteTypes.h
USTRUCT(BlueprintType)
struct FTradeManifestEntry
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FGameplayTag GoodTag;          // Good.Ore, Good.Ingot, ...

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 Quantity = 0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bOriginToDestination = true; // false = return-leg goods, dest -> origin
};

USTRUCT(BlueprintType)
struct FTradeRoute
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FGuid RouteId;                 // stable across save/reload — the delta-log key

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TWeakObjectPtr<ATradePost> Origin;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TWeakObjectPtr<ATradePost> Destination;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FTradeManifestEntry> Manifest;

    UPROPERTY(BlueprintReadOnly)
    TWeakObjectPtr<AActor> AssignedCarrier; // caravan Pawn or boat/vehicle actor

    UPROPERTY(BlueprintReadOnly)
    int32 CurrentLeg = 0;          // 0 = outbound, 1 = return

    UPROPERTY(BlueprintReadOnly)
    float LegElapsedSeconds = 0.f;

    UPROPERTY(BlueprintReadOnly)
    float LegDurationSeconds = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bRepeating = false;
};
```

`UTradeRouteSubsystem` (`UWorldSubsystem`) owns `TMap<FGuid, FTradeRoute> ActiveRoutes` and
advances every route on the same coarse settlement tick [[production-chains]]'s
`USettlementTickSubsystem` already drives — do not add a second competing tick. Register as a
listener or call from the same tick dispatch.

```cpp
// Source/<Project>/Public/Economy/Trade/TradeRouteSubsystem.h
UCLASS()
class MYGAME_API UTradeRouteSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category = "Trade")
    FGuid CreateRoute(ATradePost* Origin, ATradePost* Destination,
                       const TArray<FTradeManifestEntry>& Manifest, AActor* Carrier);

    UFUNCTION(BlueprintCallable, Category = "Trade")
    void SetRepeating(FGuid RouteId, bool bRepeating);

    // Called by the shared settlement tick — server only.
    void AdvanceRoutes(float DeltaSeconds);

private:
    void CompleteLeg(FTradeRoute& Route);
    void WriteRouteDelta(const FTradeRoute& Route, const TCHAR* EventName);

    UPROPERTY()
    TMap<FGuid, FTradeRoute> ActiveRoutes;
};
```

## Carriers {#carriers}

Two carrier shapes share the same leg-advancement contract — the route subsystem doesn't care
which one is assigned, only that it exposes a speed stat and occupies the route for its duration:

- **Creature caravan** — a tamed creature filling a `Work.Transport` work slot per
  [[creature-work-assignment]]. Its aptitude/speed attribute feeds `LegDurationSeconds`.
- **Boat / vehicle** — a dedicated `ABoatCarrier`/`AVehicleCarrier` actor (Pawn or non-possessed
  actor, project's choice) with a `Speed` `UPROPERTY`, restricted to routes whose region-graph
  edge is tagged `Traversal.Water`.

```cpp
// Both implement this thin interface so the route subsystem stays carrier-agnostic.
UINTERFACE(BlueprintType)
class MYGAME_API UTradeCarrierInterface : public UInterface { GENERATED_BODY() };

class MYGAME_API ITradeCarrierInterface
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintNativeEvent, Category = "Trade")
    float GetCarrierSpeed() const; // units/sec, used in travel-time math
};
```

A carrier already assigned to a route cannot be double-booked — `CreateRoute` checks
`ITradeCarrierInterface` occupancy (or the [[creature-work-assignment]] work-slot state) before
accepting the assignment, and rejects server-side if the carrier is busy.

## Travel time {#travel-time}

Never hand-tune a per-route constant. Pull the origin→destination distance from the same
region-graph edge weights [[procgen-world]]'s `UWorldGenSubsystem` already computed when it built
the region graph, and divide by the assigned carrier's speed:

```cpp
float UTradeRouteSubsystem::ComputeLegDuration(const ATradePost* From, const ATradePost* To,
                                                const AActor* Carrier) const
{
    const UWorldGenSubsystem* WorldGen = GetWorld()->GetSubsystem<UWorldGenSubsystem>();
    const float DistanceKm = WorldGen->GetRegionGraphDistance(
        WorldGen->GetRegionForActor(From), WorldGen->GetRegionForActor(To));

    const float SpeedKmPerSec = ITradeCarrierInterface::Execute_GetCarrierSpeed(Carrier);
    check(SpeedKmPerSec > 0.f);
    return DistanceKm / SpeedKmPerSec;
}
```

If the project's region graph has no edge between the two regions (disconnected landmass, no
water traversal for a boat), `CreateRoute` rejects the route server-side rather than falling back
to a straight-line guess.

## Seeded events (optional) {#seeded-events}

Ambush/weather events are an opt-in hook, gated by `project.config.json → trade.seeded_events_enabled`.
Skip this entirely for a calmer first slice — routes still work with zero event code.

```cpp
void UTradeRouteSubsystem::MaybeRollLegEvent(FTradeRoute& Route)
{
    if (!bSeededEventsEnabled) return;

    const uint32 Seed = HashCombine(HashCombine(GetTypeHash(WorldSeed), GetTypeHash(Route.RouteId)),
                                     GetTypeHash(Route.CurrentLeg));
    FRandomStream Stream(Seed);

    if (Stream.FRand() < AmbushChancePerLeg)
    {
        ApplyAmbushOutcome(Route, Stream); // may damage carrier, delay leg, or lose manifest goods
        WriteRouteDelta(Route, TEXT("TradeRoute.Event.Ambush"));
    }
    else if (Stream.FRand() < WeatherDelayChancePerLeg)
    {
        Route.LegDurationSeconds *= WeatherDelayMultiplier;
        WriteRouteDelta(Route, TEXT("TradeRoute.Event.Weather"));
    }
}
```

Deterministic-by-seed: the stream is derived from `(WorldSeed, RouteId, CurrentLeg)`, never
`FMath::Rand()` — replaying the delta log from a save must reproduce the identical roll and
outcome every time.

## Route automation UI {#automation-ui}

`WB_TradeRoutePlanner` (Common UI, `UCommonActivatableWidget`) lets a player pick origin/destination
posts, edit the manifest, assign a carrier, and toggle `bRepeating`. The widget only calls
`CreateRoute`/`SetRepeating`/manifest-edit `UFUNCTION(BlueprintCallable)` entry points on the
subsystem — it never mutates `FTradeRoute` fields directly, and never polls; it binds to a
`FOnTradeRouteUpdated` delegate the subsystem broadcasts on leg completion.

```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTradeRouteUpdated, FGuid, RouteId);
```

When `bRepeating` is true, `CompleteLeg` re-queues the same manifest for the return leg (or a new
outbound leg once the return completes) rather than the UI re-submitting — this is what "set
manifest, repeat" means in practice: one `CreateRoute` call, indefinite operation until the player
cancels.

## Persistence {#persistence}

A route never saves as a raw position/ETA snapshot in isolation — every state transition writes an
entry to the same world delta log [[procgen-world]] defines: `TradeRoute.Created`,
`TradeRoute.LegCompleted`, `TradeRoute.ManifestChanged`, `TradeRoute.Cancelled`. On load, the delta
log replay reconstructs `ActiveRoutes` by replaying entries in order — `LegElapsedSeconds` is
derived from the timestamp delta between the last `LegCompleted`-or-`Created` entry and the current
tick, not stored as a raw float that could desync from the log.

```cpp
void UTradeRouteSubsystem::WriteRouteDelta(const FTradeRoute& Route, const TCHAR* EventName)
{
    FWorldDeltaEntry Entry;
    Entry.EventTag = FGameplayTag::RequestGameplayTag(EventName);
    Entry.TargetId = Route.RouteId;
    Entry.Payload  = SerializeRouteSnapshot(Route); // manifest + carrier + leg index only
    GetWorld()->GetSubsystem<UWorldGenSubsystem>()->AppendDelta(Entry);
}
```

Server-authoritative throughout: `CreateRoute`, manifest edits, `AdvanceRoutes`, and event rolls
all execute on the server; `FTradeRoute` fields needed for HUD display replicate down, but clients
never call these mutators directly — route UI calls a server RPC that validates before mutating.
