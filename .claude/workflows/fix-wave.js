export const meta = {
  name: 'fix-wave',
  description: 'Single-surface change: one author edits → independent review → independent gate. Escalates to /feature if scope grows. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Edit' },
    { title: 'Review' },
    { title: 'Gate' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'eng-gameplay': 'sonnet', 'design-technical': 'sonnet',
  'eng-director': 'opus', 'qa-gate-verifier': 'haiku',
}

// fixes are legal in any stage that has a repo; beta+ is exactly the debug-only regime this wave serves
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const MERGE = { solo: { 'design-technical': 'design-director' }, indie: {}, studio: {} }

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
  assets_authored: { type: 'array', items: { type: 'object' } }, decisions: { type: 'array' },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] }, self_report_matched: { type: ['boolean', 'null'] } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } },
  advisories: { type: 'array' }, dimensions_checked: { type: 'array' } } }

// ── inputs ───────────────────────────────────────────────────────────────
const change = (A && (A.change || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!change) return { status: 'needsInput', reason: 'fix-wave needs a change description (A.change).' }

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else in-repo project.config.json. resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo to fix at stage '${project.stage}'` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
// route to the right author by sniffing the surface: C++/engine keywords → eng-gameplay, else BP/content side
const cppLike = /\b(c\+\+|attribute|subsystem|replicat|rpc|header|\.cpp|\.h\b|gas|ability system|crash|compile)\b/i.test(change)
const authorRole = cppLike ? 'eng-gameplay' : R('design-technical')
log(`routing to ${authorRole} at ${project.stage} stage (${project.staffing} staffing)`)

// ── Phase: Edit (ONE author, ONE surface) ──────────────────────────────────
phase('Edit')
const edit = await agent(
  `Make this single-surface change on "${projectRef}": "${change}". Stage is '${project.stage}'${['alpha','beta','gold','live'].includes(project.stage) ? ' — debug-only regime: fix behavior, add nothing new' : ''}. ONE surface only (C++ OR Blueprint OR widget OR data asset). No GAS AttributeSet schema changes. Binary assets only via editor-Python generator scripts. If the change grows beyond one surface or touches the C++↔BP contract, STOP and set escalate:true. Slice-gate your files; your gate_result is advisory.`,
  { label: authorRole, agentType: authorRole, model: M[authorRole] || M['eng-gameplay'], schema: HANDOFF, phase: 'Edit' })
if (edit?.escalate) return { status: 'escalate', reason: 'change spans surfaces or the C++↔BP contract — run /feature instead', detail: edit.blockers }
if (!edit || edit.status !== 'ready') return { status: 'needsRework', phase: 'Edit', blockers: edit?.blockers || ['edit did not reach ready'] }

// ── Phase: Review (independent — the author gets no vote) ──────────────────
phase('Review')
const review = await agent(
  `Review this change on "${projectRef}": "${change}". Files: ${JSON.stringify(edit.files_changed)}. Dimensions: correctness, gas-patterns, bp-hygiene, replication safety, naming, and SECURITY_CHECKLIST.md items if it touches save/netcode/monetization. Blockers as 'file:line — what — fix'. Do not author.`,
  { label: 'eng-director', agentType: 'eng-director', model: M['eng-director'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers }

// ── Phase: Gate (independent, full) ─────────────────────────────────────────
phase('Gate')
const verdict = await agent(
  `Independently run \`make gate\` (STEP=all) for this change: ${JSON.stringify(edit.files_changed)}. IGNORE the author's self-reported gate_result. Report pass/fail per step + logs_tail on failure. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Gate' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Gate', failed: verdict?.failed_step, logs: verdict?.logs_tail }
if (verdict.self_report_matched === false) log('⚠ author self-report did not match the independent gate (audit signal)')

return {
  status: 'ready',
  change,
  project: projectRef,
  files: edit.files_changed,
  review, gate: verdict,
  commit_message: edit.commit_message || `fix: ${change}`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
