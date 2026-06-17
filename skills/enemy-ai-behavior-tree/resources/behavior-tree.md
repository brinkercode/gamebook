# BT_Enemy_<Name> — Behavior Tree Layout

Build `Content/AI/BehaviorTrees/BT_Enemy_<Name>.uasset` with this structure. Root → Selector (three branches, evaluated left to right).

---

## Root → Selector

### Branch 1: Combat (priority 1, leftmost)
**Decorator:** Blackboard `AIState == 2`

```
Sequence
├── BTService_UpdateSight        (updates bCanSeeTarget every 0.2s)
├── Selector
│   ├── Sequence (take cover when health < 50%)
│   │   ├── BTDecorator: Blackboard HealthPct < 0.5
│   │   ├── BTTask_RunEQS: EQS_FindCover → writes CoverLocation
│   │   └── BTTask_MoveTo: CoverLocation (AcceptanceRadius=50)
│   └── Sequence (engage target)
│       ├── BTDecorator: Blackboard bCanSeeTarget == true
│       ├── BTTask_MoveTo: TargetActor (AcceptanceRadius=300, bAllowPartialPath=true)
│       └── BTTask_FireWeapon         (custom Task: calls Weapon->Fire() or activates GA_EnemyFire)
└── Sequence (lost sight — go to last known)
    ├── BTDecorator: Blackboard bCanSeeTarget == false
    ├── BTTask_MoveTo: LastKnownLocation
    └── BTTask_Wait: 2.0s
```

### Branch 2: Alert (priority 2)
**Decorator:** Blackboard `AIState == 1`

```
Sequence
├── BTTask_MoveTo: LastKnownLocation (AcceptanceRadius=100)
├── BTTask_Wait: 3.0s  (look around)
├── BTTask_SetBlackboardValue: AIState = 0  (return to Idle if no contact)
```

After `LostSightTimeout` (default 8s) without re-acquiring target, revert to Idle.

### Branch 3: Idle / Patrol (priority 3, rightmost)
**Decorator:** Blackboard `AIState == 0` (or always — fallback)

```
Sequence
├── BTTask_RunEQS: EQS_FindPatrolPoint → writes PatrolTarget
├── BTTask_MoveTo: PatrolTarget (AcceptanceRadius=50)
└── BTTask_Wait: RandomDeviation 1.0–3.0s
```

---

## Services

**BTService_UpdateSight** (custom service, interval 0.2s):
```cpp
void UBTService_UpdateSight::TickNode(UBehaviorTreeComponent& OwnerComp, ...)
{
    AEnemyAIController* AC = Cast<AEnemyAIController>(OwnerComp.GetAIOwner());
    AActor* Target = Cast<AActor>(OwnerComp.GetBlackboardComponent()
        ->GetValueAsObject(FName("TargetActor")));

    bool bCanSee = Target && AC->LineOfSightTo(Target);
    OwnerComp.GetBlackboardComponent()->SetValueAsBool(FName("bCanSeeTarget"), bCanSee);
}
```

---

## Custom Tasks

**BTTask_FireWeapon**:
```cpp
EBTNodeResult::Type UBTTask_FireWeapon::ExecuteTask(
    UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
    APawn* Pawn = OwnerComp.GetAIOwner()->GetPawn();
    if (!Pawn) return EBTNodeResult::Failed;

    if (UWeaponBase* Weapon = Pawn->FindComponentByClass<UWeaponBase>())
    {
        Weapon->Fire();
        return EBTNodeResult::Succeeded;
    }
    return EBTNodeResult::Failed;
}
```
