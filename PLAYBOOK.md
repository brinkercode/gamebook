# Gamebook — Playbook

> A virtual game studio for Claude Code. The gamebook creates **new** UE5 projects and runs them
> through every stage of development — concept → pre-production → vertical slice → production →
> alpha → beta → gold → live — with agents modeled on real studio departments and deterministic
> waves modeled on the industry's real milestone gates. UE 5.7+, C++ + Blueprints, GAS, Enhanced
> Input, Wwise (MetaSounds fallback), Niagara, UMG + Common UI, Git LFS.

---

## The four layers

```
L1  Orchestrator (Fable, the main loop) ── the Executive Producer seat: routes requests to waves,
    reads verdicts, sequences multi-wave campaigns, talks to the user, runs git ONLY on request
L2  Studio processes ── .claude/workflows/*-wave.js (39 deterministic waves; non-trusting gates;
    stage guards; never run git)
L3  Departments & roles ── agents/*.md (35 single-job agents, cost-tiered via models.json)
L4  The project ── references/<project>/config.json (stage · staffing · profile) · docs/ ·
    agents/_shared/schemas/ · rules/ · skills/
```

The matrix mirrors real studios: **pods deliver, departments gate.** A wave assembles a
cross-discipline pod for the task, and the outputs are judged by seats that did not build them —
`qa-gate-verifier` re-runs every gate ignoring self-reports; greenlight panels judge stage
transitions strictly against criteria locked *before* the work was built.

## The lifecycle (stage is first-class state)

`references/<project>/config.json` carries `stage`; every wave declares which stages it may run
in and self-skips otherwise. Transitions happen ONLY through gate waves:

