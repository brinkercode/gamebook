# Replication Overview — Single-Player and Multiplayer Paths

> The project defaults to single-player. Multiplayer is an opt-in question in the `project-scaffolder` interview. This guide covers the structural differences between the two paths, the replication contracts GAS requires, and the step-by-step changes needed to go from single-player to dedicated-server multiplayer. Everything in this guide assumes the systems laid out in [gameplay-systems.md](gameplay-systems.md) and [gas-overview.md](gas-overview.md).

---

## Two Paths at a Glance

| Concern | Single-Player | Multiplayer (dedicated server) |
|---------|--------------|-------------------------------|
| World authority | Client IS the server | Dedicated server process |
| ASC location | On `ACharacter` | On `APlayerState` (recommended) or `ACharacter` |
| ASC replication mode | `Minimal` | `Mixed` (player) / `Minimal` (AI) |
| Attribute replication | `COND_None` | `COND_None` with RepNotify |
| Gameplay effects | Always applied | Server applies, client predicts via GAS |
| Input | Direct call → `AbilityInputTagPressed` | `LocalPredicted` net execution policy |
| Actor movement | Exact (no reconciliation) | `UCharacterMovementComponent` prediction |
| Replication Graph | Not used | Opt-in `UReplicationGraph` for 16+ players |
| Save / load | Client disk | Server-authoritative + client cache |

---

## Single-Player Configuration

The simplest setup. The ASC lives on the character, replication mode is `Minimal`, and no server-authority checks are needed because the client IS the server.

```cpp
// AProjectNameCharacter constructor — single-player
AProjectNameCharacter::AProjectNameCharacter()
{
    AbilitySystemComponent = CreateDefaultSubobject<UGAS_AbilitySystemComponent>(TEXT("ASC"));
    AbilitySystemComponent->SetIsReplicated(false);   // SP: no replication overhead
    AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Minimal);
}
```

```cpp
// PossessedBy — single-player (server == client)
void AProjectNameCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    AbilitySystemComponent->InitAbilityActorInfo(this, this);
    if (DefaultAbilitySet)
    {
        DefaultAbilitySet->GiveToAbilitySystem(AbilitySystemComponent, nullptr);
    }
}
```

`OnRep_PlayerState` can be left as a no-op for single-player. Attributes are not replicated.

In `Config/DefaultEngine.ini`, set:
```ini
[/Script/Engine.GameNetworkManager]
TotalNetBandwidth=0         ; Unlimited — SP has no network
MaxDynamicBandwidth=0
```

---

## Multiplayer Path — Dedicated Server

Enable during scaffolding: the `project-scaffolder` sets `project.config.json` → `stack.networking = "dedicated_server"`.

### Step 1 — Move ASC to PlayerState

For multiplayer, the ASC belongs to `APlayerState` so it persists across respawns (Pawn dies, PlayerState lives):

```cpp
// ProjectNamePlayerState.h
UCLASS()
class PROJECTNAME_API AProjectNamePlayerState : public APlayerState,
                                                 public IAbilitySystemInterface
{
    GENERATED_BODY()
public:
    AProjectNamePlayerState();
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;

    UGAS_AbilitySystemComponent* GetProjectASC() const { return AbilitySystemComponent; }
    UGAS_CombatAttributeSet* GetCombatAttributes() const { return CombatAttributeSet; }

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GAS")
    TObjectPtr<UGAS_AbilitySystemComponent> AbilitySystemComponent;

    UPROPERTY()
    TObjectPtr<UGAS_CombatAttributeSet> CombatAttributeSet;
};
```

```cpp
// ProjectNamePlayerState.cpp
AProjectNamePlayerState::AProjectNamePlayerState()
{
    AbilitySystemComponent = CreateDefaultSubobject<UGAS_AbilitySystemComponent>(TEXT("ASC"));
    AbilitySystemComponent->SetIsReplicated(true);
    AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Mixed);

    CombatAttributeSet = CreateDefaultSubobject<UGAS_CombatAttributeSet>(TEXT("CombatAttributes"));

    NetUpdateFrequency = 100.f;  // High freq for ability/attribute data
}
```

### Step 2 — InitAbilityActorInfo on Character

The Character still implements `IAbilitySystemInterface` but forwards to PlayerState's ASC:

```cpp
UAbilitySystemComponent* AProjectNameCharacter::GetAbilitySystemComponent() const
{
    if (const AProjectNamePlayerState* PS = GetPlayerState<AProjectNamePlayerState>())
    {
        return PS->GetAbilitySystemComponent();
    }
    return nullptr;
}

// Server: PossessedBy fires after PlayerState is set
void AProjectNameCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);

    AProjectNamePlayerState* PS = GetPlayerState<AProjectNamePlayerState>();
    if (!PS) { return; }

    PS->GetProjectASC()->InitAbilityActorInfo(PS, this);
    HealthComponent->InitializeWithAbilitySystem(PS->GetProjectASC());

    if (DefaultAbilitySet)
    {
        DefaultAbilitySet->GiveToAbilitySystem(PS->GetProjectASC(), nullptr);
    }
}

// Client: PlayerState replicates after Pawn
void AProjectNameCharacter::OnRep_PlayerState()
{
    Super::OnRep_PlayerState();

    AProjectNamePlayerState* PS = GetPlayerState<AProjectNamePlayerState>();
    if (!PS) { return; }

    PS->GetProjectASC()->InitAbilityActorInfo(PS, this);
    HealthComponent->InitializeWithAbilitySystem(PS->GetProjectASC());
}
```

