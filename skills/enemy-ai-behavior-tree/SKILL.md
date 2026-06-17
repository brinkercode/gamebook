---
name: enemy-ai-behavior-tree
description: Use when adding an enemy type to a UE5 FPS project — creates an AIController subclass, Behavior Tree + Blackboard asset, Perception component setup, and EQS query for cover/patrol. Invoke when the user says "add an enemy AI", "implement the patrol guard", "create the enemy behavior", or "build the behavior tree".
version: "1.0.0"
---

# Enemy AI Behavior Tree

> Creates `AEnemyAIController` (C++), `BT_Enemy_<Name>` Behavior Tree, `BB_Enemy` Blackboard, `EQS_FindCover` Environment Query, and `BP_Enemy_<Name>` pawn. Perception-driven alert/combat state transitions.

## When to use

Invoke when a new enemy archetype is needed. If `AEnemyAIController` already exists and only a new BT variant is needed, skip to step 3. Escalate to `/ship` if the enemy requires new GAS abilities or new attribute sets.

## How it works

1. **Interview** — ask the scoping questions from `resources/interview.md`.
2. **AIController** — create `AEnemyAIController` using the code in `resources/ai-controller.md`; set up `UAISenseConfig_Sight` and `UAISenseConfig_Hearing`.
3. **Blackboard** — create `BB_Enemy` with the standard keys from `resources/blackboard.md`.
4. **Behavior Tree** — build `BT_Enemy_<Name>` per the task/service layout in `resources/behavior-tree.md`.
5. **EQS** — create `EQS_FindCover` and `EQS_FindPatrolPoint` per `resources/eqs.md`.
6. **Pawn** — create `BP_Enemy_<Name>` child of `BP_EnemyBase`; assign AIController class, Behavior Tree, and Blackboard.
7. **Verify** — place in PIE, confirm enemy patrols, alerts on player sight, transitions to combat, seeks cover when taking damage.

## Resources (read on demand)

- `resources/interview.md` — scoping questions.
- `resources/ai-controller.md` — `AEnemyAIController` C++ header + implementation.
- `resources/blackboard.md` — standard Blackboard keys and types.
- `resources/behavior-tree.md` — full BT task/service/decorator layout description.
- `resources/eqs.md` — EQS generator + test config for cover-finding and patrol-point queries.

## Success Criteria

- [ ] Enemy patrols waypoints in Idle state
- [ ] `UAIPerceptionComponent` triggers state change to Alert on player sight
- [ ] Combat state: enemy moves toward player, fires weapon ability
- [ ] `EQS_FindCover` query returns a valid cover position when enemy health < 50%
- [ ] Enemy returns to patrol after losing sight for `LostSightTimeout` seconds
- [ ] `UBehaviorTreeComponent::StartTree` called without errors in PIE log

## What to Commit

```
Source/<Project>/AI/EnemyAIController.h
Source/<Project>/AI/EnemyAIController.cpp
Content/AI/BehaviorTrees/BT_Enemy_<Name>.uasset
Content/AI/BehaviorTrees/BB_Enemy.uasset
Content/AI/EnvironmentQuery/EQS_FindCover.uasset
Content/AI/EnvironmentQuery/EQS_FindPatrolPoint.uasset
Content/Characters/Enemies/BP_Enemy_<Name>.uasset
```
