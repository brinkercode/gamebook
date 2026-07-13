export const meta = {
  name: 'narrative-wave',
  description: 'Narrative content: designer builds branching structure → writer fills prose → director voice review → optional VO event stubs → light gate. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Structure' },
    { title: 'Prose' },
    { title: 'Review' },
    { title: 'Gate' },
  ],
  requires: ['narrative'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'narrative-designer': 'sonnet', 'narrative-writer': 'sonnet', 'design-director': 'opus', 'audio-designer': 'sonnet', 'qa-gate-verifier': 'haiku' }
const STAGES = ['vertical-slice', 'production']
const MERGE = { solo: { 'narrative-writer': 'narrative-designer' }, indie: { 'narrative-writer': 'narrative-designer' }, studio: {} }

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  assets_authored: { type: 'array', items: { type: 'object' } }, decisions: { type: 'array' },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } }, advisories: { type: 'array' } } }

const scope = (A && (A.scope || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!scope) return { status: 'needsInput', reason: 'narrative-wave needs a scope (which quest/arc/character).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `narrative-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('narrative')) return { status: 'skipped', reason: "profile lacks capability 'narrative'" }
const writer = (MERGE[project.staffing] || {})['narrative-writer'] || 'narrative-writer'

phase('Structure')
const structure = await agent(
  `Build the narrative STRUCTURE for "${scope}" on "${projectRef}": branching topology, quest architecture, flags/conditions, pacing beats — as DataTable CSVs / dialogue-tree data (via editor-Python where binary). Write structural stubs for every line ("X is surprised; player chooses defiance/submission"), NOT prose — the writer owns words. Consult docs/GDD.md + the narrative tone in config. Design owns the player; writing owns the characters.`,
  { label: 'narrative-designer', agentType: 'narrative-designer', model: M['narrative-designer'], schema: HANDOFF, phase: 'Structure' })
if (!structure || structure.status !== 'ready') return { status: 'needsRework', phase: 'Structure', blockers: structure?.blockers || ['structure not ready'] }

phase('Prose')
const prose = await agent(
  `Fill the narrative structure with PROSE for "${scope}": dialogue, barks, codex text. Every line carries CUE/CONTEXT/INFLECTION/EFFECT fields (feeds VO + localization). Structures to fill: ${JSON.stringify(structure.files_changed)}. Match the character voices and tone from config/docs; do not change the structure — hand back status:blocked if it cannot carry the story.`,
  { label: writer, agentType: writer, model: M[writer] || M['narrative-writer'], schema: HANDOFF, phase: 'Prose' })
if (!prose || prose.status !== 'ready') return { status: 'needsRework', phase: 'Prose', blockers: prose?.blockers || ['prose not ready'] }

phase('Review')
const review = await agent(
  `Voice + pillar review of the narrative work for "${scope}": consistency of character voice, tone match to config.design.narrative, pillar traceability, structural coherence (dead branches, unreachable flags). Blockers as 'file/line — what — fix'. Review only.`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers }

let vo = null
if (A.vo) {
  vo = await agent(
    `Create ${project.stack?.audio || 'Wwise'} Sound Voice event stubs for the new VO lines (Play_VO_<Char>_<LineId> convention, one file per language per line). Lines: from ${JSON.stringify(prose.files_changed)}. Record in assets_authored[].`,
    { label: 'audio-designer', agentType: 'audio-designer', model: M['audio-designer'], schema: HANDOFF, phase: 'Review' })
}

phase('Gate')
const verdict = await agent(
  `Light gate for narrative data: run \`make gate STEP=build\` then \`make index\` (stringtable/data references resolve, project still compiles). Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: verdict?.failed_step, logs: verdict?.logs_tail }

const files = [...(structure.files_changed || []), ...(prose.files_changed || []), ...((vo && vo.files_changed) || [])]
return {
  status: 'ready', project: projectRef, scope, files, review,
  commit_message: prose.commit_message || `feat(narrative): ${scope}`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
