export const meta = {
  name: 'tech-plan-wave',
  description: 'Preproduction tech plan: eng-director drafts architecture (modules, GAS surface, networking, plugin baseline, build/CI) while producer quantifies the risk register in person-days, then eng-director merges both into docs/TECH_PLAN.md. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Draft' },
    { title: 'Merge' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'eng-director': 'opus', 'producer': 'opus',
}

// tech plan is locked at preproduction exit — this wave only runs while it's still open
const STAGES = ['preproduction']

// ── compact schema mirrors (source: agents/_shared/schemas/*.json) ───────
const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, profile: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' },
  status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] }, escalate: { type: 'boolean' },
  gate_result: { type: 'string', enum: ['pass', 'fail'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array', items: { type: 'string' } }, blockers: { type: 'array', items: { type: 'string' } },
  commit_message: { type: 'string' } } }
// ad hoc drafting schemas (no canonical schema file — same as feature-wave's BRIEF)
const ARCHITECTURE = { type: 'object', required: ['summary', 'module_layout'], properties: {
  summary: { type: 'string' }, module_layout: { type: 'array', items: { type: 'string' } },
  gas_surface_strategy: { type: 'string' }, networking_notes: { type: 'string' },
  plugin_baseline: { type: 'array', items: { type: 'string' } }, build_ci_shape: { type: 'string' } } }
const RISK_REGISTER = { type: 'object', required: ['risks'], properties: {
  risks: { type: 'array', items: { type: 'object', required: ['risk', 'mitigation', 'person_days'], properties: {
    risk: { type: 'string' }, impact: { type: 'string' }, likelihood: { type: 'string' },
    mitigation: { type: 'string' }, person_days: { type: 'number' } } } } } }

// ── inputs ───────────────────────────────────────────────────────────────
const projectRef = (A && A.project) || '_TEMPLATE'

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else fall back to in-repo project.config.json. Return the structured profile; resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch (new project) first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `tech-plan-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}' — the tech plan is locked at preproduction exit.` }
const stackCtx = `UE ${project.stack?.engine_version || '5.7'}, GAS + Enhanced Input + UMG/CommonUI locked; audio=${project.stack?.audio || 'Wwise'}; networking=${project.stack?.networking?.mode || 'single-player'}. Read .claude/rules/ for the matching standards before writing anything.`
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

// ── Phase: Draft (parallel — architecture + quantified risk register) ──────
phase('Draft')
const [architecture, riskReg] = await parallel([
  () => agent(
    `Draft the technical architecture plan for "${projectRef}" at preproduction. ${stackCtx} Cover: module layout (C++ module boundaries: game, editor, tests), GAS surface strategy for the slice (which abilities/attributes/effects and how they're organized), networking implications of networking.mode='${project.stack?.networking?.mode || 'single-player'}', plugin baseline (GAS + Enhanced Input + UMG/CommonUI + Niagara + ${project.stack?.audio || 'Wwise'}, plus anything project-specific), and build/CI shape (cook-smoke, automation-critical, gate steps). Read any GDD/macro-design docs under references/${projectRef}/ or docs/ if present.`,
    { label: 'eng-director', agentType: 'eng-director', model: M['eng-director'], schema: ARCHITECTURE, phase: 'Draft' }),
  () => agent(
    `Quantify the technical/production risk register for "${projectRef}"'s preproduction tech plan, in person-days. Identify the TOP 5 risks (engine/tooling, scope, staffing, third-party middleware, schedule) with a concrete mitigation and a person-day cost estimate for each.`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: RISK_REGISTER, phase: 'Draft' }),
])
if (!architecture || !architecture.summary || !architecture.module_layout?.length) return { status: 'needsRework', phase: 'Draft', blockers: ['eng-director architecture draft incomplete'] }
if (!riskReg || !riskReg.risks?.length) return { status: 'needsRework', phase: 'Draft', blockers: ['producer risk register empty'] }

// ── Phase: Merge (eng-director synthesizes docs/TECH_PLAN.md) ──────────────
phase('Merge')
const merged = await agent(
  `Merge the architecture draft and the risk register into docs/TECH_PLAN.md for "${projectRef}". Architecture: ${JSON.stringify(architecture)}. Risk register (${riskReg.risks.length} risks, person-day quantified): ${JSON.stringify(riskReg.risks)}. Write or update the doc as the single source of truth for preproduction-exit-wave to lock. Report files_changed + a commit_message.`,
  { label: 'eng-director:merge', agentType: 'eng-director', model: M['eng-director'], schema: HANDOFF, phase: 'Merge' })
if (!merged || merged.status !== 'ready') return { status: 'needsRework', phase: 'Merge', blockers: merged?.blockers || ['tech plan merge did not reach ready'] }

return {
  status: 'ready',
  project: projectRef,
  files: merged.files_changed,
  risk_count: riskReg.risks.length,
  architecture_summary: architecture.summary,
  risks: riskReg.risks,
  commit_message: merged.commit_message || `docs: tech plan for ${projectRef}`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
