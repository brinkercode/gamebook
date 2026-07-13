export const meta = {
  name: 'slice-criteria-wave',
  description: 'Lock the vertical-slice acceptance criteria BEFORE the slice is built: design-director drafts measurable criteria for a 20-60 min slice, qa-lead annotates each with the Functional Test spec that will prove it, producer writes the LOCKED docs/SLICE_CRITERIA.md that slice-greenlight-wave later judges against. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Draft' },
    { title: 'Testability' },
    { title: 'Lock' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'design-director': 'opus', 'qa-lead': 'sonnet', 'producer': 'opus',
}

// slice acceptance criteria are locked once, at the vertical-slice stage, before the slice is built
const STAGES = ['vertical-slice']

const MERGE = { solo: {}, indie: {}, studio: {} }

// ── compact schema mirrors (source: agents/_shared/schemas/*.json + wave-local) ─
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
// wave-local: design-director's draft of measurable, observable-in-build slice criteria
const CRITERIA = { type: 'object', required: ['criteria'], properties: {
  criteria: { type: 'array', items: { type: 'object', required: ['id', 'statement', 'observable'], properties: {
    id: { type: 'string' }, statement: { type: 'string' }, observable: { type: 'string' } } } },
  slice_summary: { type: 'string' }, estimated_minutes: { type: ['integer', 'null'] }, scope_warning: { type: ['string', 'null'] } } }
// wave-local: qa-lead's per-criterion Functional Test spec (fails-without / passes-with) — annotation, not build
const TESTPLAN = { type: 'object', required: ['schema_version', 'agent', 'status', 'criteria_tests'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' },
  status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  criteria_tests: { type: 'array', items: { type: 'object', required: ['criterion_id', 'test_name', 'fails_without', 'passes_with'], properties: {
    criterion_id: { type: 'string' }, test_name: { type: 'string' }, fails_without: { type: 'string' }, passes_with: { type: 'string' } } } },
  blockers: { type: 'array', items: { type: 'string' } } } }

// ── inputs ───────────────────────────────────────────────────────────────
const projectRef = (A && A.project) || '_TEMPLATE'

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else fall back to in-repo project.config.json. Return the structured profile; resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch (new project) first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `slice-criteria-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}'.` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

// ── Phase: Draft (design-director — measurable criteria for a 20-60 min slice) ─
phase('Draft')
const draft = await agent(
  `Draft the vertical-slice acceptance criteria for "${projectRef}". Read references/${projectRef}/config.json design pillars, docs/GDD.md, and docs/MACRO_DESIGN.md if present. The slice is a SINGLE 20-60 minute playable chunk — scope it that tight; flag scope_warning if the pillars imply more. Every criterion must be MEASURABLE and OBSERVABLE IN-BUILD (a specific input→output behavior, a frame budget, a state the player or a Functional Test can directly witness) — never "feels good" or a vibe. This criteria list is what slice-greenlight-wave will later judge the finished slice against, strictly, so write it as if you will not be in the room to argue for partial credit.`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: CRITERIA, phase: 'Draft' })
if (!draft || !draft.criteria?.length) return { status: 'needsInput', reason: 'slice criteria draft produced no criteria' }
if (draft.scope_warning) log(`⚠ draft flags scope: ${draft.scope_warning}`)

// ── Phase: Testability (qa-lead — Functional Test spec per criterion, fails-without/passes-with) ─
phase('Testability')
const testplan = await agent(
  `Annotate each slice acceptance criterion with the Functional Test spec that will PROVE it, for "${projectRef}". Criteria: ${JSON.stringify(draft.criteria)}. For every criterion_id, name the test (@critical Functional Test or automation test), what it asserts, and both directions: what fails WITHOUT the slice built and what passes WITH it. This is a spec/annotation pass — do not author the test files yet (slice-wave writes them against this spec later). If a criterion cannot be made testable as written, set status:blocked and say which one and why in blockers[] — do not silently soften it.`,
  { label: 'qa-lead', agentType: R('qa-lead'), model: M['qa-lead'], schema: TESTPLAN, phase: 'Testability' })
if (!testplan || testplan.status !== 'ready') return { status: 'needsRework', phase: 'Testability', blockers: testplan?.blockers || ['testability pass did not reach ready'] }
if (testplan.criteria_tests.length < draft.criteria.length) {
  const covered = new Set(testplan.criteria_tests.map(t => t.criterion_id))
  const uncovered = draft.criteria.filter(c => !covered.has(c.id)).map(c => c.id)
  if (uncovered.length) return { status: 'needsRework', phase: 'Testability', blockers: [`criteria without a test spec: ${uncovered.join(', ')}`] }
}

// ── Phase: Lock (producer — writes docs/SLICE_CRITERIA.md, marks it LOCKED) ────
phase('Lock')
const lockDate = new Date().toISOString().slice(0, 10)
const lock = await agent(
  `Write docs/SLICE_CRITERIA.md for "${projectRef}" and mark it LOCKED as of ${lockDate}. Include the criteria list VERBATIM (id + statement + observable, unmodified from design-director's draft) alongside qa-lead's per-criterion test spec (test_name, fails_without, passes_with). Criteria: ${JSON.stringify(draft.criteria)}. Test specs: ${JSON.stringify(testplan.criteria_tests)}. This file is the binding contract slice-greenlight-wave judges the finished slice against — do not paraphrase, trim, or reorder a criterion when transcribing it. State the lock date and that changes after lock require a producer-approved deficiency finding, not an ad hoc rerun of this wave.`,
  { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Lock' })
if (!lock || lock.status !== 'ready') return { status: 'needsRework', phase: 'Lock', blockers: lock?.blockers || ['docs/SLICE_CRITERIA.md lock did not reach ready'] }

return {
  status: 'ready',
  project: projectRef,
  criteria: draft.criteria,
  criteria_tests: testplan.criteria_tests,
  locked_date: lockDate,
  files: lock.files_changed || [],
  commit_message: lock.commit_message || `docs: lock slice acceptance criteria for ${projectRef}`,
  note: 'Working tree edited. No git run — review and commit yourself. docs/SLICE_CRITERIA.md is now LOCKED: slice-greenlight-wave will judge the built slice STRICTLY against this file, not against a fresh read of intent — do not hand-wave partial credit past it.',
}
