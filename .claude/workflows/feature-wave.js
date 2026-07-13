export const meta = {
  name: 'feature-wave',
  description: 'Pod feature build: design brief → C++ systems + failing tests → independent gate → BP/level/audio integrate → eng review → cook+automation validate. Non-trusting gates. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Design' },
    { title: 'Build' },
    { title: 'Verify' },
    { title: 'Integrate' },
    { title: 'Review' },
    { title: 'Validate' },
  ],
  requires: ['gameplay', 'content'],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'design-director': 'opus', 'eng-gameplay': 'sonnet',
  'qa-lead': 'sonnet', 'qa-gate-verifier': 'haiku', 'design-technical': 'sonnet',
  'design-level': 'sonnet', 'audio-designer': 'sonnet', 'eng-director': 'opus',
}

// stage guard — features are frozen at alpha; slice-stage features go through this wave too
const STAGES = ['vertical-slice', 'production']

// staffing merges (subset of references/PROFILES.json relevant to this wave's roles)
const MERGE = {
  solo:  { 'design-technical': 'design-director', 'design-level': 'design-director' },
  indie: {},
  studio: {},
}

// ── compact schema mirrors (source: agents/_shared/schemas/*.json) ───────
const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, profile: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, task_id: { type: 'string' }, agent: { type: 'string' }, phase: { type: 'integer' },
  status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] }, escalate: { type: 'boolean' },
  gate_result: { type: 'string', enum: ['pass', 'fail'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  systems_surface: { type: 'array', items: { type: 'object' } }, assets_authored: { type: 'array', items: { type: 'object' } },
  tests_added: { type: 'array' }, decisions: { type: 'array' }, deps_added: { type: 'array' },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] }, self_report_matched: { type: ['boolean', 'null'] } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } },
  advisories: { type: 'array' }, dimensions_checked: { type: 'array' }, docs_drift: { type: 'array' } } }
const BRIEF = { type: 'object', required: ['brief', 'acceptance'], properties: {
  brief: { type: 'string' }, acceptance: { type: 'array', items: { type: 'string' } },
  pillars_touched: { type: 'array', items: { type: 'string' } }, scope_warning: { type: ['string', 'null'] } } }

// ── inputs ───────────────────────────────────────────────────────────────
const feature = (A && (A.feature || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!feature) return { status: 'needsInput', reason: 'feature-wave needs a feature description (A.feature).' }

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else fall back to in-repo project.config.json. Return the structured profile; resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch (new project) first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `feature-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}' — features are frozen past production.` }
for (const cap of meta.requires) if (!(project.capabilities || []).includes(cap)) return { status: 'skipped', reason: `profile lacks capability '${cap}'` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
const stackCtx = `UE ${project.stack?.engine_version || '5.7'}, GAS + Enhanced Input + UMG/CommonUI locked; audio=${project.stack?.audio || 'Wwise'}; networking=${project.stack?.networking?.mode || 'single-player'}. Read .claude/rules/ for the matching standards before writing anything.`
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

// Independent, non-trusting gate. Ignores the author's self-reported gate_result.
const gateVerify = (handoff, label, ph) => agent(
  `Independently re-run the gate for the ${label} slice. Changed files: ${JSON.stringify((handoff && handoff.files_changed) || [])}.
   IGNORE any self-reported gate_result — run \`make gate\` (STEP=all) yourself and report what actually passed/failed. Do not edit code.`,
  { label: `gate:${label}`, agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: ph })

// ── Phase: Design (the pod's feature brief — design intent before code) ────
phase('Design')
const design = await agent(
  `Feature brief for: "${feature}" on "${projectRef}". Read references/${projectRef}/config.json design pillars + docs/GAMEPLAY_SYSTEMS.md if present. Write the one-page brief: player-facing behavior, GAS surface expected (abilities/attributes/effects), acceptance criteria (testable), pillars touched. Flag scope_warning if this is bigger than one feature.`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: BRIEF, phase: 'Design' })
if (!design || !design.acceptance?.length) return { status: 'needsInput', reason: 'design brief produced no acceptance criteria' }
if (design.scope_warning) log(`⚠ design flags scope: ${design.scope_warning}`)

// ── Phase: Build (parallel — C++ systems + failing tests) ──────────────────
phase('Build')
const [systems, tests] = await parallel([
  () => agent(`Implement the C++ systems for: "${feature}". Brief: ${design.brief}. Acceptance: ${JSON.stringify(design.acceptance)}. ${stackCtx} GAS for every ability; attribute clamping in C++; systems_surface[] is MANDATORY (the BP side wires against it — never let them invent APIs). Slice-gate your own files, then hand off. Your gate_result is advisory — an independent verifier re-checks.`,
    { label: 'eng-gameplay', agentType: R('eng-gameplay'), model: M[R('eng-gameplay')] || M['eng-gameplay'], schema: HANDOFF, phase: 'Build' }),
  () => agent(`Write FAILING Functional Tests (@critical tagged) FIRST for: "${feature}", against these acceptance criteria: ${JSON.stringify(design.acceptance)}. ${stackCtx} Tests must fail-without / pass-with the feature.`,
    { label: 'qa-lead', agentType: 'qa-lead', model: M['qa-lead'], schema: HANDOFF, phase: 'Build' }),
])
if (!systems || systems.status !== 'ready') return { status: 'needsRework', phase: 'Build', blockers: systems?.blockers || ['systems build did not reach ready'] }

