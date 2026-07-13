export const meta = {
  name: 'prototype-wave',
  description: 'Concept-stage graybox: one mechanic, cube-world, no art/polish → independent build-only gate → automation playtest verdict (fun/promising/flat/broken). Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Build' },
    { title: 'Check' },
    { title: 'Playtest' },
  ],
  requires: ['gameplay'],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'eng-gameplay': 'sonnet',
  'qa-gate-verifier': 'haiku', 'qa-playtest-analyst': 'haiku',
}

// stage guard — prototyping is a concept/preproduction activity only
const STAGES = ['concept', 'preproduction']

const MERGE = { solo: {}, indie: {}, studio: {} }

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
const PLAYTEST_REPORT = { type: 'object', required: ['session', 'findings'], properties: {
  session: { type: 'object', required: ['build', 'protocol'], properties: { build: { type: 'string' }, protocol: { type: 'string' }, duration_minutes: { type: 'integer' } } },
  findings: { type: 'array', items: { type: 'object', required: ['finding', 'impact', 'evidence'], properties: {
    finding: { type: 'string' }, impact: { type: 'string', enum: ['blocking-fun', 'major', 'minor', 'polish'] },
    evidence: { type: 'string' }, pillar: { type: 'string' }, suggestion: { type: 'string' } } } },
  incidental_defects: { type: 'array', items: { type: 'string' } },
  verdict: { type: 'string', enum: ['fun', 'promising', 'flat', 'broken'] } } }

// ── inputs ───────────────────────────────────────────────────────────────
const mechanic = (A && A.mechanic) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!mechanic) return { status: 'needsInput', reason: 'prototype-wave needs a mechanic description (A.mechanic).' }

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else in-repo project.config.json. resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `prototype-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}' — prototyping is a concept/preproduction activity.` }
for (const cap of meta.requires) if (!(project.capabilities || []).includes(cap)) return { status: 'skipped', reason: `profile lacks capability '${cap}'` }
if (!project.repo_path) return { status: 'needsInput', reason: `"${projectRef}" has no repo_path. Prototypes are throwaway — point config.local.json's repo_path at a scratch UE project (not the main project repo) and re-run.` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source} at ${project.repo_path}`)

// ── Phase: Build (graybox ONE mechanic, cube-world, no art/polish) ─────────
phase('Build')
const build = await agent(
  `Graybox ONE mechanic for a throwaway prototype: "${mechanic}". Repo: ${project.repo_path}. Cube-world only — no art, no polish, no VFX pass, no audio pass. Build a minimal test map that isolates just this mechanic for a player to try. GAS for the ability if it's ability-shaped; otherwise the smallest C++/BP surface that lets the mechanic be played and judged. Slice-gate your own files, then hand off. Your gate_result is advisory — an independent verifier re-checks.`,
  { label: 'eng-gameplay', agentType: R('eng-gameplay'), model: M[R('eng-gameplay')] || M['eng-gameplay'], schema: HANDOFF, phase: 'Build' })
if (!build || build.status !== 'ready') return { status: 'needsRework', phase: 'Build', blockers: build?.blockers || ['graybox build did not reach ready'] }

// ── Phase: Check (independent, build-only gate — no automation/cook expected of a throwaway) ──
phase('Check')
const check = await agent(
  `Independently gate this prototype graybox. Repo: ${project.repo_path}. Changed files: ${JSON.stringify(build.files_changed || [])}. Run \`make gate STEP=build\` ONLY — this is a throwaway prototype, not a shippable slice. IGNORE any self-reported gate_result. Report what actually passed/failed. Do not edit code.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Check' })
if (!check || check.result !== 'pass') return { status: 'needsRework', phase: 'Check', failed: check?.failed_step, logs: check?.logs_tail }
if (check.self_report_matched === false) log('⚠ graybox self-reported a gate result that did not match reality (audit signal)')

// ── Phase: Playtest (automation walkthrough of the test map — fun verdict, not correctness) ──
phase('Playtest')
const playtest = await agent(
  `Automation-driven playtest walkthrough of the "${mechanic}" prototype test map. Repo: ${project.repo_path}. Play it (or drive it via automation) and report EXPERIENCE findings only — pacing, clarity, friction, feel — never defects (route those to incidental_defects). The verdict field is the deliverable: is this mechanic fun/promising/flat/broken.`,
  { label: 'qa-playtest-analyst', agentType: 'qa-playtest-analyst', model: M['qa-playtest-analyst'], schema: PLAYTEST_REPORT, phase: 'Playtest' })
if (!playtest || !playtest.verdict) return { status: 'needsRework', phase: 'Playtest', blockers: ['playtest produced no verdict'] }

return {
  status: 'ready',
  mechanic,
  project: projectRef,
  files: build.files_changed || [],
  check,
  report: playtest,
  verdict: playtest.verdict,
  commit_message: build.commit_message || `prototype: graybox ${mechanic}`,
  note: 'Throwaway prototype repo edited (not the main project repo). No git run — review and commit yourself if keeping it.',
}
