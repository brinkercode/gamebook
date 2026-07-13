export const meta = {
  name: 'bug-bash-wave',
  description: 'Mass defect hunt: crash sweep + 4 hunter lenses → producer triage into a P0–P4 inventory. No fixing — the input rc-wave reads. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Sweep' },
    { title: 'Hunt' },
    { title: 'Triage' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-crash-correlator': 'haiku', 'qa-bug-hunter': 'sonnet', 'producer': 'opus' }
const STAGES = ['alpha', 'beta', 'gold']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const CRASHES = { type: 'object', required: ['crashes'], properties: {
  crashes: { type: 'array', items: { type: 'object', required: ['signature', 'kind'], properties: {
    signature: { type: 'string' }, kind: { type: 'string' }, count: { type: 'integer' },
    suspected_module: { type: 'string' }, log_excerpt: { type: 'string' } } } },
  sources_parsed: { type: 'array', items: { type: 'string' } }, unparsed_failures: { type: 'integer' } } }
const DEFECTS = { type: 'object', required: ['defects'], properties: {
  defects: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'summary', 'repro'], properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] },
    summary: { type: 'string' }, repro: { type: 'string' }, area: { type: 'string' }, file_hint: { type: 'string' }, status: { type: 'string' } } } },
  counts: { type: 'object' } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `bug-bash runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }

phase('Sweep')
const crashes = await agent(
  `Full log sweep of "${projectRef}" (Saved/Logs, CI, automation output) into a deduped crash inventory. Parse only; count unparsed failures honestly.`,
  { label: 'qa-crash-correlator', agentType: 'qa-crash-correlator', model: M['qa-crash-correlator'], schema: CRASHES, phase: 'Sweep' })

phase('Hunt')
const LENSES = [
  'gameplay: abilities, effects, state machines, attribute math',
  'ui-widgets: UMG lifecycle, focus/input routing, binding leaks, CommonUI activation',
  'save-load: serialization versioning, corrupt-slot handling, async race conditions',
  'cook-packaging: assets that fail or bloat the cook, reference chains pulling editor-only data',
]
const hunts = await parallel(LENSES.map((lens, i) => () => agent(
  `Bug-bash hunt on "${projectRef}" through ONE lens: ${lens}. Substantiated defects only — deterministic repro + severity + file_hint each. Crash context: ${JSON.stringify((crashes && crashes.crashes) || []).slice(0, 3000)}. Do not edit anything.`,
  { label: `hunt:${i}`, agentType: 'qa-bug-hunter', model: M['qa-bug-hunter'], schema: DEFECTS, phase: 'Hunt' })))
const raw = hunts.filter(Boolean).flatMap((h) => h.defects || [])
log(`${raw.length} raw defect(s) from ${LENSES.length} lenses + ${(crashes?.crashes || []).length} crash signature(s)`)

phase('Triage')
const triaged = await agent(
  `Triage this bug-bash haul for "${projectRef}" into the final inventory: merge duplicates (same root symptom), assign final P0-P4 severities (P0 = blocks alpha/gold), fill counts. Crash signatures without a matching hunt defect become defects too. Raw: ${JSON.stringify(raw).slice(0, 8000)}. NO fixing — this inventory is what /rc reads.`,
  { label: 'producer', agentType: 'producer', model: M['producer'], schema: DEFECTS, phase: 'Triage' })
if (!triaged) return { status: 'needsRework', phase: 'Triage', reason: 'triage returned nothing' }

return {
  status: 'ready', project: projectRef,
  defects: triaged.defects, counts: triaged.counts || {},
  unparsed_failures: (crashes && crashes.unparsed_failures) || 0,
  note: 'Triaged inventory — fix P0/P1 via /hotfix or /bug-hunt fix:true; /rc reads these counts.',
}
