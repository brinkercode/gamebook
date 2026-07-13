export const meta = {
  name: 'slice-wave',
  description: 'Build the vertical slice against LOCKED criteria: plan → C++ systems + failing tests → independent gate → BP/level/audio/VFX integrate → eng review → cook+automation validate → playtest report. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Verify' },
    { title: 'Integrate' },
    { title: 'Review' },
    { title: 'Validate' },
    { title: 'Playtest' },
  ],
  requires: ['gameplay', 'content'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = {
  'resolve-project': 'haiku', 'design-director': 'opus', 'eng-gameplay': 'sonnet',
  'qa-lead': 'sonnet', 'qa-gate-verifier': 'haiku', 'design-technical': 'sonnet',
  'design-level': 'sonnet', 'audio-designer': 'sonnet', 'art-vfx': 'sonnet',
  'eng-director': 'opus', 'qa-playtest-analyst': 'haiku',
}
const STAGES = ['vertical-slice']
const MERGE = {
  solo:  { 'design-technical': 'design-director', 'design-level': 'design-director', 'art-vfx': 'art-director' },
  indie: { 'art-vfx': 'art-tech' },
  studio: {},
}
// models.json entries for possible merge targets
const M2 = { 'art-director': 'opus', 'art-tech': 'sonnet' }

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, profile: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' },
  status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  gate_result: { type: 'string', enum: ['pass', 'fail'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  systems_surface: { type: 'array', items: { type: 'object' } }, assets_authored: { type: 'array', items: { type: 'object' } },
  tests_added: { type: 'array' }, decisions: { type: 'array' },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] }, self_report_matched: { type: ['boolean', 'null'] } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } },
  advisories: { type: 'array' }, dimensions_checked: { type: 'array' } } }
const PLAN = { type: 'object', required: ['plan', 'criteria_map'], properties: {
  plan: { type: 'string' }, criteria_map: { type: 'array', items: { type: 'object' } },
  needs_levels: { type: 'boolean' }, needs_audio: { type: 'boolean' }, needs_vfx: { type: 'boolean' } } }
