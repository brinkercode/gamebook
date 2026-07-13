---
name: creature-work-assignment
description: Use when a survival/crafting/civilization project needs tamed creatures to autonomously staff work slots on stations/buildings — Palworld-style creature labor feeding Anno-style production chains. Invoke when the design brief says "creature labor", "auto-assign workers", "work slots", "colony management", "put a creature to work", or when [[crafting-system]]'s `FWorkSlot` staffing hook or [[production-chains]]-style buildings need a real assignment brain. Reach for it from a feature wave's design-technical or eng-gameplay role. Skip for player-only crafting with no NPC/creature staffing (plain `crafting-system` covers that) and for combat-pet AI (use `enemy-ai-behavior-tree` patterns instead — this skill is for labor, not combat).
version: "1.0.0"
---

# Creature Work Assignment

> The colony-management loop: `UWorkSchedulerSubsystem` matches idle tamed creatures to open `FWorkSlot`s on stations by aptitude, creatures path to the slot and play a job-specific work loop, output feeds the station's production buffer, and fatigue/happiness drain forces rotation back through the same subsystem. This is the differentiator connecting [[crafting-system]] (stations, `FWorkSlot`) to a labor economy.

## When to use

Invoke once per project to establish the scheduler, the aptitude schema on the creature Data Asset, and the BT job-loop task set — then extend per job type (`Work.Mining`, `Work.Crafting`, `Work.Transport`, ...) as a `/fix`-sized addition (new tag + BT task + work-loop montage/effect). Requires `crafting-system`'s `AStation`/`FWorkSlot` to already exist (stations expose the slots this skill fills) and a tameable-creature actor/Data Asset to assign (from the project's creature-taming feature, out of scope here). Escalate to `/ship` for the first pass — subsystem + attribute set + BT tasks + UI is multi-surface.

## How it works

Keep this section short — depth lives in `resources/` and is read only when the step calls for it.

1. **Work slots** — stations/buildings expose `TArray<FWorkSlot>` (job tag, occupant, pinned flag, output rate). Slots are declared where the station is defined ([[crafting-system]]), not duplicated here. See `resources/work-slots.md`.
2. **Aptitude schema** — extend the creature Data Asset with `TMap<FGameplayTag, EAptitudeTier>` (job tag → tier) and a `CT_AptitudeEfficiency` curve table mapping tier → output multiplier. See `resources/work-slots.md`.
3. **Scheduler subsystem** — `UWorkSchedulerSubsystem` (`UWorldSubsystem`) owns the idle-creature pool and the open-slot pool; runs assignment passes on a throttled tick, applies priority rules, and honors manual pins. See `resources/job-scheduler.md`.
4. **Pathing + work loop** — assigned creatures get a BT job (`BTTask_MoveToWorkSlot` → `BTTask_PerformWorkLoop`) keyed by job tag; the loop plays an anim montage and ticks the station's production buffer. See `resources/job-scheduler.md#work-loop`.
5. **Fatigue/happiness rotation** — creature vitals (GAS `UCreatureVitalsAttributeSet`, same pattern as `survival-stats`) drain while working; threshold tags trigger `BTService_MonitorFatigue` to vacate the slot back to the scheduler. See `resources/job-scheduler.md#fatigue`.
6. **UI** — `WB_AssignmentBoard` (Common UI) lists creatures × open slots, exposes manual pin/unpin, and reflects live efficiency. See `resources/job-scheduler.md#ui`.
7. **Persistence** — assignment state (creature→slot, pinned flags, in-progress fatigue) is never a snapshot; it's entries in the world delta log per `[[procgen-world]]`'s save convention, replayed on load.

## UE5 context

- Modules affected: `Source/<Project>/Public/CreatureWork/` (`UWorkSchedulerSubsystem`, `UWorkAssignableComponent`), `Source/<Project>/Public/AI/` (BT tasks/services), `Source/<Project>/Public/Data/` (aptitude fields on the creature Data Asset)
- Asset paths: `Content/AI/CreatureWork/BT_CreatureWork_<Job>.uasset`, `Content/Data/CT_AptitudeEfficiency.uasset`, `Content/Data/DT_WorkPriorityRules.uasset`, `Content/UI/WB_AssignmentBoard.uasset`
- Config files: `Config/DefaultGameplayTags.ini` (`Work.Mining`, `Work.Crafting`, `Work.Transport`, `State.Exhausted.Work`, `State.Unhappy.Work`)

## Resources (read on demand)

- `resources/work-slots.md` — `FWorkSlot` struct, aptitude tag/tier schema on the creature Data Asset, efficiency curve wiring, station-side integration with `crafting-system`.
- `resources/job-scheduler.md` — `UWorkSchedulerSubsystem` assignment algorithm (priority rules, manual pinning), BT task set for pathing/work loops, `UCreatureVitalsAttributeSet` fatigue/happiness, `WB_AssignmentBoard`, and the delta-log persistence shape.

## Output

A wave using this skill delivers: `UWorkSchedulerSubsystem` (C++, `UWorldSubsystem`), `UWorkAssignableComponent` (C++, attached to tameable creature pawns), `UCreatureVitalsAttributeSet` (GAS AttributeSet for Fatigue/Happiness), `BTTask_MoveToWorkSlot`/`BTTask_PerformWorkLoop`/`BTService_MonitorFatigue`, `DT_WorkPriorityRules`, `CT_AptitudeEfficiency`, and `WB_AssignmentBoard`. `systems_surface[]` entries: `type: "subsystem"` for `UWorkSchedulerSubsystem`, `type: "component"` for `UWorkAssignableComponent`, `type: "attribute"` for `UCreatureVitalsAttributeSet` (Fatigue/Happiness), `type: "data"` for `DT_WorkPriorityRules`/`CT_AptitudeEfficiency` — `eng-gameplay` exposes the subsystem/component/attribute-set C++, `design-technical` wires the BT assets, curve table values, priority-rule rows, and `WB_AssignmentBoard` layout. Proven by a Functional Test named `<Project>.CreatureWork.Assignment.MatchesAptitudeAndRotatesOnFatigue` that spawns two creatures of differing aptitude tiers, an open `Work.Mining` slot, asserts the higher-tier creature is auto-assigned deterministically for a fixed seed, drains its Fatigue attribute past `State.Exhausted.Work`, and asserts the scheduler vacates and reassigns without player input. Cross-reference [[procgen-world]] for the delta-log persistence convention and [[survival-stats]] for the vitals-attribute pattern this skill's creature vitals reuse.
