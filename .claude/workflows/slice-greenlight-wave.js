export const meta = {
  name: 'slice-greenlight-wave',
  description: 'Vertical-slice project-fate gate: fresh independent validation, then a Fable-tier panel judges STRICTLY against the LOCKED criteria — pass advances stage to production. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Validate' },
    { title: 'Panel' },
    { title: 'Transition' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-gate-verifier': 'haiku', 'greenlight-panel': 'fable', 'producer': 'opus' }
const STAGES = ['vertical-slice']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array' }, notes: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }
const VERDICT = { type: 'object', required: ['verdict', 'criteria'], properties: {
  verdict: { type: 'string', enum: ['pass', 'redesign', 'kill'] },
  criteria: { type: 'array', items: { type: 'object', required: ['criterion', 'met'], properties: { criterion: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } } } },
  rationale: { type: 'string' }, conditions: { type: 'array', items: { type: 'string' } },
  redesign_directives: { type: 'array', items: { type: 'string' } }, next_stage: { type: ['string', 'null'] } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + config.local.json; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `slice-greenlight runs at vertical-slice but stage is '${project.stage}'` }

phase('Validate')
const validation = await agent(
  `Fresh full validation of the slice build — never trust stale results. Run in order, stop at first failure: \`make cook-smoke\`, \`make automation-critical\`, \`make gate\`. Report per-step + logs_tail. Do NOT edit.`,
  { label: 'validate', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Validate' })
if (!validation || validation.result !== 'pass') return { status: 'needsRework', phase: 'Validate', failed: validation?.failed_step, logs: validation?.logs_tail, reason: 'slice does not validate — fix before convening the panel' }

phase('Panel')
const verdict = await agent(
  `You chair the vertical-slice greenlight — a project-fate gate. Judge STRICTLY against docs/SLICE_CRITERIA.md, criterion by criterion (the file is LOCKED; criteria added after the build do not count). Evidence available: this fresh validation ${JSON.stringify(validation.steps)}, the latest playtest report (find under .claude/handoffs/ or docs/), and the build itself (read code/docs as needed). Real studios kill projects here — pass only if the criteria are demonstrably met; redesign with specific directives if fixable; kill if the concept failed fundamentally.`,
  { label: 'greenlight-panel', agentType: 'design-director', model: M['greenlight-panel'], schema: VERDICT, phase: 'Panel' })
if (!verdict) return { status: 'needsRework', phase: 'Panel', reason: 'panel returned nothing' }

phase('Transition')
if (verdict.verdict === 'pass') {
  const t = await agent(
    `Record the stage transition for "${projectRef}": edit references/${projectRef}/config.json setting stage to "production" and append to stage_history: {gate: "slice-greenlight", verdict: "pass", from: "vertical-slice", to: "production", date: today}. Report files_changed.`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Transition' })
  return { status: 'ready', verdict: verdict.verdict, criteria: verdict.criteria, rationale: verdict.rationale, conditions: verdict.conditions || [], transition: t?.files_changed || [], commit_message: 'chore: slice greenlight PASS — stage advanced to production', note: 'Stage is now production. /feature is unlocked.' }
}
return { status: 'ready', verdict: verdict.verdict, criteria: verdict.criteria, rationale: verdict.rationale, redesign_directives: verdict.redesign_directives || [], note: verdict.verdict === 'kill' ? 'Panel voted kill — an honored outcome. Present the rationale to the user plainly.' : 'Redesign directives returned — address them and re-run /slice then /slice-greenlight.' }
