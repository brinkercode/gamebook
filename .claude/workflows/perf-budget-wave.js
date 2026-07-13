export const meta = {
  name: 'perf-budget-wave',
  description: 'Headless stat capture vs performance-budgets.md ceilings → violations + regressions, persisted to docs/perf/. Advisory — reports, never blocks. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Capture' },
    { title: 'Annotate' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-gate-verifier': 'haiku', 'eng-gameplay': 'sonnet' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const PERF = { type: 'object', required: ['result', 'metrics'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  capture: { type: 'object', properties: { map: { type: 'string' }, method: { type: 'string' }, build_config: { type: 'string' } } },
  metrics: { type: 'array', items: { type: 'object', required: ['metric', 'measured', 'budget', 'within_budget'], properties: {
    metric: { type: 'string' }, measured: { type: 'number' }, budget: { type: 'number' }, unit: { type: 'string' }, within_budget: { type: 'boolean' } } } },
  violations: { type: 'array', items: { type: 'string' } },
  regressions: { type: 'array', items: { type: 'string' } } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo to profile at stage '${project.stage}'` }

phase('Capture')
const report = await agent(
  `Performance capture for "${projectRef}" (target: ${project.stack?.perf?.target_fps || 60} FPS on ${project.stack?.perf?.baseline || 'GTX 1060 / PS5-equivalent'}). Run the automation suite with stat capture (csv profile / stat dump per quality/performance-budgets.md instructions). Compare each measured metric against the ceilings in quality/performance-budgets.md (frame time, draw calls, triangles, memory). Metrics a headless NullRHI run cannot measure: report honestly with within_budget true and a note in capture.method — never fake GPU numbers. Read docs/perf/latest.json if present and list regressions. Do not edit anything.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: PERF, phase: 'Capture' })
if (!report) return { status: 'needsRework', phase: 'Capture', reason: 'capture returned nothing' }

phase('Annotate')
const persist = await agent(
  `Persist the perf report and annotate causes. Write docs/perf/latest.json (this report verbatim: ${JSON.stringify(report).slice(0, 4000)}) and append a dated row to docs/perf/HISTORY.md. For each violation, add a suspected-cause annotation (file/asset hint) from reading the code/assets — annotations go in the HISTORY row, not the json.`,
  { label: 'eng-gameplay', agentType: 'eng-gameplay', model: M['eng-gameplay'], schema: HANDOFF, phase: 'Annotate' })

return {
  status: 'ready', project: projectRef,
  result: report.result, metrics: report.metrics,
  violations: report.violations || [], regressions: report.regressions || [],
  files: (persist && persist.files_changed) || [],
  commit_message: 'chore(perf): budget capture — see docs/perf/latest.json',
  note: (report.violations || []).length ? 'Advisory: violations reported, nothing blocked — route fixes via /fix or /feature.' : 'All measured metrics within budget.',
}
