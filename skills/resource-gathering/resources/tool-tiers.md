# Tool Tiers — GA_Harvest, GameplayTag gating, server-authoritative yield

## 1. Tag taxonomy

Add to `Config/DefaultGameplayTags.ini`, following the standard tag format from
[`gas-ability`'s `resources/tags.md`](../../gas-ability/resources/tags.md):

```ini
[/Script/GameplayTags.GameplayTagsSettings]
+GameplayTagList=(Tag="Tool.Axe.Tier1",   DevComment="Stone axe — wood, softwood tier")
+GameplayTagList=(Tag="Tool.Axe.Tier2",   DevComment="Iron axe — hardwood, ironwood tier")
+GameplayTagList=(Tag="Tool.Axe.Tier3",   DevComment="Steel axe — all wood incl. world-boss trees")
+GameplayTagList=(Tag="Tool.Pickaxe.Tier1", DevComment="Stone pickaxe — copper, tin")
+GameplayTagList=(Tag="Tool.Pickaxe.Tier2", DevComment="Iron pickaxe — iron, coal")
+GameplayTagList=(Tag="Tool.Pickaxe.Tier3", DevComment="Steel pickaxe — mythril, all ore")
+GameplayTagList=(Tag="Tool.Sickle.Tier1", DevComment="Fiber sickle — flax, grass")
+GameplayTagList=(Tag="Resource.Wood",     DevComment="Yield category tag for UI/filter")
+GameplayTagList=(Tag="Resource.Ore",      DevComment="Yield category tag for UI/filter")
+GameplayTagList=(Tag="Resource.Fiber",    DevComment="Yield category tag for UI/filter")
```

**Convention:** `Tool.<Category>.Tier<N>` where N is a strictly-ordered ladder (1 = starter, N =
best). A node's `RequiredToolTag` is the *minimum* tier — a Tier2 axe satisfies a Tier1 node.
Tag hierarchy is flat per-category on purpose (no `Tool.Axe.Tier2` implying `Tool.Axe.Tier1` via
tag parentage) because gating is done by **tier-number comparison**, not tag containment — see
§3. Do not model tiers as nested tags (`Tool.Axe.Tier1.Tier2...`); parse the trailing `TierN`
instead.

## 2. Tool Data Assets carry the tag

Tools themselves are `UDA_ToolDefinition` (or the project's existing weapon/item Data Asset)
with a `FGameplayTag ToolTierTag` field. The wielded tool grants its tag to the wielder's ASC
while equipped (via an `Infinite` `GameplayEffect`, `GE_ToolEquipped_GrantTag`, applied on
equip/unequip — never by manually adding loose tags to the ASC).

```cpp
// GE_ToolEquipped_GrantTag (BP child, data-only per PATTERNS.md#effect)
DurationPolicy: Infinite
GrantedTags: (SetByCaller — the equipped tool's ToolTierTag, e.g. "Tool.Axe.Tier2")
RemovalPolicy: RemoveOnEndAbility of the equip ability, or on unequip
```

## 3. `GA_Harvest` — tool-tier gating

```cpp
// Source/<Project>/Public/Abilities/GA_Harvest.h
UCLASS()
class MYGAME_API UGA_Harvest : public UGameplayAbility
{
    GENERATED_BODY()
public:
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Harvest")
    TSubclassOf<UGameplayEffect> DamageEffect;   // GE_HarvestDamage, magnitude = tool's swing power

    // Returns false (and plays a "wrong tool" cue) if the equipped tool tier is below the
    // node's RequiredToolTag tier for the same category.
    bool HasSufficientToolTier(const UAbilitySystemComponent* ASC, const FGameplayTag& RequiredTag) const;
};
```

```cpp
bool UGA_Harvest::HasSufficientToolTier(const UAbilitySystemComponent* ASC, const FGameplayTag& RequiredTag) const
{
    // Category = "Tool.Axe", tier = trailing int. Compare only within matching category.
    const FString ReqStr = RequiredTag.ToString();               // "Tool.Axe.Tier2"
    const int32 ReqTier = ExtractTierNumber(ReqStr);
    const FString Category = ExtractCategory(ReqStr);             // "Tool.Axe"

    FGameplayTagContainer Owned;
    ASC->GetOwnedGameplayTags(Owned);
    for (const FGameplayTag& Tag : Owned)
    {
        if (Tag.ToString().StartsWith(Category))
        {
            if (ExtractTierNumber(Tag.ToString()) >= ReqTier) return true;
        }
    }
    return false;
}
```

**Rules:**
- Tier check happens in `ActivateAbility` before `CommitAbility()` — an insufficient tool must
  not consume stamina/durability or start the swing montage. `EndAbility` immediately with
  `bWasCancelled = true` on failure, per the `gas-ability` end-clean rule.
- Do not gate via `ActivationRequiredTags`/`ActivationBlockedTags` on the ability spec — those
  are static per-tag, but tier comparison here is numeric/relational and needs the runtime check
  above. `ActivationRequiredTags` is still used for the coarse gate (must have *some*
  `Tool.Axe.*` equipped at all vs. bare hands).
- Node health damage is a normal `GameplayEffect` (`GE_HarvestDamage`, `Instant`, magnitude from
  a `FScalableFloat`/`SetByCaller` scaled by tool tier) applied to the node's own
  `UAbilitySystemComponent` — the node is a first-class ASC owner (see `harvest-nodes.md`), not
  a bag of raw floats poked from outside.
- On the node's Health hitting 0 (`PostGameplayEffectExecute` in its AttributeSet), the node
  broadcasts a depletion delegate; `GA_Harvest` (or the node itself) calls `RollYield`.

## 4. Server-authoritative yield in multiplayer

If `project.config.json` → `stack.networking != "single-player"`:

- `GA_Harvest` uses `NetExecutionPolicy::ServerInitiated` (or `LocalPredicted` for the swing
  animation only, with the *damage effect and yield roll* gated to `HasAuthority()`).
- `AHarvestNode::RollYield` and `OnHealthDepleted` must early-out unless
  `GetOwner()->HasAuthority()` — clients never roll loot, they only receive the resulting
  `UInventoryComponent` replication.
- The node's `Health` attribute is `ReplicatedUsing` per `PATTERNS.md#attribute` so clients see
  visual state (broken/depleted mesh) without being trusted for the roll.
- `FRandomStream YieldStream` lives server-side only; it is never replicated. Clients have no
  need to predict loot contents, only the harvest-in-progress animation/hit-reaction.
- Treat any client-reported "I harvested this and should get X" RPC as untrusted input — see
  `agents/_shared/SECURITY_CHECKLIST.md`. The server re-derives the roll from its own
  `YieldStream`; it never accepts a client-supplied item list.
