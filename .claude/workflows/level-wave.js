export const meta = {
  name: 'level-wave',
  description: 'Level/encounter build: design-level authors blockout+encounters+streaming via editor-Python → independent cook/automation gate (one repair) → design pacing review. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Build' },
    { title: 'Gate' },
    { title: 'Review' },
  ],
  requires: ['levels'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'design-level': 'sonnet', 'qa-gate-verifier': 'haiku', 'design-director': 'opus' }
const STAGES = ['vertical-slice', 'production']
const MERGE = { solo: { 'design-level': 'design-director' }, indie: {}, studio: {} }

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  gate_result: { type: 'string', enum: ['pass', 'fail'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  assets_authored: { type: 'array', items: { type: 'object' } }, decisions: { type: 'array' },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } }, advisories: { type: 'array' } } }

const levelDesc = (A && (A.level || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!levelDesc) return { status: 'needsInput', reason: 'level-wave needs a level/encounter description (A.level).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `level-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('levels')) return { status: 'skipped', reason: "profile lacks capability 'levels'" }
const author = (MERGE[project.staffing] || {})['design-level'] || 'design-level'

phase('Build')
const built = await agent(
  `Build level/encounter work for "${projectRef}": "${levelDesc}". Blockout geometry + actor placement via editor-Python generator scripts (skills/ue5-editor-python resources/level-editing.md — deterministic coordinates, idempotent respawn-by-label); encounter scripting as thin BP over existing C++ systems; navmesh + streaming config in the same scripts. Consult docs/MACRO_DESIGN.md pacing. assets_authored[] mandatory. Slice-gate your files; self-report advisory.`,
  { label: author, agentType: author, model: author === 'design-director' ? M['design-director'] : M['design-level'], schema: HANDOFF, phase: 'Build' })
if (!built || built.status !== 'ready') return { status: 'needsRework', phase: 'Build', blockers: built?.blockers || ['level build not ready'] }

phase('Gate')
let v = await agent(
  `Independently gate the level work: run \`make cook-smoke\` then \`make automation-critical\` then \`make gate\`, stop at first failure. Changed: ${JSON.stringify(built.files_changed)}. IGNORE self-reports. Do not edit.`,
  { label: 'gate:level', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!v || v.result !== 'pass') {
  log(`level gate failed at ${v?.failed_step}; one focused repair`)
  const repaired = await agent(
    `Repair the level work. Independent gate failed at: ${v?.failed_step}.\n${v?.logs_tail || ''}\nFix only what is needed.`,
    { label: `${author}:repair`, agentType: author, model: author === 'design-director' ? M['design-director'] : M['design-level'], schema: HANDOFF, phase: 'Gate' })
  v = await agent(
    `Re-gate after repair: \`make cook-smoke\`, \`make automation-critical\`, \`make gate\`. Do not edit.`,
    { label: 'gate:level:2', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
  if (!v || v.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: v?.failed_step, logs: v?.logs_tail }
  if (repaired) built.files_changed = [...(built.files_changed || []), ...(repaired.files_changed || [])]
}

phase('Review')
const review = await agent(
  `Pacing/flow review of the level work vs docs/MACRO_DESIGN.md and the design pillars: encounter spacing, sightlines/readability intent, streaming boundaries, difficulty position on the curve. Blockers as 'asset/script — what — fix'. Review only.`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers }

return {
  status: 'ready', project: projectRef, level: levelDesc,
  files: built.files_changed, assets: built.assets_authored || [], review,
  commit_message: built.commit_message || `feat(level): ${levelDesc}`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
