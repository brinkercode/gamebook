export const meta = {
  name: 'docs-currency-wave',
  description: 'Docs drift check: producer scans docs/ claims vs reality (read-only) → design-technical repairs drifted docs (docs only, never code). Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Drift' },
    { title: 'Repair' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'producer': 'opus', 'design-technical': 'sonnet' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']
const MERGE = { solo: { 'design-technical': 'design-director' }, indie: {}, studio: {} }
const M2 = { 'design-director': 'opus' }

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } }, advisories: { type: 'array' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo docs at stage '${project.stage}'` }

phase('Drift')
const drift = await agent(
  `Docs drift scan for "${projectRef}" — READ-ONLY. Compare claims vs reality: docs/GAMEPLAY_SYSTEMS.md vs the actual Source/ surface (via .claude/INDEX.json); docs/INPUT_MAP.md vs Config/ input + IMC data; docs/ROADMAP.md vs stage_history in the project config; docs/PERFORMANCE_BUDGETS.md vs quality baseline; README/setup docs vs the actual Makefile targets. Each drift item is a blocker: 'doc:section — claims X — reality Y'. result fail if any.`,
  { label: 'producer', agentType: 'producer', model: M['producer'], schema: REVIEW, phase: 'Drift' })
if (!drift) return { status: 'needsRework', phase: 'Drift', reason: 'drift scan returned nothing' }
if (drift.result === 'pass' || !(drift.blockers || []).length) return { status: 'clean', project: projectRef, note: 'Docs match reality. Nothing edited.' }

phase('Repair')
const author = (MERGE[project.staffing] || {})['design-technical'] || 'design-technical'
const repaired = await agent(
  `Repair these drifted docs on "${projectRef}" — DOCS ONLY, never touch code (if reality is wrong, note it as a blocker instead): ${JSON.stringify(drift.blockers)}. Update each doc to match reality precisely.`,
  { label: author, agentType: author, model: M[author] || M2[author], schema: HANDOFF, phase: 'Repair' })
if (!repaired || repaired.status !== 'ready') return { status: 'needsRework', phase: 'Repair', blockers: repaired?.blockers || ['repair failed'], drift: drift.blockers }

return {
  status: 'ready', project: projectRef,
  drift_found: drift.blockers, files: repaired.files_changed,
  code_suspect: repaired.blockers || [],
  commit_message: repaired.commit_message || `docs: currency pass — ${drift.blockers.length} drift item(s) fixed`,
  note: 'Docs repaired to match reality. No git run.',
}
