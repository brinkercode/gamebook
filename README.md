# Gamebook

> A virtual game studio for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). The
> gamebook turns Claude Code into a control plane that **creates new UE5 games and runs them
> through every stage of development** — concept, pre-production, vertical slice, production,
> alpha, beta, gold, live — with 35 agents modeled on real studio departments and 39 deterministic
> waves modeled on the industry's real milestone gates. UE 5.7+, C++ + Blueprints, GAS, Enhanced
> Input, Wwise, Niagara, UMG + Common UI, Git LFS.

Instead of asking one agent to "build the feature and check your work," you launch a **wave** — a
deterministic `.js` workflow that assembles a cross-discipline pod (design brief → C++ systems +
failing tests → Blueprint/level/audio integration), then hands the output to verifiers that did
not build it. The author never grades itself; a stage never advances except through a greenlight
panel judging criteria that were locked before the work existed; and the three project-fate gates
(concept, slice, RC) run on the strongest model available.

The gamebook is the game-dev sibling of [godbook](../godbook/) — same L1–L4 wave harness — but
org-shaped like a studio: departments (design, engineering, art, audio, narrative, production,
QA, publishing) gate quality while waves assemble feature pods, and a `staffing` axis
(solo/indie/studio) collapses specialist roles along the same merge lines real studios use.

## Quick start

```bash
./scripts/setup-claude.sh        # global permissions + symlink all 39 /commands
# then, in any Claude Code session:
/pitch <your game idea>          # the studio starts working — no repo needed yet
```

The golden path from idea to live game is in [PLAYBOOK.md](PLAYBOOK.md) — start there.

## What's inside

| | |
|---|---|
| [PLAYBOOK.md](PLAYBOOK.md) | The orchestration overview: layers, lifecycle gates, non-negotiables, failure table |
| [.claude/workflows/](.claude/workflows/README.md) | 39 waves — the deterministic control plane |
| [agents/](agents/README.md) | 35 department/role agents + shared protocol/schemas |
| [references/](references/PROFILES.json) | project bindings: capabilities · stages · staffing |
| [models.json](models.json) | cost-tier routing (fable/opus/sonnet/haiku) + the no-downgrade rules |
| [rules/](rules/README.md) · [guides/](guides/) · [quality/](quality/) · [skills/](skills/) | UE5 standards, how-tos, budgets, and 39 invokable recipes (incl. procgen worlds, survival/crafting/building, creature taming + workforce, Anno-style economy) |
| [scripts/harness-check.sh](scripts/harness-check.sh) | the harness's own CI gate (mirror drift, wave parse, schema validity, shim coverage) |

## The one rule

**The layer that does the work is never trusted to grade itself.** Gate verdicts come from
`qa-gate-verifier` re-running the checks; playtest verdicts come from an analyst who measures fun,
not correctness; crash fixes are accepted only when the re-driven repro is clean; stage verdicts
come from panels judging pre-locked criteria — and `kill` is an honored outcome, because it is in
real studios too.
