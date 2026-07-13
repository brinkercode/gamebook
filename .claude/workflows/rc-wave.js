export const meta = {
  name: 'rc-wave',
  description: 'THE gold gate: 100% P0-P1 / >90% P2 / >85% P3 fixed (deterministic math) + full validation + Fable-tier panel → stage: gold. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Counts' },
    { title: 'Validate' },
    { title: 'Panel' },
    { title: 'Transition' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-crash-correlator': 'haiku', 'qa-bug-hunter': 'sonnet', 'qa-gate-verifier': 'haiku', 'greenlight-panel': 'fable', 'producer': 'opus' }
const STAGES = ['beta']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const DEFECTS = { type: 'object', required: ['defects'], properties: {
  defects: { type: 'array', items: { type: 'object', required: ['id', 'severity', 'summary', 'repro'], properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] },
    summary: { type: 'string' }, repro: { type: 'string' }, status: { type: 'string', enum: ['open', 'fixed', 'verified', 'wont-fix', 'duplicate'] } } } },
  counts: { type: 'object' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }
const VERDICT = { type: 'object', required: ['verdict', 'criteria'], properties: {
  verdict: { type: 'string', enum: ['pass', 'redesign', 'kill'] },
  criteria: { type: 'array', items: { type: 'object', required: ['criterion', 'met'], properties: { criterion: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } } } },
  rationale: { type: 'string' }, conditions: { type: 'array', items: { type: 'string' } },
  redesign_directives: { type: 'array', items: { type: 'string' } }, next_stage: { type: ['string', 'null'] } } }
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
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `rc-wave runs at beta but stage is '${project.stage}'` }

phase('Counts')
const inventory = await agent(
  `Assemble the current defect inventory for "${projectRef}": read the latest bug-bash inventory${A.inventory ? ` at ${A.inventory}` : ' (docs/audits/, .claude/handoffs/)'} and update statuses by verifying claimed fixes still hold (spot-check repros). Every defect carries status open/fixed/verified/wont-fix/duplicate. Fill counts. NO fixing.`,
  { label: 'qa-bug-hunter', agentType: 'qa-bug-hunter', model: M['qa-bug-hunter'], schema: DEFECTS, phase: 'Counts' })
if (!inventory || !inventory.defects) return { status: 'needsInput', reason: 'no defect inventory available — run /bug-bash first' }

// deterministic gate math — the industry gold rule, computed in code not by a model
const by = (sev) => inventory.defects.filter((d) => d.severity === sev && d.status !== 'duplicate' && d.status !== 'wont-fix')
const fixedRate = (sev) => { const s = by(sev); return s.length ? s.filter((d) => d.status === 'fixed' || d.status === 'verified').length / s.length : 1 }
const openP0P1 = by('P0').concat(by('P1')).filter((d) => d.status === 'open').length
const p2Rate = fixedRate('P2'), p3Rate = fixedRate('P3')
const mathPass = openP0P1 === 0 && p2Rate > 0.9 && p3Rate > 0.85
log(`gold math: P0/P1 open=${openP0P1}, P2 fixed=${Math.round(p2Rate * 100)}%, P3 fixed=${Math.round(p3Rate * 100)}% → ${mathPass ? 'PASS' : 'FAIL'}`)
if (!mathPass) return { status: 'needsRework', phase: 'Counts', counts: { openP0P1, p2_fixed_rate: p2Rate, p3_fixed_rate: p3Rate }, note: 'The 100/90/85 rule failed — no panel convened. Fix via /hotfix or /bug-hunt fix:true and re-run.' }

phase('Validate')
const validation = await agent(
  `Full RC validation for "${projectRef}". Run in order, stop at first failure: \`make gate\`, \`make cook-smoke\`, \`make gauntlet-critical\`. Report per-step + logs_tail. Do NOT edit.`,
  { label: 'validate', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Validate' })
if (!validation || validation.result !== 'pass') return { status: 'needsRework', phase: 'Validate', failed: validation?.failed_step, logs: validation?.logs_tail }

phase('Panel')
const verdict = await agent(
  `You chair the release-candidate gate — a project-fate decision. Evidence: gold math PASSED (P0/P1 open: 0, P2 fixed ${Math.round(p2Rate * 100)}%, P3 fixed ${Math.round(p3Rate * 100)}%), full validation PASSED (${JSON.stringify(validation.steps)}). Judge the remainder: known wont-fix defects each have a documented workaround; no criterion of shippability is unmet (read docs/ROADMAP.md ship criteria if present). A gold candidate with any later-found critical bug becomes a NEW RC — say so in conditions. pass/redesign/kill.`,
  { label: 'greenlight-panel', agentType: 'design-director', model: M['greenlight-panel'], schema: VERDICT, phase: 'Panel' })
if (!verdict) return { status: 'needsRework', phase: 'Panel', reason: 'panel returned nothing' }

phase('Transition')
if (verdict.verdict === 'pass') {
  const t = await agent(
    `Record the stage transition for "${projectRef}": stage to "gold" in references/${projectRef}/config.json, stage_history append {gate: "rc", verdict: "pass", from: "beta", to: "gold", date: today}.`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Transition' })
  return { status: 'ready', verdict: 'pass', counts: { openP0P1, p2_fixed_rate: p2Rate, p3_fixed_rate: p3Rate }, criteria: verdict.criteria, conditions: verdict.conditions || [], transition: t?.files_changed || [], commit_message: 'chore: RC gate PASS — gold. Any critical bug from here = new RC', note: 'Stage is now gold. /cert-preflight and /release ahead.' }
}
return { status: 'ready', verdict: verdict.verdict, criteria: verdict.criteria, rationale: verdict.rationale, redesign_directives: verdict.redesign_directives || [], note: 'Panel declined gold — directives returned.' }
