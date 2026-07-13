# Unlock Gates

## Subsystem

`UProgressionSubsystem` is the single write-path to progression state and the single place `grants[]` tags get applied. Scope it per-player (`UGameInstanceSubsystem`) if the tree is personal (a survivalist's skill tree), or attach an equivalent component to the settlement actor/ASC if the tree is civ-scoped (a shared settlement tech tree) — pick one per tree, document the choice in `project.config.json`.

```cpp
// Source/<Project>/Public/Progression/ProgressionSubsystem.h
UCLASS()
class MYPROJECT_API UProgressionSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    // Server-authoritative. Validates prerequisites + cost, deducts points/goods,
    // grants Grants[] to TargetASC. Returns false (no side effects) on any failure.
    UFUNCTION(BlueprintCallable, Category = "Progression")
    bool UnlockNode(FName NodeID, UAbilitySystemComponent* TargetASC);

    UFUNCTION(BlueprintCallable, Category = "Progression")
    bool CanUnlockNode(FName NodeID, const UAbilitySystemComponent* TargetASC) const;

    UFUNCTION(BlueprintCallable, Category = "Progression")
    void AddPoints(int32 Amount, FGameplayTag SourceTag);

    UFUNCTION(BlueprintCallable, Category = "Progression")
    int32 GetCurrentPoints() const { return CurrentPoints; }

    UFUNCTION(BlueprintCallable, Category = "Progression")
    bool IsNodeUnlocked(FName NodeID) const { return UnlockedNodeIDs.Contains(NodeID); }

    // Bind for WB_TechTree live refresh.
    DECLARE_MULTICAST_DELEGATE_OneParam(FOnNodeUnlocked, FName /*NodeID*/);
    FOnNodeUnlocked OnNodeUnlocked;

protected:
    UPROPERTY() UDataTable* TechTreeTable; // DT_TechTree_<Domain>, set via config or Asset Manager
    UPROPERTY() int32 CurrentPoints = 0;
    UPROPERTY() TSet<FName> UnlockedNodeIDs;
    UPROPERTY() TSet<FName> FirstCraftedRecipes;
};
```

```cpp
// Source/<Project>/Private/Progression/ProgressionSubsystem.cpp — UnlockNode sketch
bool UProgressionSubsystem::UnlockNode(FName NodeID, UAbilitySystemComponent* TargetASC)
{
    check(GetWorld()->GetNetMode() != NM_Client); // server-authoritative entry point only

    const FTechNodeRow* Row = TechTreeTable->FindRow<FTechNodeRow>(NodeID, TEXT("UnlockNode"));
    if (!Row || UnlockedNodeIDs.Contains(NodeID)) return false;

    for (const FName& Prereq : Row->Prerequisites)
    {
        if (!UnlockedNodeIDs.Contains(Prereq)) return false; // reject: prerequisite missing
    }
    if (CurrentPoints < Row->CostPoints) return false; // reject: insufficient points
    // ... validate CostGoods against the target's UInventoryComponent, if any ...

    CurrentPoints -= Row->CostPoints;
    // ... deduct CostGoods ...
    UnlockedNodeIDs.Add(NodeID);

    for (const FGameplayTag& Tag : Row->Grants)
    {
        TargetASC->SetTagMapCount(Tag, 1); // or ApplyGameplayEffectToSelf with a persistent GE — see Respec below
    }

    // Append to save delta log — see Persistence below.
    OnNodeUnlocked.Broadcast(NodeID);
    return true;
}
```

**Rules:**
- `UnlockNode` runs only on the server/authority. If called from a client-owned Blueprint, route it through a `Server`, `Reliable`, `WithValidation` RPC first — never trust a client-reported success.
- The consumer never sees a `bool bUnlocked` anywhere in this path. The only externally visible effect of a successful unlock is tags landing on `TargetASC`.
- Prefer `SetTagMapCount` for a simple "granted forever until respec" tag. If a project's respec policy needs the grant to be revocable via a single call (see Respec below), grant it via a persistent-`Infinite`-duration `UGameplayEffect` instead, so removal is `RemoveActiveGameplayEffect` rather than manual tag bookkeeping — pick one approach per project and be consistent.

## Consumers

Every gated system queries the tag on the appropriate ASC — never a bespoke bool, never reaching into `UProgressionSubsystem` internals.

| System | Query point | Example tag |
|---|---|---|
| `[[crafting-system]]` | `DT_Recipes_*` row has `RequiredUnlockTag`; `UCraftingComponent::TryStartCraft` calls `ASC->HasMatchingGameplayTag(Row.RequiredUnlockTag)` before validating inventory | `Unlock.Recipe.IronIngot` |
| `[[building-system]]` | placement-validation step checks `ASC->HasMatchingGameplayTag(BuildingDef.RequiredUnlockTag)` before allowing ghost-preview to go valid | `Unlock.Building.Smelter` |
| `[[creature-taming]]` | capture-device eligibility check gates which device types can be equipped/used | `Unlock.Capture.TrapCage` |
| `[[production-chains]]` | a chain's next tier (`DT_ProductionRecipes` row with a higher `TierID`) is filtered out of the assignable recipe list until its tag is present | `Unlock.Chain.Tier.2` |

**Rules:**
- Consumers call `HasMatchingGameplayTag` (or `HasAllMatchingGameplayTags` for a row needing more than one grant) — read-only, no dependency on `UProgressionSubsystem` beyond which ASC to query.
- Tag naming is hierarchical and namespaced by consumer domain so `eng-director` can grep for orphaned unlock tags: `Unlock.Recipe.*`, `Unlock.Building.*`, `Unlock.Capture.*`, `Unlock.Chain.Tier.*`. Add new namespaces the same way for other consumer systems.
- A consumer system must never fall back to "unlocked by default" when a tag is missing from `Config/DefaultGameplayTags.ini` — missing tag registration is a data bug, fail closed (locked), not open.

## Respec

Decide the policy explicitly per project and record it in `project.config.json` (`progression.respec_policy`):

- **No respec** (default for a first pass) — simplest; `UnlockNode` is one-directional. Recommended unless the design brief calls for build-crafting flexibility.
- **Full refund, tree-wide** — `RespecTree()` walks `UnlockedNodeIDs`, removes every granted tag from `TargetASC`, refunds `CostPoints` (not `CostGoods`, typically — goods were consumed into the world), clears `UnlockedNodeIDs`. One server call, one save-delta entry (`"op": "respec_tree"`).
- **Partial-cost, per-node** — `RespecNode(NodeID)` only valid if no *other* unlocked node lists it as a prerequisite (walk the graph, reject if dependents exist); refunds `CostPoints * RespecRefundRate` (e.g. 0.5), removes only that node's `Grants` tags.

Whichever policy is chosen, respec goes through the same `UProgressionSubsystem` entry points as unlock — never a direct tag removal from Blueprint/UI code — so the save delta log stays the single source of truth.

## UI

`WB_TechTree` reads the DataTable directly for static layout (node position, cost, icon, description) and binds to the subsystem for live state:

```cpp
// Source/<Project>/Public/UI/WB_TechTree.h
UCLASS()
class MYPROJECT_API UWB_TechTree : public UCommonActivatableWidget
{
    GENERATED_BODY()
protected:
    virtual void NativeOnInitialized() override;
    UFUNCTION() void HandleNodeUnlocked(FName NodeID); // bound to UProgressionSubsystem::OnNodeUnlocked
    UFUNCTION(BlueprintCallable) void RequestUnlock(FName NodeID); // routes to subsystem/RPC, never mutates locally
};
```

**Rules:**
- The widget never computes eligibility itself beyond calling `CanUnlockNode` for a greyed-out/available/locked visual state — the subsystem is the source of truth for "can this be clicked."
- On `HandleNodeUnlocked`, refresh only the affected node's visuals and any node whose `Prerequisites[]` includes it (those may have just become eligible) — don't rebuild the whole tree widget on every event at settlement scale.

## Persistence

Unlocked node IDs, current points, and the award ledger are appended to the save delta log — the same convention `[[procgen-world]]` uses for world-mutation deltas — rather than re-derived from anything runtime-computed:

```cpp
// Appended to the project's delta log entry union (see procgen-world/resources/delta-saves.md)
USTRUCT()
struct FProgressionDelta
{
    GENERATED_BODY()
    UPROPERTY() FName NodeID;          // for "node_unlocked" / "node_respec" ops
    UPROPERTY() FGameplayTag SourceTag; // for "points_awarded" ops
    UPROPERTY() int32 Amount = 0;
    UPROPERTY() FString Op;            // "node_unlocked" | "node_respec" | "points_awarded" | "respec_tree"
};
```

On load: regenerate/rehydrate as normal, then replay the progression delta list in order — `AddPoints` for each award, `UnlockNode`-equivalent re-application of `Grants` tags for each unlock (skip the cost/prerequisite validation on replay, the log is already authoritative) — rather than persisting a redundant snapshot of `UnlockedNodeIDs` and the granted tags separately. This keeps the tree's history auditable and matches the "log of deltas, not baked state" rule the rest of the world-state stack follows.

## Functional Test — prerequisite enforcement

```cpp
// Source/<Project>Tests/Private/Progression/TechTreePrerequisiteTest.cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTechTreePrerequisiteTest,
    "<Project>.Progression.<Domain>.EnforcesPrerequisites",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FTechTreePrerequisiteTest::RunTest(const FString&)
{
    UWorld* World = FAutomationEditorCommonUtils::CreateNewMap();
    UProgressionSubsystem* Progression = World->GetGameInstance()->GetSubsystem<UProgressionSubsystem>();
    UAbilitySystemComponent* ASC = /* spawn test pawn, get its ASC */;

    Progression->AddPoints(100, FGameplayTag::RequestGameplayTag("ProgressionSource.Test"));

    // "IronTools" requires "IronIngot" — attempt out of order.
    const bool RejectedOutOfOrder = Progression->UnlockNode("IronTools", ASC);
    TestFalse("Node with ungranted prerequisite is rejected", RejectedOutOfOrder);
    TestFalse("No tags granted on rejection", ASC->HasMatchingGameplayTag(
        FGameplayTag::RequestGameplayTag("Unlock.Recipe.IronTools")));

    // Unlock the prerequisite, then the node, in order.
    TestTrue("Prerequisite unlocks", Progression->UnlockNode("IronIngot", ASC));
    TestTrue("Node unlocks once prerequisite is met", Progression->UnlockNode("IronTools", ASC));
    TestTrue("Grants[] tag present on target ASC", ASC->HasMatchingGameplayTag(
        FGameplayTag::RequestGameplayTag("Unlock.Recipe.IronTools")));

    return true;
}
```

Gate this under `make automation-critical` alongside the other `@critical`-tagged tests once the tree is content-complete for the vertical slice.
