# EQS — Environment Queries

---

## EQS_FindCover

`Content/AI/EnvironmentQuery/EQS_FindCover.uasset`

**Generator:** Points on Circle
- Center: Querier (enemy pawn)
- Radius: 800 UU
- Number of Points: 16
- Spawn Height: 0

**Tests (in order):**

1. **Trace** (filter)
   - Context: Cover from: `EnvQueryContext_Player`
   - Trace type: Visibility
   - Test Purpose: Filter — must NOT have line of sight to player (i.e., the point is behind cover)

2. **Distance** (score)
   - Context: Querier
   - Scoring Factor: 1.0
   - Normalize Type: Absolute
   - Purpose: Prefer closer cover points (minimize exposure while moving)

3. **Dot** (score — optional)
   - Between: Querier to Player direction, Querier to Point direction
   - Scoring Factor: -1.0
   - Purpose: Prefer points that are in a direction away from the player

**Result:** Best scoring point written to `CoverLocation` Blackboard key by `BTTask_RunEQS`.

---

## EQS_FindPatrolPoint

`Content/AI/EnvironmentQuery/EQS_FindPatrolPoint.uasset`

**Generator:** Actors of Class
- Actor Class: `ABP_PatrolWaypoint` (simple AActor subclass placed in level)
- Context: World

**Tests:**

1. **Distance** (filter + score)
   - From Querier
   - Filter: Min 200 UU (don't pick a point right next to current position)
   - Score: prefer closer points (tighter patrol loop)

**Result:** Written to `PatrolTarget` Blackboard key.

## ABP_PatrolWaypoint

Create `BP_PatrolWaypoint` as child of AActor. No components needed — just a placed marker in the level. Add a `TextRenderComponent` for editor label. The EQS generator finds all instances in the current level.

For ordered patrol (A→B→C→A), replace EQS with a `TArray<ABP_PatrolWaypoint*>` on the enemy pawn and index through them in `BTTask_MoveToNextWaypoint`.