| Transition | Gate wave | Rule |
|---|---|---|
| (nothing) → concept | `/pitch` | creates the project binding; docs only, no repo yet |
| concept → preproduction | `/concept-greenlight` | 2 independent seats (Fable + producer); pass/redesign/**kill** |
| preproduction → vertical-slice | `/preproduction-exit` | GDD + macro + tech plan + art bible locked; unlocks `/scaffold` (the repo is born here) |
| vertical-slice → production | `/slice-greenlight` | Fable panel judges STRICTLY vs criteria locked by `/slice-criteria` before the build |
| production → alpha | `/alpha-gate` | feature complete vs GDD + zero P0/P1 |
| alpha → beta | `/beta-gate` | content complete (art/audio/narrative audits) after `/content-lock`; debug-only regime begins |
| beta → gold | `/rc` | deterministic 100% P0-P1 / >90% P2 / >85% P3 math, full validation, Fable panel |
| gold → live | `/release` | packages + store prep; the HUMAN presses publish; stage flips only on explicit confirm |

`kill` and `redesign` are honored, normal outcomes — real studios cancel projects at these gates.

## Staffing (studio scale)

`staffing: solo | indie | studio` in the config controls fan-out. Waves address **roles**; the
merge table in `references/PROFILES.json` maps roles to the agent that plays them at each scale
(directors absorb their departments at solo; specialist pairs like writer/designer and
vfx/lighting collapse at indie). One wave library serves a solo dev and a full studio.

## The waves (39)

See [.claude/workflows/README.md](.claude/workflows/README.md) for the catalog and conventions.
Daily drivers: `/feature` (pod feature build), `/fix` (single surface), `/playtest` (weekly fun
check), `/review` (adversarially-verified findings), `/bug-hunt`, `/milestone`. Stage gates as
above. Live: `/update`, `/hotfix`, `/season`, `/postmortem`. Cross-stage: `/docs-currency`,
`/refactor` + `/engine-upgrade` (worktree-isolated), `/perf-budget`, `/asset-audit`,
`/test-backfill`, `/cert-preflight`, `/loc`, `/level`, `/narrative`, `/audio-pass`, `/bug-bash`.

`scripts/setup-claude.sh` symlinks every command into `~/.claude/commands/`.

## Non-negotiables

1. **The non-trusting gate.** The layer that does the work never grades itself. Author
   `gate_result` is recorded but ignored; only an independent `qa-gate-verifier` verdict advances
   a build, and only a panel that didn't build the thing advances a stage.
2. **Criteria before build.** Slice criteria are locked before the slice; milestone deliverables
   are defined before the review; the panel judges against the locked text, not vibes.
3. **Fun ≠ correctness.** Playtests emit experience findings (`playtest-report`); QA emits
   defects (`defect-inventory`, P0–P4). Never mixed.
4. **Waves never run git.** They edit the working tree and return a `commit_message`. Publishing,
   build promotion, and worktree merges are always human actions.
5. **Binary assets via generator scripts.** No hand-authored `.uasset` — editor-Python generators
   (`skills/ue5-editor-python`) are the reviewable artifact; `assets_authored[]` records them.
6. **Systems in C++, content in Blueprint.** GAS AttributeSets force this floor anyway;
   `systems_surface[]` is the contract and the BP side never invents APIs.
7. **Locked stack, never re-asked**: GAS, Enhanced Input, UMG+CommonUI, Niagara, Git LFS,
   subsystems-over-singletons, data-driven design, cosmetics-first monetization, 60 FPS on
   GTX 1060/PS5-equivalent with Nanite/Lumen off ([agents/_shared/STACK.md](agents/_shared/STACK.md)).
8. **Explicit model per agent call.** The Workflow tool inherits the session model (Fable) when
   `model:` is omitted — a cost bug. `models.json` routes tiers; `check-wave-mirrors.mjs` catches drift.
9. **Bind once.** `resolve-project` is the only place a wave learns the project; nothing
   hardcodes paths/stack. Stage + staffing + capabilities come from that one read.
10. **Fable judgment where it counts.** The three project-fate gates (concept-greenlight,
    slice-greenlight, rc) route their panel to the `greenlight` tier. Everything else runs on the
    cheapest tier that does the job honestly.

## What failure looks like, and what catches it

| Failure | Caught by |
|---|---|
| Author hands off broken code | independent gate re-run (`qa-gate-verifier`) |
| BP invents C++ APIs | structural block: no `systems_surface[]` → design-technical never invoked |
| Slice judged against moved goalposts | criteria file LOCKED before build; panel reads only it |
| A finding is plausible but wrong | adversarial skeptic must construct the failure or it's REFUTED |
| A test passes no matter what | `/test-backfill` proves fails-without/passes-with |
| A "fixed" crash isn't | fix accepted only when the re-driven repro is clean |
| Placeholder art ships | `/content-lock` art sweep; `/beta-gate` re-audit |
| Gold with open blockers | `/rc` computes the 100/90/85 math in code — no panel if it fails |
| Cert surprise at submission | `/cert-preflight` per-platform checklists; hardware-only items surfaced, never faked |
| Feature creep past alpha | stage guards in feature/level/narrative waves refuse; fix-wave enforces debug-only |
| Model-tier cost drift | `scripts/check-wave-mirrors.mjs` + `harness-check.sh` |
| Live cadence slips silently | two missed beats = escalation rule in the season calendar |

## Repo layout

| Area | Files |
|---|---|
| Control plane | [.claude/workflows/](.claude/workflows/) (39 waves + README), [templates/WORKFLOW.md](templates/WORKFLOW.md), [templates/commands/](templates/commands/) (39 shims) |
| Roster | [agents/](agents/README.md) (35 agents), [agents/_shared/](agents/_shared/) (WAVE-PROTOCOL, HANDOFF, STACK, PATTERNS, SECURITY_CHECKLIST, schemas/) |
| Binding | [references/PROFILES.json](references/PROFILES.json) (capabilities · stages · staffing merges), [references/_TEMPLATE/](references/_TEMPLATE/), [models.json](models.json) |
| Harness integrity | [scripts/harness-check.sh](scripts/harness-check.sh), [scripts/check-wave-mirrors.mjs](scripts/check-wave-mirrors.mjs), [scripts/new-workflow.sh](scripts/new-workflow.sh) |
| Project tooling | gamebook-init, gen-index, gen-claude-md, cook-smoke, automation-test, gauntlet-critical under [scripts/](scripts/); [hooks/](hooks/README.md) |
| Knowledge | [rules/](rules/README.md) (13), [guides/](guides/) (12), [quality/](quality/) (4), [skills/](skills/) (39 — incl. the procgen/survival/creature/civ mechanic set), [templates/docs/](templates/docs/) (16 stubs) |

## Starting a new game (the golden path)

```
/pitch a boomer-shooter where time moves when you shoot   → references/<project>/ born (concept)
/prototype the time-moves-when-you-shoot mechanic          → fun verdict
/concept-greenlight                                        → preproduction (or redesign/kill)
/gdd  /macro-design  /tech-plan  /art-bible                → the four locked artifacts
/preproduction-exit                                        → vertical-slice
/scaffold ~/games/<project>                                → the UE repo exists
/slice-criteria  →  /slice  →  /slice-greenlight           → production
/feature ...  /fix ...  /playtest  /milestone ...          → the production loop
/alpha-gate → /content-lock → /loc → /bug-bash → /beta-gate → /rc → /cert-preflight → /release
/season  /update  /hotfix  /postmortem                     → live ops
```
