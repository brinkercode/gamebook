export const meta = {
  name: 'audio-pass-wave',
  description: 'Audio batch: audio-designer authors Wwise events/RTPC/banks → audio-technical wires the code side → independent build+automation gate. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Author' },
    { title: 'Wire' },
    { title: 'Gate' },
  ],
  requires: ['audio'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'audio-designer': 'sonnet', 'audio-technical': 'sonnet', 'qa-gate-verifier': 'haiku' }
const STAGES = ['vertical-slice', 'production']
const MERGE = { solo: { 'audio-technical': 'audio-designer' }, indie: { 'audio-technical': 'audio-designer' }, studio: {} }

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

const scope = (A && (A.scope || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!scope) return { status: 'needsInput', reason: 'audio-pass-wave needs a scope (which feature/area gets audio).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `audio-pass-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('audio')) return { status: 'skipped', reason: "profile lacks capability 'audio'" }
const mw = project.stack?.audio || 'Wwise'
const tech = (MERGE[project.staffing] || {})['audio-technical'] || 'audio-technical'

phase('Author')
const authored = await agent(
  `Author the ${mw} batch for "${scope}" on "${projectRef}": events (Play_/Stop_ convention), RTPC/switch/state mappings (names mirroring gameplay tags), bank assignment (per-level + Init + UI, never monolithic). Use skills/wwise-event-pipeline (WAAPI batch or work-unit XML; idempotent). Record every authored artifact in assets_authored[]. Slice-check your work; self-report advisory.`,
  { label: 'audio-designer', agentType: 'audio-designer', model: M['audio-designer'], schema: HANDOFF, phase: 'Author' })
if (!authored || authored.status !== 'ready') return { status: 'needsRework', phase: 'Author', blockers: authored?.blockers || ['audio authoring not ready'] }

phase('Wire')
const wired = await agent(
  `Wire the code side of the ${mw} batch for "${scope}": event posting from C++/BP through GAS gameplay cues where ability-driven (never raw PostEvent in ability BPs), AkComponent setup, bank load/unload strategy, RTPC binding to gameplay state. Authored events: ${JSON.stringify(authored.assets_authored || authored.files_changed)}. Respect audio memory/CPU budgets from quality/performance-budgets.md.`,
  { label: tech, agentType: tech, model: M[tech] || M['audio-technical'], schema: HANDOFF, phase: 'Wire' })
if (!wired || wired.status !== 'ready') return { status: 'needsRework', phase: 'Wire', blockers: wired?.blockers || ['audio wiring not ready'] }

phase('Gate')
const verdict = await agent(
  `Independently gate the audio work: \`make gate STEP=build\` then \`make automation-critical\` (events resolve, banks load, no missing-event warnings in the automation log). IGNORE self-reports. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: verdict?.failed_step, logs: verdict?.logs_tail }

return {
  status: 'ready', project: projectRef, scope,
  files: [...(authored.files_changed || []), ...(wired.files_changed || [])],
  assets: [...(authored.assets_authored || []), ...(wired.assets_authored || [])],
  commit_message: wired.commit_message || `feat(audio): ${scope}`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
