export const meta = {
  name: 'bug-hunt-wave',
  description: 'Fan-out bug hunt (3 lenses) → dedupe → optional fixes, each verified by RE-DRIVING the repro → full gate. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Hunt' },
    { title: 'Fix' },
    { title: 'Verify' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-bug-hunter': 'sonnet', 'qa-gate-verifier': 'haiku' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const DEFECTS = { type: 'object', required: ['defects'], properties: {
  defects: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'summary', 'repro'], properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] },
    summary: { type: 'string' }, repro: { type: 'string' }, area: { type: 'string' }, file_hint: { type: 'string' },
    status: { type: 'string', enum: ['open', 'fixed', 'verified', 'wont-fix', 'duplicate'] }, verified_by: { type: 'string' } } } },
  counts: { type: 'object' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }
const REPRO = { type: 'object', required: ['reproduced'], properties: {
  reproduced: { type: 'boolean' }, evidence: { type: 'string' } } }

const projectRef = (A && A.project) || '_TEMPLATE'
const area = (A && A.area) || ''

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo to hunt at stage '${project.stage}'` }

phase('Hunt')
const LENSES = [
  'gameplay-logic: ability/effect misfires, state machine dead-ends, event-order assumptions, off-by-one in attribute math',
  'memory-lifetime: stale GAS pointers (ended abilities holding refs), GC of referenced UObjects, dangling delegates, uninitialized UPROPERTYs',
  'data-config: DataTable/CurveTable mismatches, missing gameplay tags, .ini drift, asset references that break on cook',
]
const hunts = await parallel(LENSES.map((lens, i) => () => agent(
  `Hunt for real, demonstrable bugs in "${projectRef}"${area ? ` (area: ${area})` : ''} through ONE lens: ${lens}. Each defect needs a deterministic repro (steps or the automation test that triggers it) + severity P0-P4 + file_hint. Only report what you can substantiate by reading code/data — no speculation. status: open. Do not edit anything.`,
  { label: `hunt:${i}`, agentType: 'qa-bug-hunter', model: M['qa-bug-hunter'], schema: DEFECTS, phase: 'Hunt' })))
const all = hunts.filter(Boolean).flatMap((h) => h.defects || [])
const seen = new Set()
const deduped = all.filter((d) => { const k = `${d.file_hint}|${d.summary}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
log(`${deduped.length} unique defect(s) from ${all.length} raw`)
if (!deduped.length) return { status: 'clean', project: projectRef, note: 'No substantiated defects found.' }

if (!A.fix) {
  const counts = {}; for (const d of deduped) counts[d.severity] = (counts[d.severity] || 0) + 1
  return { status: 'ready', project: projectRef, defects: deduped, counts, note: 'Hunt only (fix:false) — apply fixes via /fix or re-run with fix:true.' }
}

phase('Fix')
const toFix = deduped.filter((d) => ['P0', 'P1', 'P2'].includes(d.severity)).slice(0, 6)
if (deduped.length > toFix.length) log(`fixing ${toFix.length} of ${deduped.length} (P0-P2 cap 6; rest returned open)`)
const fixes = await parallel(toFix.map((d) => () => agent(
  `Root-cause and fix this defect on "${projectRef}": [${d.severity}] ${d.summary}. Repro: ${d.repro}. Hint: ${d.file_hint || 'none'}. Scoped fix only; slice-gate your files; self-report advisory.`,
  { label: `fix:${d.id}`, agentType: 'qa-bug-hunter', model: M['qa-bug-hunter'], schema: HANDOFF, phase: 'Fix' })))

phase('Verify')
const verifications = await parallel(toFix.map((d, i) => () => fixes[i] && fixes[i].status === 'ready'
  ? agent(`RE-DRIVE this repro and report whether the defect still occurs: "${d.repro}" (defect: ${d.summary}). Run the relevant automation test or reproduce via the stated steps. reproduced:false means the fix worked. Do not edit.`,
      { label: `reprove:${d.id}`, agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: REPRO, phase: 'Verify' })
  : Promise.resolve({ reproduced: true, evidence: 'fix did not complete' })))
for (let i = 0; i < toFix.length; i++) {
  const ok = verifications[i] && verifications[i].reproduced === false
  toFix[i].status = ok ? 'verified' : 'open'
  toFix[i].verified_by = ok ? `re-driven repro: ${verifications[i].evidence || 'no longer occurs'}` : undefined
}
const finalGate = await agent(
  `Full \`make gate\` (STEP=all) after the bug fixes. Do not edit.`,
  { label: 'gate:final', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Verify' })
if (!finalGate || finalGate.result !== 'pass') return { status: 'needsRework', phase: 'Verify', failed: finalGate?.failed_step, logs: finalGate?.logs_tail, defects: deduped }

const counts = {}; for (const d of deduped) counts[d.severity] = (counts[d.severity] || 0) + 1
const files = fixes.filter(Boolean).flatMap((f) => f.files_changed || [])
return {
  status: 'ready', project: projectRef, defects: deduped, counts, files,
  fixed_verified: toFix.filter((d) => d.status === 'verified').length,
  commit_message: `fix: bug hunt — ${toFix.filter((d) => d.status === 'verified').length} defect(s) fixed and re-proven`,
  note: 'Fixes verified by re-driving each repro, then a full independent gate. No git run.',
}
