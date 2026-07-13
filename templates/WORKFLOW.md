# Workflow scaffold — `.claude/workflows/<name>-wave.js`

Copy this shape when stamping a new wave. It is plain JavaScript (no TypeScript), runs in an
async context, and must begin with a pure-literal `meta` block. See `.claude/workflows/README.md`
for conventions, tier routing, and the stage/staffing gates.

```js
export const meta = {
  name: '<name>-wave',
  description: '<one line — shown in the permission dialog>. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Author' },
    { title: 'Verify' },
  ],
  requires: [],           // [] = universal; e.g. ['multiplayer'] gates on a capability
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// models.json mirror — check-wave-mirrors.mjs verifies each role→model against models.json
const M = { 'resolve-project': 'haiku', 'eng-gameplay': 'sonnet', 'qa-gate-verifier': 'haiku' }

// stage guard — which lifecycle stages this wave may run in ([] = any stage)
const STAGES = ['production', 'alpha']

const projectRef = (A && A.project) || '_TEMPLATE'

// 1. Bind the project ONCE (references/<project>/config.json). Never hardcode a path.
phase('Resolve')
const project = await agent(`Resolve binding profile for "${projectRef}".`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT /* agents/_shared/schemas/project.schema.json */ })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch first.` }
if (STAGES.length && !STAGES.includes(project.stage)) return { status: 'skipped', reason: `wave runs in [${STAGES}] but project is at '${project.stage}'` }
// capability gate: if meta.requires declared ['x'], self-skip when the profile lacks it
// if (!(project.capabilities || []).includes('x')) return { status: 'skipped', reason: "lacks capability 'x'" }

// 2. Author (structural work) on the author tier. The author self-reports, but...
phase('Author')
const built = await agent(`Do the scoped work for "${projectRef}". Report files_changed + a commit_message.`,
  { label: 'author', agentType: 'eng-gameplay', model: M['eng-gameplay'], schema: HANDOFF, phase: 'Author' })
if (!built || built.status !== 'ready') return { status: 'needsRework', phase: 'Author', blockers: built?.blockers }

// 3. ...the author never grades itself. A SEPARATE verifier returns the only verdict that gates.
phase('Verify')
const verdict = await agent(`Run \`make gate\` (STEP=all) against ${JSON.stringify(built.files_changed)}. Ignore any self-reported gate_result. Report pass/fail + logs_tail. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Verify' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', failed_step: verdict?.failed_step, logs_tail: verdict?.logs_tail }

// 4. Decide. Never run git — return a commit message for the user.
return { status: 'ready', files_changed: built.files_changed, commit_message: built.commit_message }
```

## Checklist before you ship a wave

- [ ] `meta` is a pure literal (no variables/calls); phase titles match `phase()` calls; `meta.requires` is declared (`[]` = universal).
- [ ] The args-normalization line is present (`const A = (typeof args ...)`), and the wave returns a `status`.
- [ ] Every `agent()` passes `agentType` + `model: M['<role>']` + `schema` — omitting `model` inherits the session model (Fable) and is a cost bug.
- [ ] `const M = {...}` mirrors `models.json` exactly (verified by `scripts/check-wave-mirrors.mjs`); no write-deciding step on a cheap tier.
- [ ] A `STAGES` guard is declared (`[]` = any stage); stage transitions happen ONLY in greenlight/gate waves, which route their panel to `M['greenlight-panel']`.
- [ ] The author's `gate_result` is **not** read for gating — a separate verifier is.
- [ ] Fun and correctness never share a schema: playtest findings → `playtest-report`, defects → `defect-inventory`.
- [ ] No git anywhere; the wave returns a commit message.
- [ ] Project binding happens once via `resolve-project`; nothing else hardcodes stack/paths.
- [ ] `bash scripts/harness-check.sh` passes.
