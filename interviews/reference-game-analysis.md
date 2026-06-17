# Reference Game Analysis

> Systematic interview for extracting mechanic/feel targets from reference games and translating them into actionable vertical-slice specs.

---

## Instructions for Claude

Run this interview before any greenlight or `/ship` that defines a new gameplay system. Ask every section in order. Pause after each section and wait for the answer before continuing. Do not batch sections.

Output: a completed `docs/REFERENCE_ANALYSIS.md` in the project repo. This document is live — update it as the project evolves. It becomes the "what does winning feel like" benchmark for the [playtest-architect](../agents/playtest-architect.md).

---

## Section 1: Reference Game List

Ask:

> Name the 2–5 games that define what this project should feel like. For each, say which platform you played it on and roughly when (year is fine). If a game influenced what you want to *avoid*, flag it with a minus sign.

Wait for the list. Record it verbatim. Then confirm:

> Got it. I'll analyze each one in turn. Ready when you are — tell me about [first game].

---

## Section 2: Per-Game Deep Dive

Repeat this section for each game on the list. Work through them one at a time.

### 2a. What specifically works

Ask:

> In [game], what is the one moment or mechanic you want players to feel? Be concrete — describe the scenario, not a genre label. "The first time you parry a Genichiro attack and the posture bar breaks" is useful. "Fast-paced combat" is not.

Wait. Probe if the answer is still a genre label:

> Can you describe that as a player action → game response → player emotion chain? What does the player physically do, what does the game do back, and what's the feeling?

Record the chain as:
```
Input: [what the player does]
Response: [what the game does — audio, VFX, camera, damage number, state change]
Emotion: [what the player feels]
```

### 2b. The exact mechanic to borrow

Ask:

> Which specific mechanic, system, or interaction from [game] should we implement? Name the system (e.g., "stamina-gated block", "hit-stop on contact", "weapon degradation", "ability combo cancel windows"). If there are multiple, rank them.

Record each as a candidate system. Note whether it maps to GAS (ability/effect/attribute), Enhanced Input (input buffering, chord), or a custom component.

### 2c. The feel — not the mechanics

Ask:

> Separate from the mechanics: what is the *feel* of [game] that you want to preserve? Think camera weight, animation blend speed, audio feedback timing, controller rumble pattern, hit reaction responsiveness. What does "it feels like [game]" mean at a physical/sensory level?

Record as a list of feel targets. These become acceptance criteria in playtest scripts — e.g., "melee hit-stop duration: 4–6 frames", "camera FOV kick on dash: 5°", "audio: hit feedback plays within 50ms of contact confirmation".

### 2d. What NOT to import

Ask:

> What does [game] do that you explicitly do not want in this project? Common answers: floaty movement, excessive ragdoll, intrusive tutorial prompts, damage number clutter, stamina punishing enough to stop fun, excessive loot drops.

Record these as **anti-patterns**. The [code-reviewer](../agents/code-reviewer.md) and [playtest-architect](../agents/playtest-architect.md) will flag implementations that trend toward them.

---

## Section 3: Synthesis — Where This Game is Different

After covering all reference games, ask:

> Now: what is this game doing that none of the references do? What is the one thing that makes it distinct — mechanically, narratively, or tonally?

Wait for a clear statement. If the answer references another game ("kind of like X but..."), push:

> Describe it without referencing another game. What is the player doing, and why does it feel different from anything they've played?

Record this as the **differentiator statement**. It goes in the executive summary of `docs/REFERENCE_ANALYSIS.md` and in `project.config.json` under `design.differentiator`.

---

## Section 4: Playable Target Definition

Ask each sub-question separately.

### 4a. The money moment

> What is the single interaction — one player action and one game response — that the vertical slice absolutely must nail? This is the "if a stranger plays for 10 minutes and doesn't feel this, we have failed" moment.

Record verbatim. This becomes `playtest.money_moment` in [.claude/handoffs/playtest.json](../agents/_shared/HANDOFF.md).

### 4b. Success bar

> How will you know the feel target is hit? Describe how a blind playtest session looks when it succeeds versus when it fails. What do players say or do differently?

Record observable behaviors:
- Success indicators (e.g., "player immediately re-queues", "player asks about the unlock system unprompted")
- Failure indicators (e.g., "player says it feels sluggish", "player misses the parry window 3+ times and quits")

### 4c. Scope guard

> What features from the reference games are out of scope for the vertical slice? We need a kept-out list to prevent scope creep.

Record as `out_of_scope[]`. Anything on this list requires an explicit "yes, add this" decision — the [gameplay-systems-engineer](../agents/gameplay-systems-engineer.md) and [blueprint-feature-builder](../agents/blueprint-feature-builder.md) will not implement it otherwise.

---

## Section 5: GAS Mapping

After the feel/mechanic targets are captured, map each candidate system to a GAS or engine primitive:

Ask:

> For each mechanic we identified, I'll suggest the UE5 implementation layer. Tell me if the mapping sounds right or if you see it working differently.

Present each mechanic with a proposed mapping:

| Mechanic | Proposed Layer | Notes |
|----------|---------------|-------|
| Stamina gate on block | `UAttributeSet` (Stamina) + `UGameplayEffect` (drain on block hit) | Replicates automatically via GAS |
| Parry window | `UGameplayAbility` (parry) with `WaitGameplayEvent` for impact tag | Tag: `Combat.Hit.Parryable` |
| Hit-stop | `UGameplayAbility::CommitAbility` → `UGameplayEffect` with `GameplayModifier` on time dilation | Local predict, server confirm |
| Dodge cancel | `GA_Dodge` set `bAllowInterruption = true` during cancel window; cancel via `CancelAbilitiesWithTags` | Enhanced Input chord |
| Damage number | `UGameplayEffectExecutionCalculation` output → delegate → `WB_VFX_DamageNumber` | Client-side spawn only |

Wait for confirmation or correction on each. Update the mapping table. This table seeds the `systems_surface[]` in [.claude/handoffs/systems.json](../agents/_shared/HANDOFF.md).

---

## Section 6: Anti-Pattern Guard Rails

Ask:

> Given the anti-patterns we listed, which of these feel traps are most likely to creep into development? Rank the top 3.

For each top anti-pattern, agree on a concrete gate:

| Anti-Pattern | Detection Method | Gate |
|-------------|-----------------|------|
| Floaty movement | Playtest metric: average air time per jump > threshold | Functional Test: `Test_Movement_JumpAirTime` asserts < 0.6s |
| Stamina feel punishing | Playtest session: player stops attacking due to stamina fear | Playtest script: observer notes if player idles >3s waiting for regen |
| Tutorial interruption | Functional test: count `UCommonActivatableWidget` activations in first 5 min | Gate: ≤ 2 unprompted tutorial pushes |
| Damage number clutter | Screen density audit in PIE | Max 5 simultaneous `WB_VFX_DamageNumber` instances visible |

Document agreed gates in `docs/REFERENCE_ANALYSIS.md` under **Anti-Pattern Gates**. The [playtest-architect](../agents/playtest-architect.md) converts these into Gauntlet test assertions.

---

## Output: docs/REFERENCE_ANALYSIS.md Structure

Write this file once the interview is complete:

```markdown
# Reference Game Analysis

## Differentiator Statement
[one paragraph — what this game does that no reference does]

## Reference Games
- [Game 1] — [platform, year]
- [Game 2] — ...

## Feel Targets (per game)
### [Game 1]
**Money mechanic:** [description]
**Input → Response → Emotion chain:**
  - Input: ...
  - Response: ...
  - Emotion: ...
**Sensory feel targets:** [list: camera, audio, timing specs]
**Anti-patterns from this game:** [list]

## Candidate Systems → GAS Mapping
| Mechanic | Layer | Tags/Classes |
|----------|-------|-------------|
| ...      | ...   | ...         |

## Vertical Slice Playable Target
**Money moment:** [verbatim from Section 4a]
**Success indicators:** [list]
**Failure indicators:** [list]

## Out of Scope (Vertical Slice)
- [feature 1]
- [feature 2]

## Anti-Pattern Gates
| Anti-Pattern | Gate |
|-------------|------|
| ...         | ...  |
```

After writing `docs/REFERENCE_ANALYSIS.md`, update `project.config.json`:

```json
{
  "design": {
    "differentiator": "[one-sentence differentiator]",
    "money_moment": "[one-sentence money moment]",
    "reference_games": ["Game1", "Game2"],
    "anti_patterns": ["floaty movement", "..."]
  }
}
```

---

## Handoff to Agents

Once `docs/REFERENCE_ANALYSIS.md` exists:

- **[gameplay-systems-engineer](../agents/gameplay-systems-engineer.md)** — reads the GAS mapping table. Implements `UAttributeSet`, `UGameplayAbility`, and `UGameplayEffect` classes that match the feel targets.
- **[playtest-architect](../agents/playtest-architect.md)** — reads money moment, success/failure indicators, and anti-pattern gates. Converts them into Functional Test assertions and manual playtest observation scripts.
- **[blueprint-feature-builder](../agents/blueprint-feature-builder.md)** — reads sensory feel targets. Applies camera shake presets, hit-stop durations, VFX scale curves, and audio Wwise event triggers to match the described feel.
- **[level-encounter-designer](../agents/level-encounter-designer.md)** — reads money moment. Blockouts the encounter or combat arena that gives the player the best chance to discover it.

Do not start any of these agents until `docs/REFERENCE_ANALYSIS.md` is committed and `project.config.json` has `design.money_moment` populated.