// ── Phase: Verify (NON-TRUSTING gate on the systems build) ─────────────────
phase('Verify')
let v = await gateVerify(systems, 'systems', 'Verify')
if (!v || v.result !== 'pass') {
  log(`systems gate failed at ${v?.failed_step}; one focused repair`)
  const repaired = await agent(
    `Repair the C++ systems slice. Independent gate failed at: ${v?.failed_step}.\n${v?.logs_tail || ''}\nFix only what's needed, re-slice-gate, hand off.`,
    { label: 'eng-gameplay:repair', agentType: R('eng-gameplay'), model: M[R('eng-gameplay')] || M['eng-gameplay'], schema: HANDOFF, phase: 'Verify' })
  v = await gateVerify(repaired || systems, 'systems', 'Verify')
  if (!v || v.result !== 'pass') return { status: 'needsRework', phase: 'Build', failed: v?.failed_step, logs: v?.logs_tail }
  if (repaired) systems.files_changed = [...(systems.files_changed || []), ...(repaired.files_changed || [])]
}
if (v.self_report_matched === false) log('⚠ systems self-reported a gate result that did not match reality (audit signal)')

// ── Phase: Integrate (parallel — BP content blocked on systems_surface; level/audio per scope) ─
phase('Integrate')
const surface = systems.systems_surface || []
const [content, level, audio] = await parallel([
  () => surface.length
    ? agent(`Wire the Blueprint/UMG content for: "${feature}". ${stackCtx} Consume ONLY this systems_surface: ${JSON.stringify(surface)}. Thin BP handlers — logic stays in C++. Binary assets go through editor-Python generator scripts (skills/ue5-editor-python); record them in assets_authored[]. If the surface looks wrong/missing, hand back status:blocked — do not invent APIs.`,
      { label: 'design-technical', agentType: R('design-technical'), model: M[R('design-technical')] || M['design-technical'], schema: HANDOFF, phase: 'Integrate' })
    : Promise.resolve({ schema_version: '2', agent: 'design-technical', status: 'blocked', files_changed: [], blockers: ['no systems_surface[] from eng-gameplay — BP wiring not started'] }),
  () => A.levels
    ? agent(`Level/encounter work for: "${feature}". Brief: ${design.brief}. Blockout scripting, encounter placement, streaming — via editor-Python where assets are needed. Consume the systems_surface: ${JSON.stringify(surface)}.`,
      { label: 'design-level', agentType: R('design-level'), model: M[R('design-level')] || M['design-level'], schema: HANDOFF, phase: 'Integrate' })
    : Promise.resolve({ schema_version: '2', agent: 'design-level', status: 'skipped', files_changed: [] }),
  () => A.audio
    ? agent(`Audio hookup for: "${feature}" (${project.stack?.audio || 'Wwise'}). Events/RTPC per the systems_surface gameplay tags: ${JSON.stringify(surface)}. Bank changes recorded in assets_authored[].`,
      { label: 'audio-designer', agentType: 'audio-designer', model: M['audio-designer'], schema: HANDOFF, phase: 'Integrate' })
    : Promise.resolve({ schema_version: '2', agent: 'audio-designer', status: 'skipped', files_changed: [] }),
])
const integrateBlockers = [...(content?.blockers || []), ...(level?.blockers || []), ...(audio?.blockers || [])]
if (integrateBlockers.length) return { status: 'needsRework', phase: 'Integrate', blockers: integrateBlockers }

// ── Phase: Review (department craft gate — eng-director, security folded in) ─
phase('Review')
const review = await agent(
  `Department review of the full slice for: "${feature}". Dimensions: gas-patterns, bp-hygiene (thin handlers?), replication (WithValidation on RPCs?), perf anti-patterns (tick abuse, hard refs), naming, save-integrity, and the SECURITY_CHECKLIST.md items touched. Blockers as 'file:line — what — fix'. You review; you do not author.`,
  { label: 'eng-director', agentType: 'eng-director', model: M['eng-director'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers, review }

// ── Phase: Validate (independent, serial: cook → automation → gate) ─────────
phase('Validate')
const validation = await agent(
  `Functional validation. Run in order, stop at first failure: \`make cook-smoke\`, \`make automation-critical\`, \`make gate\`. Report each step's result + logs_tail on failure. Do NOT edit anything.`,
  { label: 'validate', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Validate' })
if (!validation || validation.result !== 'pass') return { status: 'needsRework', phase: 'Validate', failed: validation?.failed_step, logs: validation?.logs_tail }

const files = [...(systems?.files_changed || []), ...(content?.files_changed || []), ...(tests?.files_changed || []), ...(level?.files_changed || []), ...(audio?.files_changed || [])]
return {
  status: 'ready',
  feature,
  project: projectRef,
  files,
  systems_surface: surface,
  acceptance: design.acceptance,
  review, validation,
  commit_message: systems?.commit_message || `feat: ${feature}\n\nSystems + content + tests. Gate independently verified.`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
