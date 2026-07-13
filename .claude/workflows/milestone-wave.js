export const meta = {
  name: 'milestone-wave',
  description: 'Publisher-style milestone review: independent producer judges deliverables → deficiency list → ONE repair round → resubmit. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Review' },
    { title: 'Repair' },
    { title: 'Resubmit' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'producer': 'opus', 'eng-gameplay': 'sonnet', 'design-technical': 'sonnet' }
const STAGES = ['production', 'alpha', 'beta']
const MERGE = { solo: { 'design-technical': 'design-director' }, indie: {}, studio: {} }
const M2 = { 'design-director': 'opus' }

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const ACCEPT = { type: 'object', required: ['accepted', 'deliverables'], properties: {
  accepted: { type: 'boolean' }, milestone: { type: 'string' },
  deliverables: { type: 'array', items: { type: 'object', required: ['deliverable', 'met'], properties: { deliverable: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } } } },
  deficiencies: { type: 'array', items: { type: 'string' } },
  resubmission: { type: 'integer' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

const milestone = (A && A.milestone) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!milestone) return { status: 'needsInput', reason: 'milestone-wave needs a milestone name (A.milestone).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `milestone-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
const MODEL = (r) => M[r] || M2[r]

const deliverablesArg = Array.isArray(A.deliverables) && A.deliverables.length ? `Deliverables (from the user): ${JSON.stringify(A.deliverables)}` : 'Deliverables: read them from docs/ROADMAP.md for this milestone; if the roadmap does not define them, judge nothing — return accepted:false with one deficiency saying the milestone has no defined deliverables.'

phase('Review')
const first = await agent(
  `Independent milestone review of "${milestone}" on "${projectRef}" — you did not build any of it. ${deliverablesArg} For each deliverable: met true/false with concrete evidence (files, tests, cooked maps — verify by reading, not by trusting docs). Rejection needs a reasonably-detailed deficiency list: what, where, and what fixed looks like. resubmission: 0.`,
  { label: 'producer:review', agentType: 'producer', model: M['producer'], schema: ACCEPT, phase: 'Review' })
if (!first) return { status: 'needsRework', phase: 'Review', reason: 'review returned nothing' }
if (first.accepted) return { status: 'ready', milestone, accepted: true, deliverables: first.deliverables, note: 'Milestone accepted first submission. Nothing edited.' }

phase('Repair')
log(`milestone rejected with ${(first.deficiencies || []).length} deficiencies; one repair round`)
const cppLike = (d) => /\b(c\+\+|attribute|subsystem|replicat|rpc|header|compile|gas|crash|system)\b/i.test(d)
const deficiencies = (first.deficiencies || []).slice(0, 8)
const repairs = await parallel(deficiencies.map((d) => () => {
  const role = cppLike(d) ? 'eng-gameplay' : R('design-technical')
  return agent(
    `Fix this milestone deficiency on "${projectRef}": "${d}". Scoped fix only — address exactly what the deficiency names. Slice-gate your files; self-report advisory.`,
    { label: `repair:${role}`, agentType: role, model: MODEL(role), schema: HANDOFF, phase: 'Repair' })
}))
const repairFiles = repairs.filter(Boolean).flatMap((r) => r.files_changed || [])

phase('Resubmit')
const second = await agent(
  `Milestone resubmission review of "${milestone}" (resubmission: 1 — the last allowed). Original deficiencies: ${JSON.stringify(first.deficiencies)}. Repairs claimed: ${JSON.stringify(repairFiles)}. Re-verify every deliverable AND every deficiency with evidence; accepted only if all resolved.`,
  { label: 'producer:resubmit', agentType: 'producer', model: M['producer'], schema: ACCEPT, phase: 'Resubmit' })
if (second && second.accepted) return {
  status: 'ready', milestone, accepted: true, deliverables: second.deliverables,
  files: repairFiles, resubmission: 1,
  commit_message: `chore(milestone): ${milestone} — deficiencies repaired, accepted on resubmission`,
  note: 'Working tree edited during repair. No git run — review and commit yourself.',
}
return { status: 'needsRework', milestone, accepted: false, deficiencies: second?.deficiencies || first.deficiencies, files: repairFiles, note: 'Failed after the one allowed resubmission — the remaining deficiencies need a bigger effort (/feature or a scope talk).' }
