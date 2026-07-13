export const meta = {
  name: 'alpha-gate-wave',
  description: 'Production→alpha gate: crash sweep + defect counts + feature-complete audit vs GDD. Pass requires zero P0/P1 open AND every GDD feature implemented-or-cut. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Defects' },
    { title: 'Audit' },
    { title: 'Transition' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-crash-correlator': 'haiku', 'qa-bug-hunter': 'sonnet', 'design-director': 'opus', 'producer': 'opus' }
const STAGES = ['production']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const CRASHES = { type: 'object', required: ['crashes'], properties: {
  crashes: { type: 'array', items: { type: 'object', required: ['signature', 'kind'], properties: {
    signature: { type: 'string' }, kind: { type: 'string' }, count: { type: 'integer' },
    callstack_top: { type: 'array', items: { type: 'string' } }, suspected_module: { type: 'string' }, log_excerpt: { type: 'string' } } } },
  sources_parsed: { type: 'array', items: { type: 'string' } }, unparsed_failures: { type: 'integer' } } }
const DEFECTS = { type: 'object', required: ['defects'], properties: {
  defects: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'summary', 'repro'], properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] },
    summary: { type: 'string' }, repro: { type: 'string' }, area: { type: 'string' }, status: { type: 'string' } } } },
  counts: { type: 'object' } } }
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
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `alpha-gate runs at production but stage is '${project.stage}'` }

phase('Defects')
const crashes = await agent(
  `Sweep all available logs for "${projectRef}" (Saved/Logs, CI logs, automation output) into a deduped crash inventory. Parse only — no root-causing. Count unparsed failures honestly.`,
  { label: 'qa-crash-correlator', agentType: 'qa-crash-correlator', model: M['qa-crash-correlator'], schema: CRASHES, phase: 'Defects' })
const defects = await agent(
  `Convert this crash inventory into a triaged defect inventory with P0-P4 severities and counts (P0 = game-breaking Cat-A). Inventory: ${JSON.stringify((crashes && crashes.crashes) || []).slice(0, 6000)}. Also fold in open defects from docs/audits/ if present. NO fixing.`,
  { label: 'qa-bug-hunter', agentType: 'qa-bug-hunter', model: M['qa-bug-hunter'], schema: DEFECTS, phase: 'Defects' })
const counts = (defects && defects.counts) || {}
const p0p1 = (counts.P0 || 0) + (counts.P1 || 0)

phase('Audit')
const audit = await agent(
  `Feature-complete audit for the alpha gate on "${projectRef}": enumerate every feature in docs/GDD.md; each is a criterion — met when implemented (verify by reading code/INDEX, not by trusting docs) or explicitly cut (documented in GDD/ROADMAP). Defect context: P0+P1 open = ${p0p1}. Gate rule: verdict pass ONLY if every feature is implemented-or-cut AND P0+P1 = 0. Judge tier — this is not a kill gate; prefer redesign with directives over kill.`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: VERDICT, phase: 'Audit' })
if (!audit) return { status: 'needsRework', phase: 'Audit', reason: 'audit returned nothing' }

phase('Transition')
if (audit.verdict === 'pass' && p0p1 === 0) {
  const t = await agent(
    `Record the stage transition for "${projectRef}": edit references/${projectRef}/config.json stage to "alpha", append stage_history {gate: "alpha-gate", verdict: "pass", from: "production", to: "alpha", date: today}.`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Transition' })
  return { status: 'ready', verdict: 'pass', counts, criteria: audit.criteria, transition: t?.files_changed || [], commit_message: 'chore: alpha gate PASS — feature complete, zero blockers', note: 'Stage is now alpha. Feature waves are frozen; /fix, /bug-bash, /content-lock ahead.' }
}
return { status: 'ready', verdict: p0p1 > 0 ? 'redesign' : audit.verdict, counts, criteria: audit.criteria, rationale: audit.rationale, redesign_directives: [...(audit.redesign_directives || []), ...(p0p1 > 0 ? [`${p0p1} P0/P1 defect(s) open — run /bug-hunt fix:true or /fix each`] : [])], defects: (defects && defects.defects) || [], note: 'Gate not passed — directives returned.' }
