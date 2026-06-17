# BB_Enemy — Blackboard Keys

Create `Content/AI/BehaviorTrees/BB_Enemy.uasset` with these keys:

| Key Name | Type | Description |
|---|---|---|
| `TargetActor` | Object (Actor) | The player actor; nil when not in combat |
| `PatrolTarget` | Vector | Next patrol waypoint position |
| `AIState` | Int | 0 = Idle, 1 = Alert, 2 = Combat |
| `LastKnownLocation` | Vector | Last known player position (persists after sight loss) |
| `CoverLocation` | Vector | EQS-selected cover point; set before MoveToLocation task |
| `bCanSeeTarget` | Bool | Set by BTService_UpdateSight; used by decorators |
| `bIsAtCoverPoint` | Bool | Set true when MoveToLocation (cover) completes |
| `LostSightTime` | Float | World time at which sight was lost; used for Alert timeout |

## Key Usage Patterns

**TargetActor** is set/cleared in `AEnemyAIController::OnTargetPerceptionUpdated`. BT tasks never write it directly — they read it only.

**AIState** drives the top-level selector conditions:
- `AIState == 0` (Idle): run patrol subtree
- `AIState == 1` (Alert): run alert subtree (search last known location)
- `AIState == 2` (Combat): run combat subtree

**CoverLocation** is populated by `BTTask_RunEQS(EQS_FindCover)`. The task writes the best EQS result here, then `BTTask_MoveTo(CoverLocation)` executes.
