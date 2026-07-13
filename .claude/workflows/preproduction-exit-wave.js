export const meta = {
  name: 'preproduction-exit-wave',
  description: 'Preproduction-exit project-fate gate: read-only inventory of locked GDD/macro/tech/art docs, then two independent panel seats (design-director + eng-director) judge design coherence and tech feasibility — pass advances stage to vertical-slice, redesign returns merged directives, kill is an honored outcome. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Inventory' },
    { title: 'Panel' },
    { title: 'Transition' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'qa-lead': 'sonnet', 'greenlight-panel': 'fable', 'producer': 'opus',
}

// preproduction-exit only runs against projects that finished the preproduction doc set
const STAGES = ['preproduction']

// ── compact schema mirrors (source: agents/_shared/schemas/*.json) ───────
const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, profile: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array' }, notes: { type: 'string' } } }
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } },
  advisories: { type: 'array' }, dimensions_checked: { type: 'array' }, docs_drift: { type: 'array' } } }
const GREENLIGHT = { type: 'object', required: ['verdict', 'criteria'], properties: {
  verdict: { type: 'string', enum: ['pass', 'redesign', 'kill'] },
  criteria: { type: 'array', items: { type: 'object', required: ['criterion', 'met'], properties: {
    criterion: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } } } },
  rationale: { type: 'string' }, conditions: { type: 'array', items: { type: 'string' } },
  redesign_directives: { type: 'array', items: { type: 'string' } },
  next_stage: { type: ['string', 'null'] } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' },
  status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] }, escalate: { type: 'boolean' },
  gate_result: { type: 'string', enum: ['pass', 'fail'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array', items: { type: 'string' } },
  blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

// ── inputs ───────────────────────────────────────────────────────────────
const projectRef = (A && A.project) || '_TEMPLATE'
if (!projectRef) return { status: 'needsInput', reason: 'preproduction-exit-wave needs a project (A.project).' }

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else fall back to in-repo project.config.json. Return the structured profile; resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch (new project) first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `preproduction-exit-wave runs at [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}'.` }
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

// ── Phase: Inventory (READ-ONLY — the locked doc set must exist and be real) ─
phase('Inventory')
const requiredDocs = [
  `references/${projectRef}/GDD.md`,
  `references/${projectRef}/MACRO_DESIGN.md`,
  `references/${projectRef}/TECH_PLAN.md`,
  `references/${projectRef}/ART_BIBLE.md`,
]
const inventory = await agent(
  `READ-ONLY inventory check for project "${projectRef}" before the preproduction-exit panel convenes. Confirm each of these exists and is NOT a stub: ${JSON.stringify(requiredDocs)}. "Non-stub" means each is roughly 100+ lines OR has real, filled-in sections (not placeholder headings / TODOs). Read the actual file contents — do not just check existence. blockers[] MUST name every missing or stub doc as 'path — what's missing'. result: fail if any doc is missing or stub; pass only if all four are present and substantive. Do not edit anything.`,
  { label: 'qa-lead', agentType: 'qa-lead', model: M['qa-lead'], schema: REVIEW, phase: 'Inventory' })
if (!inventory) return { status: 'blocked', phase: 'Inventory', reason: 'inventory check did not return a verdict' }
if (inventory.result === 'fail' && inventory.blockers?.length) return { status: 'needsRework', phase: 'Inventory', blockers: inventory.blockers }

const criteria = [
  `Design coherence — GDD and MACRO_DESIGN.md are consistent with each other; no contradicting mechanics or scope.`,
  `Pillars are traceable — the pillars named in MACRO_DESIGN.md trace back to concrete GDD sections (systems, content, UX).`,
  `Tech plan is feasible — TECH_PLAN.md's architecture and person-day estimates are realistic for the team/timeline; named risks carry credible mitigations, not hand-waving.`,
]
const panelPrompt = (seat, focus) =>
  `Preproduction-exit greenlight for project "${projectRef}", seat: ${seat}. Judge STRICTLY against these pre-agreed criteria (do not invent new ones): ${JSON.stringify(criteria)}. ` +
  `Read references/${projectRef}/GDD.md, MACRO_DESIGN.md, TECH_PLAN.md, and ART_BIBLE.md yourself before judging. Your primary focus: ${focus}. ` +
  `Score each criterion individually with evidence. verdict: pass only if every criterion is met; redesign if fixable gaps remain (give concrete redesign_directives); kill if the project should not proceed to production — kill is an honored, normal outcome, not a failure. next_stage: "vertical-slice" only on pass, else null. You judge; you do not author.`

// ── Phase: Panel (two INDEPENDENT seats, parallel, project-fate gate) ──────
phase('Panel')
const [seatDesign, seatEng] = await parallel([
  () => agent(panelPrompt('design-director', 'design coherence — GDD/macro consistency, pillars traceable end-to-end'),
    { label: 'design-director', agentType: 'design-director', model: M['greenlight-panel'], schema: GREENLIGHT, phase: 'Panel' }),
  () => agent(panelPrompt('eng-director', 'tech feasibility — architecture soundness, estimate realism, risk mitigations credible'),
    { label: 'eng-director', agentType: 'eng-director', model: M['greenlight-panel'], schema: GREENLIGHT, phase: 'Panel' }),
])
if (!seatDesign || !seatEng) return { status: 'blocked', phase: 'Panel', reason: 'one or both panel seats did not return a verdict', seatDesign, seatEng }

// kill beats redesign beats pass — either seat can kill or send back for redesign
let verdict
if (seatDesign.verdict === 'kill' || seatEng.verdict === 'kill') verdict = 'kill'
else if (seatDesign.verdict === 'redesign' || seatEng.verdict === 'redesign') verdict = 'redesign'
else verdict = 'pass'

if (verdict === 'kill') {
  return {
    status: 'ready',
    verdict: 'kill',
    project: projectRef,
    seats: { design_director: seatDesign, eng_director: seatEng },
    rationale: [seatDesign.rationale, seatEng.rationale].filter(Boolean).join(' | '),
    note: 'Project killed at preproduction-exit panel. No files changed.',
  }
}

if (verdict === 'redesign') {
  const redesign_directives = [...new Set([...(seatDesign.redesign_directives || []), ...(seatEng.redesign_directives || [])])]
  return {
    status: 'ready',
    verdict: 'redesign',
    project: projectRef,
    seats: { design_director: seatDesign, eng_director: seatEng },
    redesign_directives,
    note: 'Sent back for redesign. No files changed — resubmit after addressing directives.',
  }
}

// ── Phase: Transition (both seats passed — producer writes the stage move) ──
phase('Transition')
const transition = await agent(
  `Both preproduction-exit greenlight seats passed for "${projectRef}". Edit references/${projectRef}/config.json: set stage to "vertical-slice" and append a stage_history entry (from:"preproduction", to:"vertical-slice", gate:"preproduction-exit", date, rationale summarizing the panel's pass). Do not touch any other field. Report files_changed + commit_message.`,
  { label: 'producer:transition', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Transition' })
if (!transition || transition.status !== 'ready') return { status: 'needsRework', phase: 'Transition', blockers: transition?.blockers || ['stage transition edit did not reach ready'], seats: { design_director: seatDesign, eng_director: seatEng } }

return {
  status: 'ready',
  verdict: 'pass',
  project: projectRef,
  next_stage: 'vertical-slice',
  seats: { design_director: seatDesign, eng_director: seatEng },
  files: transition.files_changed,
  commit_message: transition.commit_message || `chore: preproduction-exit pass — ${projectRef} advances to vertical-slice`,
  note: 'Working tree edited (config.json stage transition). No git run — review and commit yourself. Run /scaffold next to create the UE project.',
}
