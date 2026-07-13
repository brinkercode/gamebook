export const meta = {
  name: 'refactor-wave',
  description: 'Worktree-isolated structural refactor: behavior preserved (tests untouched prove it) → gate in the worktree → eng review. User merges the worktree. Never runs git (worktree isolation is the harness).',
  phases: [
    { title: 'Resolve' },
    { title: 'Refactor' },
    { title: 'Gate' },
    { title: 'Review' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'eng-gameplay': 'sonnet', 'qa-gate-verifier': 'haiku', 'eng-director': 'opus' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' },
  worktree_path: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } }, advisories: { type: 'array' } } }

const target = (A && (A.target || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!target) return { status: 'needsInput', reason: 'refactor-wave needs a target (what to restructure).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo at stage '${project.stage}'` }

phase('Refactor')
const refactored = await agent(
  `Structural refactor on "${projectRef}": "${target}". BEHAVIOR MUST NOT CHANGE — do not touch tests (they are the proof), do not change the systems_surface contract unless the target explicitly says so. You are in an isolated worktree: report its absolute path in worktree_path. Record every structural decision in decisions[]. Slice-gate; self-report advisory.`,
  { label: 'eng-gameplay', agentType: 'eng-gameplay', model: M['eng-gameplay'], schema: HANDOFF, phase: 'Refactor', isolation: 'worktree' })
if (!refactored || refactored.status !== 'ready') return { status: 'needsRework', phase: 'Refactor', blockers: refactored?.blockers || ['refactor did not complete'] }
const wt = refactored.worktree_path || ''
if (!wt) return { status: 'needsRework', phase: 'Refactor', reason: 'refactor did not report its worktree_path — cannot gate it' }

phase('Gate')
const verdict = await agent(
  `Independently run the full gate IN THE WORKTREE at "${wt}" (cd there first): \`make gate STEP=all\` then \`make automation-critical\`. The untouched test suite passing proves behavior preserved. IGNORE self-reports. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: verdict?.failed_step, logs: verdict?.logs_tail, worktree: wt }

phase('Review')
const review = await agent(
  `Design review of the refactor in worktree "${wt}": is the new structure actually better (subsystems over singletons, thin handlers, data-driven), did the surface stay stable, any hidden behavior change the tests would miss? Blockers as 'file:line — what — fix'. Review only.`,
  { label: 'eng-director', agentType: 'eng-director', model: M['eng-director'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers, worktree: wt }

return {
  status: 'ready', project: projectRef, target,
  worktree: wt, files: refactored.files_changed, decisions: refactored.decisions || [], review,
  commit_message: refactored.commit_message || `refactor: ${target} (behavior preserved — untouched suite green)`,
  note: `Refactor verified in the isolated worktree at ${wt}. Merging that branch is your call — the wave ran no git.`,
}
