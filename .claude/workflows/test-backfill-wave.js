export const meta = {
  name: 'test-backfill-wave',
  description: 'Prove every @critical Functional Test actually tests something: fails-without/passes-with verification, weak tests strengthened, suite re-gated. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Inventory' },
    { title: 'Strengthen' },
    { title: 'Gate' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-lead': 'sonnet', 'qa-gate-verifier': 'haiku' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const INVENTORY = { type: 'object', required: ['tests'], properties: {
  tests: { type: 'array', items: { type: 'object', required: ['name', 'verdict'], properties: {
    name: { type: 'string' }, path: { type: 'string' },
    verdict: { type: 'string', enum: ['strong', 'weak', 'unknown'] },
    weakness: { type: 'string' } } } },
  total: { type: 'integer' }, capped: { type: 'boolean' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  tests_added: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo at stage '${project.stage}'` }

phase('Inventory')
const inv = await agent(
  `Inventory the @critical Functional Tests in "${projectRef}" (Source/ + Content/Tests per quality/playtest-and-automation.md). For each (cap 10 per run; set capped:true and total honestly if more): judge strong vs weak by READING it — a weak test would pass even if the feature were broken (no assertion on the actual behavior, asserts a constant, never awaits the latent action, wrong tag). Name the weakness precisely. Do not edit anything in this phase.`,
  { label: 'qa-lead:inventory', agentType: 'qa-lead', model: M['qa-lead'], schema: INVENTORY, phase: 'Inventory' })
if (!inv || !inv.tests) return { status: 'needsRework', phase: 'Inventory', reason: 'inventory returned nothing' }
const weak = inv.tests.filter((t) => t.verdict === 'weak')
if (inv.capped) log(`inventory capped at 10 of ${inv.total} — re-run for the rest`)
if (!weak.length) return { status: 'clean', project: projectRef, tests: inv.tests, note: 'Every inspected @critical test asserts real behavior. Nothing edited.' }

phase('Strengthen')
log(`${weak.length} weak test(s) to strengthen`)
const fixed = await agent(
  `Strengthen these weak Functional Tests so each fails-without/passes-with the behavior it covers: ${JSON.stringify(weak)}. Rewrite assertions to observe actual gameplay state (attributes, tags, actor state), await latent actions properly, keep @critical tags. Do not weaken coverage; do not touch strong tests.`,
  { label: 'qa-lead:strengthen', agentType: 'qa-lead', model: M['qa-lead'], schema: HANDOFF, phase: 'Strengthen' })
if (!fixed || fixed.status !== 'ready') return { status: 'needsRework', phase: 'Strengthen', blockers: fixed?.blockers || ['strengthening failed'] }

phase('Gate')
const verdict = await agent(
  `Independently run \`make automation-critical\` then \`make gate\` — the strengthened suite must still pass against the current code. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: verdict?.failed_step, logs: verdict?.logs_tail, note: 'A strengthened test fails — either the test found a real bug (route to /bug-hunt) or the rewrite overshot.' }

return {
  status: 'ready', project: projectRef,
  inspected: inv.tests.length, weak_found: weak.length, capped: !!inv.capped,
  files: fixed.files_changed,
  commit_message: fixed.commit_message || `test: strengthen ${weak.length} weak @critical test(s) to fail-without/pass-with`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
