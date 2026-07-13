export const meta = {
  name: 'beta-gate-wave',
  description: 'Alpha→beta gate: content-complete audits (art, audio, narrative) + zero P0 → stage: beta, debug-only regime. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Complete' },
    { title: 'Panel' },
    { title: 'Transition' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'art-director': 'opus', 'audio-designer': 'sonnet', 'narrative-writer': 'sonnet', 'qa-crash-correlator': 'haiku', 'producer': 'opus' }
const STAGES = ['alpha']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } }, advisories: { type: 'array' } } }
const CRASHES = { type: 'object', required: ['crashes'], properties: {
  crashes: { type: 'array', items: { type: 'object', required: ['signature', 'kind'], properties: { signature: { type: 'string' }, kind: { type: 'string' }, count: { type: 'integer' } } } },
  unparsed_failures: { type: 'integer' } } }
const VERDICT = { type: 'object', required: ['verdict', 'criteria'], properties: {
  verdict: { type: 'string', enum: ['pass', 'redesign', 'kill'] },
  criteria: { type: 'array', items: { type: 'object', required: ['criterion', 'met'], properties: { criterion: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } } } },
  rationale: { type: 'string' }, redesign_directives: { type: 'array', items: { type: 'string' } }, next_stage: { type: ['string', 'null'] } } }
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
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `beta-gate runs at alpha but stage is '${project.stage}'` }
const caps = project.capabilities || []

phase('Complete')
const skipReview = Promise.resolve({ result: 'pass', blockers: [], advisories: ['capability absent — seat skipped'] })
const [art, audio, narrative, crashes] = await parallel([
  () => caps.includes('content')
    ? agent(`Content-complete audit (art) for "${projectRef}": zero placeholders anywhere, final materials/LODs on all shipping content, UI art final. Verify content-locked event exists in stage_history. Blockers per asset.`,
        { label: 'art-director', agentType: 'art-director', model: M['art-director'], schema: REVIEW, phase: 'Complete' })
    : skipReview,
  () => caps.includes('audio')
    ? agent(`Content-complete audit (audio) for "${projectRef}": every gameplay event has an implemented ${project.stack?.audio || 'Wwise'} event, banks complete, no missing-event log warnings in the latest automation run, mix pass done. Blockers per gap.`,
        { label: 'audio-designer', agentType: 'audio-designer', model: M['audio-designer'], schema: REVIEW, phase: 'Complete' })
    : skipReview,
  () => caps.includes('narrative')
    ? agent(`Content-complete audit (narrative) for "${projectRef}": all text final (no lorem/TODO lines), stringtables complete, VO lines recorded-or-explicitly-waived. Blockers per gap.`,
        { label: 'narrative-writer', agentType: 'narrative-writer', model: M['narrative-writer'], schema: REVIEW, phase: 'Complete' })
    : skipReview,
  () => agent(`Quick crash sweep of "${projectRef}" recent logs — the panel needs current P0 evidence.`,
    { label: 'qa-crash-correlator', agentType: 'qa-crash-correlator', model: M['qa-crash-correlator'], schema: CRASHES, phase: 'Complete' }),
])
const completeBlockers = [...((art && art.blockers) || []), ...((audio && audio.blockers) || []), ...((narrative && narrative.blockers) || [])]

phase('Panel')
const verdict = await agent(
  `Beta-gate panel for "${projectRef}" (judge tier — alpha→beta). Criteria: (1) art content-complete: ${art?.result}; (2) audio content-complete: ${audio?.result}; (3) narrative content-complete: ${narrative?.result}; (4) zero P0-class crash signatures open — crash sweep: ${JSON.stringify((crashes?.crashes || []).slice(0, 10))}. Blockers found: ${JSON.stringify(completeBlockers)}. Pass ONLY if all criteria met. On pass, note that beta = debug-only regime (stage guards in feature/level/narrative waves enforce it).`,
  { label: 'producer:panel', agentType: 'producer', model: M['producer'], schema: VERDICT, phase: 'Panel' })
if (!verdict) return { status: 'needsRework', phase: 'Panel', reason: 'panel returned nothing' }

phase('Transition')
if (verdict.verdict === 'pass' && !completeBlockers.length) {
  const t = await agent(
    `Record the stage transition for "${projectRef}": stage to "beta" in references/${projectRef}/config.json, stage_history append {gate: "beta-gate", verdict: "pass", from: "alpha", to: "beta", date: today}.`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Transition' })
  return { status: 'ready', verdict: 'pass', criteria: verdict.criteria, transition: t?.files_changed || [], commit_message: 'chore: beta gate PASS — content complete, debug-only regime begins', note: 'Stage is now beta. Only /fix, /hotfix, /bug-bash, /loc, /playtest and gates run past here.' }
}
return { status: 'ready', verdict: verdict.verdict === 'pass' ? 'redesign' : verdict.verdict, criteria: verdict.criteria, rationale: verdict.rationale, redesign_directives: [...(verdict.redesign_directives || []), ...completeBlockers], note: 'Gate not passed — complete the listed gaps and re-run.' }
