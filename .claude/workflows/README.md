# The wave library — gamebook's deterministic control plane (L2)

A **wave** is a plain-JS workflow script run by the Claude Code Workflow tool. Waves assemble
feature pods from department/role agents (L3), enforce non-trusting gates, and return one
structured `status` envelope. The studio metaphor is load-bearing: waves are the producer's
process; `qa-gate-verifier` is QA; greenlight panels are the exec review that can kill a project.

## Conventions (enforced by `scripts/check-wave-mirrors.mjs` + `scripts/harness-check.sh`)

- `export const meta = { name, description, phases, requires }` — pure literal. `requires: []` = universal; else capability names from `references/PROFILES.json`.
- `const A = (typeof args === "string") ? JSON.parse(args) : (args || {})` — always.
- `const M = {...}` mirrors `models.json` role→model exactly. **Every `agent()` call passes `model: M['<role>']`** — omitting it inherits the session model (Fable): a cost bug.
- `const STAGES = [...]` — lifecycle stages the wave may run in (`[]` = any). Out-of-stage → `status: 'skipped'`.
- Staffing merges via a local `MERGE` subset of PROFILES.json; `const R = (r) => (MERGE[project.staffing]||{})[r] || r`.
- Status vocabulary: `ready | needsInput | needsRework | blocked | escalate | clean | skipped`.
- The author's `gate_result` is never read for gating; only an independent verifier verdict advances.
- Fun ≠ correctness: playtest findings use `playtest-report`, defects use `defect-inventory`.
- Only greenlight/gate waves write `stage` + `stage_history` in `references/<project>/config.json`; their panel verdict routes to `M['greenlight-panel']` (Fable) for the three project-fate gates (concept-greenlight, slice-greenlight, rc).
- **No git. Ever.** Waves edit the working tree and return a `commit_message`.
- Binary assets only via editor-Python generator scripts (`skills/ue5-editor-python`), recorded in `assets_authored[]`.

## Catalog (39 waves; each fronts a `/command` shim in `templates/commands/`)

| Stage | Wave | Does |
|---|---|---|
| concept | `pitch-wave` | concept interview → one-sheet + pitch deck + comparables → creates `references/<project>/` |
| concept | `prototype-wave` | graybox ONE mechanic → playtest verdict (fun/promising/flat/broken) |
| concept | `concept-greenlight-wave` | panel (Fable): pass/redesign/kill → stage: preproduction |
| preprod | `gdd-wave` | departments draft GDD sections in parallel → director synthesis |
| preprod | `macro-design-wave` | ~5-page macro design doc, locked at exit |
| preprod | `tech-plan-wave` | architecture + risk register (person-day quantified) |
| preprod | `art-bible-wave` | style guide + asset strategy (Megascans/marketplace-first) |
| preprod | `preproduction-exit-wave` | greenlight vs locked GDD+macro+plan → stage: vertical-slice |
| preprod | `scaffold-wave` | creates the UE project (gamebook-init), moves docs/ in |
| slice | `slice-criteria-wave` | lock slice acceptance criteria BEFORE building |
| slice | `slice-wave` | full pod builds the slice (systems→gate→content/level/audio/vfx→validate→playtest) |
| slice | `slice-greenlight-wave` | panel (Fable) judges STRICTLY vs locked criteria → stage: production |
| prod | `feature-wave` | pod feature build (the flagship — see file for house style) |
| prod | `fix-wave` | single-surface change; escalates when scope grows |
| prod | `level-wave` | blockout → encounter scripting → streaming |
| prod | `narrative-wave` | quest structure (designer) → prose (writer) → director review |
| prod | `audio-pass-wave` | Wwise events/banks batch + code-side integration |
| prod | `playtest-wave` | weekly-build playtest → experience findings (never defects) |
| prod | `milestone-wave` | milestone review → deficiency list → one repair → resubmit |
| prod | `review-wave` | dimension reviewers → adversarial verification → CONFIRMED-only report |
| prod | `bug-hunt-wave` | fan-out hunters → dedupe → optional fix → re-driven verification |
| prod | `perf-budget-wave` | stat capture vs performance-budgets.md → violations |
| prod | `asset-audit-wave` | LFS/naming/texture/redirector/orphan hygiene |
| prod | `test-backfill-wave` | every @critical test proven fails-without/passes-with |
| alpha | `alpha-gate-wave` | feature-complete audit + zero P0/P1 → stage: alpha |
| alpha | `content-lock-wave` | placeholder sweep; loc handoff unlocks |
| alpha/beta | `loc-wave` | stringtable extraction + localization pass |
| alpha–gold | `bug-bash-wave` | mass parallel hunt → P0–P4 triage |
| beta | `beta-gate-wave` | content-complete audit; debug-only regime → stage: beta |
| gold | `rc-wave` | 100% P0-P1 / 90% P2 / 85% P3 fixed + full validation → stage: gold (panel: Fable) |
| gold | `cert-preflight-wave` | per-platform compliance go/no-go (Steam/Deck/TRC/XR/Lotcheck) |
| gold | `release-wave` | shipping package + store assets + patch notes; HUMAN publishes |
| live | `update-wave` | bi-weekly content beat inside the season arc |
| live | `hotfix-wave` | crash inventory → root-cause → fix → re-driven repro verification |
| live | `season-wave` | season arc + content calendar planning |
| live | `postmortem-wave` | incident/launch retro |
| any | `docs-currency-wave` | docs-vs-reality drift check + repair |
| any | `refactor-wave` | worktree-isolated structural refactor → gate |
| any | `engine-upgrade-wave` | worktree-isolated engine/plugin bump → gate + cook |

New waves: `scripts/new-workflow.sh <name>` stamps from `templates/WORKFLOW.md`; register here and
add a `templates/commands/<name>.md` shim. `bash scripts/harness-check.sh` before committing.
