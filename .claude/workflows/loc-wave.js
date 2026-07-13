export const meta = {
  name: 'loc-wave',
  description: 'Localization pass: stringtable completeness (no hardcoded text) → loc kit update per language → build/index gate. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Extract' },
    { title: 'Kit' },
    { title: 'Gate' },
  ],
  requires: ['narrative'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'narrative-writer': 'sonnet', 'release-manager': 'sonnet', 'qa-gate-verifier': 'haiku' }
const STAGES = ['alpha', 'beta']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }

const projectRef = (A && A.project) || '_TEMPLATE'
const languages = Array.isArray(A.languages) && A.languages.length ? A.languages : ['en']

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `loc-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('narrative')) return { status: 'skipped', reason: "profile lacks capability 'narrative'" }

phase('Extract')
const extract = await agent(
  `Stringtable completeness pass on "${projectRef}": every player-facing string lives in a stringtable (FText + LOCTEXT/stringtable refs — grep C++/BP-data for hardcoded literals and UMG text blocks with inline text); VO lines carry CUE/CONTEXT fields. Move violations into stringtables (that IS this seat's edit scope). Report per-category coverage in decisions[].`,
  { label: 'narrative-writer', agentType: 'narrative-writer', model: M['narrative-writer'], schema: HANDOFF, phase: 'Extract' })
if (!extract || extract.status !== 'ready') return { status: 'needsRework', phase: 'Extract', blockers: extract?.blockers || ['extraction failed'] }

phase('Kit')
const kit = await agent(
  `Update the localization kit for "${projectRef}" (docs/loc/LOC_KIT.md) for languages: ${languages.join(', ')}. Per-language status table (strings total / translated / pending), glossary additions from new strings, do-not-translate list current, context notes for ambiguous lines. Wwise Sound Voice structure note for VO languages.`,
  { label: 'release-manager', agentType: 'release-manager', model: M['release-manager'], schema: HANDOFF, phase: 'Kit' })

phase('Gate')
const verdict = await agent(
  `Light gate: \`make gate STEP=build\` then \`make index\` — stringtable references resolve, project compiles. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: verdict?.failed_step, logs: verdict?.logs_tail }

return {
  status: 'ready', project: projectRef, languages,
  files: [...(extract.files_changed || []), ...((kit && kit.files_changed) || [])],
  coverage: extract.decisions || [],
  commit_message: extract.commit_message || `chore(loc): stringtable pass + kit update (${languages.join(', ')})`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
