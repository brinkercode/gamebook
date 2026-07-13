export const meta = {
  name: 'postmortem-wave',
  description: 'Blameless postmortem: factual timeline from logs → producer+liveops synthesis → docs/postmortems/ with action items each mapped to a wave. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Evidence' },
    { title: 'Synthesize' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-crash-correlator': 'haiku', 'producer': 'opus', 'liveops-producer': 'sonnet' }
const STAGES = ['gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const CRASHES = { type: 'object', required: ['crashes'], properties: {
  crashes: { type: 'array', items: { type: 'object', required: ['signature', 'kind'], properties: {
    signature: { type: 'string' }, kind: { type: 'string' }, count: { type: 'integer' }, first_seen: { type: 'string' }, log_excerpt: { type: 'string' } } } },
  sources_parsed: { type: 'array', items: { type: 'string' } }, unparsed_failures: { type: 'integer' } } }
const NOTES = { type: 'object', required: ['sections'], properties: {
  sections: { type: 'array', items: { type: 'object', required: ['title', 'content'], properties: { title: { type: 'string' }, content: { type: 'string' } } } } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

const incident = (A && (A.incident || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!incident) return { status: 'needsInput', reason: 'postmortem-wave needs an incident description (A.incident).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `postmortem-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }

phase('Evidence')
const evidence = await agent(
  `Gather the FACTUAL timeline for this incident on "${projectRef}": "${incident}". Parse Saved/Logs, CI output, stage_history, and recent handoffs into crash signatures + first_seen ordering. Facts only — no interpretation, no blame.`,
  { label: 'qa-crash-correlator', agentType: 'qa-crash-correlator', model: M['qa-crash-correlator'], schema: CRASHES, phase: 'Evidence' })

phase('Synthesize')
const liveops = await agent(
  `Live-ops perspective on "${incident}" for "${projectRef}": player impact (what players saw and for how long), comms that went out or should have, cadence impact (missed beats?). Sections with title+content. Blameless register — systems, not people.`,
  { label: 'liveops-producer', agentType: 'liveops-producer', model: M['liveops-producer'], schema: NOTES, phase: 'Synthesize' })
const report = await agent(
  `Write the blameless postmortem for "${incident}" on "${projectRef}" → docs/postmortems/<date>-<slug>.md. Structure: Timeline (from evidence: ${JSON.stringify((evidence && evidence.crashes) || []).slice(0, 3000)}), Player impact (from: ${JSON.stringify((liveops && liveops.sections) || []).slice(0, 2000)}), Root causes (systems not people), What worked, Action items — EACH with an owner-role from agents/README.md and the wave to run (/fix, /hotfix, /test-backfill, /perf-budget...). List the action items in decisions[] too.`,
  { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Synthesize' })
if (!report || report.status !== 'ready') return { status: 'needsRework', phase: 'Synthesize', blockers: report?.blockers || ['postmortem not written'] }

return {
  status: 'ready', project: projectRef, incident,
  action_items: report.decisions || [],
  files: report.files_changed,
  commit_message: report.commit_message || `docs(postmortem): ${incident}`,
  note: 'Postmortem written; each action item names its wave. No git run.',
}