const PLAYTEST = { type: 'object', required: ['session', 'findings'], properties: {
  session: { type: 'object' }, findings: { type: 'array', items: { type: 'object' } },
  incidental_defects: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string', enum: ['fun', 'promising', 'flat', 'broken'] } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + config.local.json; in-repo project.config.json fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `slice-wave runs at vertical-slice but "${projectRef}" is at '${project.stage}'` }
for (const cap of meta.requires) if (!(project.capabilities || []).includes(cap)) return { status: 'skipped', reason: `profile lacks capability '${cap}'` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
const MODEL = (r) => M[r] || M2[r]
const stackCtx = `UE ${project.stack?.engine_version || '5.7'}, GAS + Enhanced Input + UMG/CommonUI locked; audio=${project.stack?.audio || 'Wwise'}. Read .claude/rules/ first.`

const gateVerify = (handoff, label, ph) => agent(
  `Independently re-run the gate for the ${label} slice. Changed files: ${JSON.stringify((handoff && handoff.files_changed) || [])}. IGNORE any self-reported gate_result — run \`make gate\` (STEP=all) yourself. Do not edit code.`,
  { label: `gate:${label}`, agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: ph })

phase('Plan')
const plan = await agent(
  `Read docs/SLICE_CRITERIA.md (return plan:"MISSING" if absent or not marked LOCKED). Build the slice plan: what systems, content, levels, audio, VFX the slice needs, each mapped to the criterion it serves (criteria_map[]). Set needs_levels/needs_audio/needs_vfx honestly. ${stackCtx}`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: PLAN, phase: 'Plan' })
if (!plan || plan.plan === 'MISSING') return { status: 'needsInput', reason: 'docs/SLICE_CRITERIA.md missing or not LOCKED — run /slice-criteria first' }

phase('Build')
const [systems, tests] = await parallel([
  () => agent(`Implement the C++ systems for the vertical slice. Plan: ${plan.plan}. Criteria map: ${JSON.stringify(plan.criteria_map)}. ${stackCtx} systems_surface[] MANDATORY. Slice-gate your files; self-report is advisory.`,
    { label: 'eng-gameplay', agentType: 'eng-gameplay', model: M['eng-gameplay'], schema: HANDOFF, phase: 'Build' }),
  () => agent(`Write FAILING @critical Functional Tests, one per slice criterion from docs/SLICE_CRITERIA.md. Tests must fail-without/pass-with. ${stackCtx}`,
    { label: 'qa-lead', agentType: 'qa-lead', model: M['qa-lead'], schema: HANDOFF, phase: 'Build' }),
])
if (!systems || systems.status !== 'ready') return { status: 'needsRework', phase: 'Build', blockers: systems?.blockers || ['systems build not ready'] }

phase('Verify')
let v = await gateVerify(systems, 'systems', 'Verify')
if (!v || v.result !== 'pass') {
  log(`systems gate failed at ${v?.failed_step}; one focused repair`)
  const repaired = await agent(
    `Repair the slice systems. Independent gate failed at: ${v?.failed_step}.\n${v?.logs_tail || ''}\nFix only what is needed, re-slice-gate, hand off.`,
    { label: 'eng-gameplay:repair', agentType: 'eng-gameplay', model: M['eng-gameplay'], schema: HANDOFF, phase: 'Verify' })
  v = await gateVerify(repaired || systems, 'systems', 'Verify')
  if (!v || v.result !== 'pass') return { status: 'needsRework', phase: 'Build', failed: v?.failed_step, logs: v?.logs_tail }
  if (repaired) systems.files_changed = [...(systems.files_changed || []), ...(repaired.files_changed || [])]
}

phase('Integrate')
const surface = systems.systems_surface || []
const skipped = (a) => Promise.resolve({ schema_version: '2', agent: a, status: 'skipped', files_changed: [] })
const [content, level, audio, vfx] = await parallel([
  () => surface.length
    ? agent(`Wire the Blueprint/UMG content for the slice. Consume ONLY this systems_surface: ${JSON.stringify(surface)}. Thin handlers; binary assets via editor-Python (assets_authored[]). status:blocked if the surface is wrong.`,
      { label: 'design-technical', agentType: R('design-technical'), model: MODEL(R('design-technical')), schema: HANDOFF, phase: 'Integrate' })
    : skipped('design-technical'),
  () => plan.needs_levels
    ? agent(`Slice level/encounters per the plan: ${plan.plan}. Blockout + placement via editor-Python; encounter scripting thin BP over the surface: ${JSON.stringify(surface)}.`,
      { label: 'design-level', agentType: R('design-level'), model: MODEL(R('design-level')), schema: HANDOFF, phase: 'Integrate' })
    : skipped('design-level'),
  () => plan.needs_audio
    ? agent(`Slice audio (${project.stack?.audio || 'Wwise'}): events/RTPC/banks for the slice scope, wired via gameplay cues on the surface tags: ${JSON.stringify(surface)}.`,
      { label: 'audio-designer', agentType: 'audio-designer', model: M['audio-designer'], schema: HANDOFF, phase: 'Integrate' })
    : skipped('audio-designer'),
  () => plan.needs_vfx
    ? agent(`Slice VFX: Niagara via template duplication + editor-Python (skills/niagara-effect), fired through GameplayCues on: ${JSON.stringify(surface)}.`,
      { label: 'art-vfx', agentType: R('art-vfx'), model: MODEL(R('art-vfx')), schema: HANDOFF, phase: 'Integrate' })
    : skipped('art-vfx'),
])
const blockers = [...(content?.blockers || []), ...(level?.blockers || []), ...(audio?.blockers || []), ...(vfx?.blockers || [])]
if (blockers.length) return { status: 'needsRework', phase: 'Integrate', blockers }

phase('Review')
const review = await agent(
  `Full-dimension department review of the slice: gas-patterns, bp-hygiene, replication, perf anti-patterns, naming, save-integrity, SECURITY_CHECKLIST items. Blockers as 'file:line — what — fix'. Review only.`,
  { label: 'eng-director', agentType: 'eng-director', model: M['eng-director'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers, review }

phase('Validate')
const validation = await agent(
  `Slice validation. Run in order, stop at first failure: \`make cook-smoke\`, \`make automation-critical\`, \`make gate\`. Report per-step results + logs_tail. Do NOT edit.`,
  { label: 'validate', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Validate' })
if (!validation || validation.result !== 'pass') return { status: 'needsRework', phase: 'Validate', failed: validation?.failed_step, logs: validation?.logs_tail }

phase('Playtest')
const playtest = await agent(
  `Playtest the slice build against docs/SLICE_CRITERIA.md and the design pillars. Automation-driven walkthrough; report EXPERIENCE findings (fun ≠ correctness); incidental bugs to incidental_defects. Honest about headless limits.`,
  { label: 'qa-playtest-analyst', agentType: 'qa-playtest-analyst', model: M['qa-playtest-analyst'], schema: PLAYTEST, phase: 'Playtest' })

const files = [...(systems?.files_changed || []), ...(content?.files_changed || []), ...(tests?.files_changed || []), ...(level?.files_changed || []), ...(audio?.files_changed || []), ...(vfx?.files_changed || [])]
return {
  status: 'ready',
  project: projectRef,
  files,
  systems_surface: surface,
  review, validation, playtest,
  commit_message: systems?.commit_message || 'feat: vertical slice build\n\nSystems + content + tests. Gates independently verified.',
  note: 'Slice built. Run /slice-greenlight for the stage verdict. No git run — review and commit yourself.',
}
