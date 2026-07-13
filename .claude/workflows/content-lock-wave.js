export const meta = {
  name: 'content-lock-wave',
  description: 'Alpha content lock: placeholder sweep (art) + asset hygiene (QA) must both be clean → lock recorded in stage_history, localization kit unlocked. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Sweep' },
    { title: 'Lock' },
  ],
  requires: ['content'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'art-director': 'opus', 'qa-lead': 'sonnet', 'producer': 'opus', 'release-manager': 'sonnet' }
const STAGES = ['alpha']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } }, advisories: { type: 'array' } } }
const AUDIT = { type: 'object', required: ['result', 'checks'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  checks: { type: 'array', items: { type: 'object', required: ['check', 'result', 'violations'], properties: {
    check: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] }, violations: { type: 'array', items: { type: 'string' } } } } },
  summary: { type: 'string' } } }
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
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `content-lock runs at alpha but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('content')) return { status: 'skipped', reason: "profile lacks capability 'content'" }

phase('Sweep')
const [placeholders, hygiene] = await parallel([
  () => agent(`Placeholder sweep of "${projectRef}" Content/: gray/blockout meshes in shipping maps, TODO/WIP/TEMP-named assets, default-material surfaces, missing LODs on hero assets, engine-default textures in final content. Every placeholder is a blocker ('asset path — what — replacement needed'). Judge against docs/ART_BIBLE.md. Review only.`,
    { label: 'art-director', agentType: 'art-director', model: M['art-director'], schema: REVIEW, phase: 'Sweep' }),
  () => agent(`Asset hygiene check of "${projectRef}" (asset-audit shape): lfs-coverage, naming, redirectors, orphans. Read-mostly; report only.`,
    { label: 'qa-lead', agentType: 'qa-lead', model: M['qa-lead'], schema: AUDIT, phase: 'Sweep' }),
])
const blockers = [...((placeholders && placeholders.result === 'fail' && placeholders.blockers) || []),
  ...(((hygiene && hygiene.checks) || []).flatMap((c) => c.result === 'fail' ? c.violations : []))]
if (blockers.length) return { status: 'needsRework', phase: 'Sweep', blockers, note: 'Content cannot lock with placeholders/hygiene failures — fix via /fix or /level, then re-run.' }

phase('Lock')
const [lock, kit] = await parallel([
  () => agent(`Record the content lock for "${projectRef}": append to stage_history in references/${projectRef}/config.json: {event: "content-locked", date: today}. This is an event, NOT a stage change — stage stays "alpha".`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Lock' }),
  () => agent(`Write the localization kit stub for "${projectRef}" at docs/loc/LOC_KIT.md: string-freeze notice (content is locked), glossary skeleton from docs/GDD.md terms, character voice notes from docs/NARRATIVE.md if present, do-not-translate list (proper nouns, tags).`,
    { label: 'release-manager', agentType: 'release-manager', model: M['release-manager'], schema: HANDOFF, phase: 'Lock' }),
])

return {
  status: 'ready', project: projectRef,
  locked: true,
  files: [...((lock && lock.files_changed) || []), ...((kit && kit.files_changed) || [])],
  commit_message: 'chore: content lock — placeholders clean, loc kit opened',
  note: 'Content locked: additions past this point are defects. /loc is unlocked; /beta-gate is next.',
}
