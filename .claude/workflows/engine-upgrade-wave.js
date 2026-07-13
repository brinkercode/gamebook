export const meta = {
  name: 'engine-upgrade-wave',
  description: 'Worktree-isolated engine/plugin bump: EngineAssociation + plugin versions + deprecation fixes → gate + cook in the worktree → API-change review. User merges. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Bump' },
    { title: 'Gate' },
    { title: 'Review' },
  ],
  requires: ['build'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'eng-build': 'sonnet', 'qa-gate-verifier': 'haiku', 'eng-director': 'opus' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, deps_added: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' },
  worktree_path: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } }, advisories: { type: 'array' } } }

const to = (A && (A.to || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!to) return { status: 'needsInput', reason: 'engine-upgrade-wave needs a target (engine version or plugin list) in A.to.' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo at stage '${project.stage}'` }
if (!(project.capabilities || []).includes('build')) return { status: 'skipped', reason: "profile lacks capability 'build'" }
if (['beta', 'gold'].includes(project.stage)) log(`⚠ engine upgrade at '${project.stage}' — highly unusual this close to ship; proceeding but flagging`)

phase('Bump')
const bumped = await agent(
  `Engine/plugin upgrade on "${projectRef}" to: "${to}". You are in an isolated worktree — report its absolute path in worktree_path. Steps: update .uproject EngineAssociation and/or plugin versions; fix every deprecation warning and API break the compile surfaces; note EVERY API change in decisions[] ('old → new, files touched'); any new plugin dependencies in deps_added with justification. Do not refactor beyond what the upgrade forces. Slice-gate; self-report advisory.`,
  { label: 'eng-build', agentType: 'eng-build', model: M['eng-build'], schema: HANDOFF, phase: 'Bump', isolation: 'worktree' })
if (!bumped || bumped.status !== 'ready') return { status: 'needsRework', phase: 'Bump', blockers: bumped?.blockers || ['upgrade did not complete'] }
const wt = bumped.worktree_path || ''
if (!wt) return { status: 'needsRework', phase: 'Bump', reason: 'upgrade did not report its worktree_path — cannot gate it' }

phase('Gate')
const verdict = await agent(
  `Independently gate the upgrade IN THE WORKTREE at "${wt}" (cd there first): \`make gate STEP=all\`, then \`make cook-smoke\` — an engine bump that compiles but does not cook is not done. IGNORE self-reports. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: verdict?.failed_step, logs: verdict?.logs_tail, worktree: wt }

phase('Review')
const review = await agent(
  `Review the API-change surface of the upgrade in worktree "${wt}". Decisions claimed: ${JSON.stringify(bumped.decisions || [])}. For each API change: behavioral risk (defaults changed? deprecated path silently different?), GAS/replication/input surfaces especially. Blockers as 'file:line — what — risk'. Review only.`,
  { label: 'eng-director', agentType: 'eng-director', model: M['eng-director'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers, worktree: wt }

return {
  status: 'ready', project: projectRef, to,
  worktree: wt, files: bumped.files_changed, api_changes: bumped.decisions || [], deps_added: bumped.deps_added || [], review,
  commit_message: bumped.commit_message || `chore: engine/plugin upgrade to ${to} (gated + cooked in worktree)`,
  note: `Upgrade verified in the isolated worktree at ${wt}. Merging is your call; consider updating references/${projectRef}/config.json engine_version after merge. No git run.`,
}