### Step 3 — Replication Mode per Actor Type

```cpp
// Players: Mixed — server sends full effect list to owner, minimal to others
// (EGameplayEffectReplicationMode::Mixed set in PlayerState constructor above)

// AI / NPCs: Minimal — only tags replicated, not full effect list
// (In AProjectNameAICharacter constructor:)
AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Minimal);
```

### Step 4 — Gameplay Effect Net Execution Policies

| Policy | When |
|--------|------|
| `LocalPredicted` | Player abilities — responsive feel, server corrects |
| `LocalOnly` | Cosmetic-only abilities (emotes) |
| `ServerOnly` | Game-state-mutating abilities (spawn items) |
| `ServerInitiated` | Server-triggered abilities on AI |

```cpp
// GA_PrimaryFire — player fire: predict locally, server confirms hit
UGA_PrimaryFire::UGA_PrimaryFire()
{
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;
    InstancingPolicy   = EGameplayAbilityInstancingPolicy::InstancedPerActor;
}
```

### Step 5 — Replication Graph (16+ players)

Enable in `Config/DefaultEngine.ini`:
```ini
[/Script/OnlineSubsystemUtils.IpNetDriver]
ReplicationDriverClassName=/Script/ProjectName.ProjectNameReplicationGraph
```

```cpp
// ProjectNameReplicationGraph.h
UCLASS()
class PROJECTNAME_API UProjectNameReplicationGraph : public UReplicationGraph
{
    GENERATED_BODY()
public:
    virtual void InitGlobalActorClassSettings() override;
    virtual void InitGlobalGraphNodes() override;
    virtual void InitConnectionGraphNodes(UNetReplicationGraphConnection* Connection) override;
    virtual void RouteAddNetworkActorToNodes(const FNewReplicatedActorInfo& ActorInfo,
                                             FGlobalActorReplicationInfo& GlobalInfo) override;
    virtual void RouteRemoveNetworkActorToNodes(const FNewReplicatedActorInfo& ActorInfo) override;

private:
    UPROPERTY()
    TObjectPtr<UReplicationGraphNode_ActorList> AlwaysRelevantNode;
};
```

Key routing decisions:
- `APlayerState` → `AlwaysRelevant` node (every client needs all player states).
- `AProjectNameCharacter` → `GridCell` or `ConnectionRelevancy` node (spatially culled).
- `AProjectileActor` → `AlwaysRelevant` if few, `DynamicSpatialFrequency` if many.
- Static level actors → `StaticActor` node (replicated once at join).

### Step 6 — Dedicated Server Target

In `ProjectName.Target.cs` and `ProjectNameServer.Target.cs`:

```csharp
// ProjectNameServer.Target.cs
public class ProjectNameServerTarget : TargetRules
{
    public ProjectNameServerTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Server;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.Add("ProjectName");

        // Dedicated server: no rendering, no audio
        bUsesSteam = true;
        GlobalDefinitions.Add("UE_SERVER=1");
    }
}
```

---

## Network Testing Locally

```bash
# Launch listen server + one client (two PIE instances)
# In Editor: Play → Number of Players = 2, Net Mode = Play As Listen Server

# Dedicated server headless + two clients
"$(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor" "$(PROJECT_UPROJECT)" \
    /Game/Maps/TestLevel -server -log &

"$(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor" "$(PROJECT_UPROJECT)" \
    127.0.0.1 -game -log -WINDOWED -ResX=800 -ResY=600 &

"$(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor" "$(PROJECT_UPROJECT)" \
    127.0.0.1 -game -log -WINDOWED -ResX=800 -ResY=600
```

Simulate latency in PIE: `Editor Preferences → Play → Simulate Network Latency = 80ms`.

---

## Makefile Targets (Server)

```makefile
.PHONY: build-server cook-server package-server

build-server:
	"$(UE_ROOT)/Engine/Build/BatchFiles/Linux/Build.sh" \
	    ProjectNameServer Linux Shipping "$(PROJECT_UPROJECT)" -waitmutex

cook-server:
	"$(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(PROJECT_UPROJECT)" \
	    -run=Cook -TargetPlatform=LinuxServer -map=/Game/Maps/DefaultLevel \
	    -unversioned -compressed -log

package-server:
	"$(UE_ROOT)/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun \
	    -project="$(PROJECT_UPROJECT)" \
	    -noP4 -platform=Linux -serverconfig=Shipping -server -cook \
	    -stage -package -archive -archivedirectory="$(BUILD_DIR)/Server"
```

---

## Key Rules

1. **Default to single-player** — do not add replication overhead until the multiplayer path is explicitly enabled.
2. **ASC on PlayerState for multiplayer** — this survives respawn; ASC on Character does not.
3. **`InitAbilityActorInfo` on both server (`PossessedBy`) and client (`OnRep_PlayerState`)** — forgetting the client call is the #1 GAS multiplayer bug.
4. **Replication mode per role** — `Mixed` for players, `Minimal` for AI. `Full` is only for debugging.
5. **`LocalPredicted` for player abilities** — `ServerOnly` blocks responsiveness; use it only for server-side-only game state changes.
6. **Replication Graph before beta** — vanilla replication does not scale past ~16 players in the same area.
7. **Test with simulated latency from day one** — `FNetworkEmulationSettings` in PIE. A 100ms RTT reveals prediction bugs that zero-latency testing hides.
