export const meta = {
  name: 'update-wave',
  description: 'Live content beat: liveops plan → content batch → independent gate + repair → full validation → patch notes + player comms. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Verify' },
    { title: 'Notes' },
  ],
  requires: ['content'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'liveops-producer': 'sonnet', 'design-technical': 'sonnet', 'design-level': 'sonnet', 'qa-gate-verifier': 'haiku', 'release-manager': 'sonnet', 'community-writer': 'sonnet' }
const STAGES = ['live']
const MERGE = { solo: { 'design-technical': 'design-director', 'design-level': 'design-director', 'community-writer': 'release-manager' }, indie: { 'community-writer': 'liveops-producer' }, studio: {} }
const M2 = { 'design-director': 'opus' }

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
const PLAN = { type: 'object', required: ['plan'], properties: {
  plan: { type: 'string' }, fits_calendar: { type: 'boolean' }, needs_levels: { type: 'boolean' }, beat_size: { type: 'string' } } }

const beat = (A && (A.beat || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!beat) return { status: 'needsInput', reason: 'update-wave needs a beat description (A.beat).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `update-wave runs at live but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('content')) return { status: 'skipped', reason: "profile lacks capability 'content'" }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
const MODEL = (r) => M[r] || M2[r]

phase('Plan')
const plan = await agent(
  `Plan this live beat for "${projectRef}": "${beat}". Check it against the season calendar (docs/seasons/, latest) — does it fit the current arc and the bi-weekly cadence? Scope it to ship on the beat (a reliable bi-weekly beat beats an ambitious late one). needs_levels honest. beat_size: small/medium/large.`,
  { label: 'liveops-producer', agentType: 'liveops-producer', model: M['liveops-producer'], schema: PLAN, phase: 'Plan' })
if (!plan) return { status: 'needsRework', phase: 'Plan', reason: 'plan returned nothing' }
if (plan.fits_calendar === false) log('⚠ beat does not fit the season calendar — proceeding but flagging in the report')

phase('Build')
const [content, level] = await parallel([
  () => agent(`Build the live-beat content for "${projectRef}": "${beat}". Plan: ${plan.plan}. Live regime: balance/data/cosmetics/events via DataTables + Data Assets + editor-Python; NO new systems (that would be a /feature and features need a stage discussion at live). Slice-gate; self-report advisory.`,
    { label: 'design-technical', agentType: R('design-technical'), model: MODEL(R('design-technical')), schema: HANDOFF, phase: 'Build' }),
  () => plan.needs_levels
    ? agent(`Level content for the live beat "${beat}" per plan: ${plan.plan}. Editor-Python placement; thin BP scripting.`,
        { label: 'design-level', agentType: R('design-level'), model: MODEL(R('design-level')), schema: HANDOFF, phase: 'Build' })
    : Promise.resolve({ schema_version: '2', agent: 'design-level', status: 'skipped', files_changed: [] }),
])
if (!content || content.status !== 'ready') return { status: 'needsRework', phase: 'Build', blockers: content?.blockers || ['content build not ready'] }

phase('Verify')
let v = await agent(
  `Independent full validation of the live beat: \`make gate\`, \`make cook-smoke\`, \`make automation-critical\` in order, stop at first failure. IGNORE self-reports. Do not edit.`,
  { label: 'gate:beat', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Verify' })
if (!v || v.result !== 'pass') {
  log(`beat gate failed at ${v?.failed_step}; one focused repair`)
  const repaired = await agent(
    `Repair the live-beat content. Independent gate failed at: ${v?.failed_step}.\n${v?.logs_tail || ''}\nFix only what is needed.`,
    { label: 'design-technical:repair', agentType: R('design-technical'), model: MODEL(R('design-technical')), schema: HANDOFF, phase: 'Verify' })
  v = await agent(`Re-validate: \`make gate\`, \`make cook-smoke\`, \`make automation-critical\`. Do not edit.`,
    { label: 'gate:beat:2', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Verify' })
  if (!v || v.result !== 'pass') return { status: 'needsRework', phase: 'Verify', failed: v?.failed_step, logs: v?.logs_tail }
  if (repaired) content.files_changed = [...(content.files_changed || []), ...(repaired.files_changed || [])]
}

phase('Notes')
const [notes, comms] = await parallel([
  () => agent(`Patch notes for the live beat "${beat}" on "${projectRef}" → docs/release/PATCH_NOTES.md (append dated section). Factual, player-relevant changes only.`,
    { label: 'release-manager', agentType: 'release-manager', model: M['release-manager'], schema: HANDOFF, phase: 'Notes' }),
  () => agent(`Player-facing comms draft for "${beat}" → docs/community/beat-<date>.md. Two-way register: what changed, why players asked for it, where to give feedback. No hype padding.`,
    { label: R('community-writer'), agentType: R('community-writer'), model: M[R('community-writer')] || M['community-writer'], schema: HANDOFF, phase: 'Notes' }),
])

const files = [...(content.files_changed || []), ...(level?.files_changed || []), ...((notes && notes.files_changed) || []), ...((comms && comms.files_changed) || [])]
return {
  status: 'ready', project: projectRef, beat, fits_calendar: plan.fits_calendar !== false,
  files,
  commit_message: content.commit_message || `feat(live): ${beat}`,
  note: 'Beat built + validated. Deploy through your SteamPipe branch flow; promotion stays your button. No git run.',
}
