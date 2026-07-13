export const meta = {
  name: 'season-wave',
  description: 'Season planning: content arc (design) + capacity/risk (production) → tiered-confidence calendar with bi-weekly beats. Docs only. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Arc' },
    { title: 'Calendar' },
  ],
  requires: ['content'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'design-director': 'opus', 'producer': 'opus', 'liveops-producer': 'sonnet' }
const STAGES = ['live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const ARC = { type: 'object', required: ['arc'], properties: {
  arc: { type: 'string' }, pillars: { type: 'array', items: { type: 'string' } },
  marquee: { type: 'array', items: { type: 'string' } }, cadence_hooks: { type: 'array', items: { type: 'string' } } } }
const CAPACITY = { type: 'object', required: ['assessment'], properties: {
  assessment: { type: 'string' }, fits: { type: 'boolean' },
  risks: { type: 'array', items: { type: 'string' } }, cut_candidates: { type: 'array', items: { type: 'string' } } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

const theme = (A && A.theme) || ''
const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `season-wave runs at live but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('content')) return { status: 'skipped', reason: "profile lacks capability 'content'" }

phase('Arc')
const [arc, capacity] = await parallel([
  () => agent(`Design the next season arc for "${projectRef}"${theme ? ` (theme: ${theme})` : ''}: narrative/content arc over a 6-10 week season, pillars it serves, marquee content (1-2 big drops), cadence hooks (what keeps the bi-weekly beats fresh). Read docs/seasons/ for what came before; do not repeat the last arc's shape.`,
    { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: ARC, phase: 'Arc' }),
  () => agent(`Capacity + risk pass for the next season of "${projectRef}" at '${project.staffing}' staffing: what realistically fits a 6-10 week arc with bi-weekly beats? Risks in person-days; cut candidates ordered (what drops first when a beat slips — a reliable beat beats an ambitious late one).`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: CAPACITY, phase: 'Arc' }),
])
if (!arc) return { status: 'needsRework', phase: 'Arc', reason: 'arc returned nothing' }

phase('Calendar')
const calendar = await agent(
  `Merge arc + capacity into the season calendar for "${projectRef}" → docs/seasons/SEASON_<next-number>.md. Structure: theme + pillars; TIERED CONFIDENCE calendar — first 6-8 weeks as concrete dated bi-weekly beats (each sized small/medium/large and mapped to /update scope), remainder directional only; marquee drop placement; cut-order list from production; the two-missed-beats escalation rule stated. Arc: ${JSON.stringify(arc)}. Capacity: ${JSON.stringify(capacity)}.`,
  { label: 'liveops-producer', agentType: 'liveops-producer', model: M['liveops-producer'], schema: HANDOFF, phase: 'Calendar' })
if (!calendar || calendar.status !== 'ready') return { status: 'needsRework', phase: 'Calendar', blockers: calendar?.blockers || ['calendar not written'] }

return {
  status: 'ready', project: projectRef,
  arc: arc.arc, marquee: arc.marquee || [], fits: capacity ? capacity.fits : null,
  risks: (capacity && capacity.risks) || [],
  files: calendar.files_changed,
  commit_message: calendar.commit_message || 'docs(season): next season arc + tiered-confidence calendar',
  note: 'Season planned — run /update per beat. No git run.',
}
