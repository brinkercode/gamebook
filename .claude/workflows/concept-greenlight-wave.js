export const meta = {
  name: 'concept-greenlight-wave',
  description: 'Concept-stage project-fate gate: two independent panel seats (design-director + producer) judge the pitch strictly vs criteria — pass advances stage to preproduction, redesign returns merged directives, kill is an honored outcome. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Panel' },
    { title: 'Transition' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'greenlight-panel': 'fable', 'producer': 'opus',
}

// concept-greenlight only runs against fresh-pitch projects still at concept
const STAGES = ['concept']

// ── compact schema mirrors (source: agents/_shared/schemas/*.json) ───────
const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, profile: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array' }, notes: { type: 'string' } } }
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
if (!projectRef) return { status: 'needsInput', reason: 'concept-greenlight-wave needs a project (A.project).' }

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else fall back to in-repo project.config.json. Return the structured profile; resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch (new project) first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `concept-greenlight-wave runs at [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}'.` }
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

const criteria = [
  `Pitch artifacts complete in references/${projectRef}/pitch/ — one-sheet, deck, comparables all present.`,
  `Prototype playtest verdict is fun or promising (read the latest report path from ${A.playtest ? `args.playtest ("${A.playtest}")` : `references/${projectRef}/pitch/`}).`,
  `Risk is articulated — key production/design/market risks named, not glossed over.`,
]
const panelPrompt = (seat) =>
  `Concept greenlight for project "${projectRef}", seat: ${seat}. Judge STRICTLY against these pre-agreed criteria (do not invent new ones): ${JSON.stringify(criteria)}. ` +
  `Read references/${projectRef}/pitch/ (one-sheet, deck, comparables) and the prototype playtest report (${A.playtest || `references/${projectRef}/pitch/`}) yourself before judging. ` +
  `Score each criterion individually with evidence. verdict: pass only if every criterion is met; redesign if fixable gaps remain (give concrete redesign_directives); kill if the concept should not proceed — kill is an honored, normal outcome, not a failure. next_stage: "preproduction" only on pass, else null. You judge; you do not author.`

// ── Phase: Panel (two INDEPENDENT seats, parallel) ──────────────────────────
phase('Panel')
const [seatDesign, seatProducer] = await parallel([
  () => agent(panelPrompt('design-director'), { label: 'design-director', agentType: 'design-director', model: M['greenlight-panel'], schema: GREENLIGHT, phase: 'Panel' }),
  () => agent(panelPrompt('producer'), { label: 'producer', agentType: 'producer', model: M['producer'], schema: GREENLIGHT, phase: 'Panel' }),
])
if (!seatDesign || !seatProducer) return { status: 'blocked', phase: 'Panel', reason: 'one or both panel seats did not return a verdict', seatDesign, seatProducer }

// kill beats redesign beats pass — either seat can kill or send back for redesign
let verdict
if (seatDesign.verdict === 'kill' || seatProducer.verdict === 'kill') verdict = 'kill'
else if (seatDesign.verdict === 'redesign' || seatProducer.verdict === 'redesign') verdict = 'redesign'
else verdict = 'pass'

if (verdict === 'kill') {
  return {
    status: 'ready',
    verdict: 'kill',
    project: projectRef,
    seats: { design_director: seatDesign, producer: seatProducer },
    rationale: [seatDesign.rationale, seatProducer.rationale].filter(Boolean).join(' | '),
    note: 'Concept killed at panel. No files changed.',
  }
}

if (verdict === 'redesign') {
  const redesign_directives = [...new Set([...(seatDesign.redesign_directives || []), ...(seatProducer.redesign_directives || [])])]
  return {
    status: 'ready',
    verdict: 'redesign',
    project: projectRef,
    seats: { design_director: seatDesign, producer: seatProducer },
    redesign_directives,
    note: 'Concept sent back for redesign. No files changed — resubmit after addressing directives.',
  }
}

// ── Phase: Transition (both seats passed — producer writes the stage move) ──
phase('Transition')
const transition = await agent(
  `Both greenlight seats passed for "${projectRef}". Edit references/${projectRef}/config.json: set stage to "preproduction" and append a stage_history entry (from:"concept", to:"preproduction", gate:"concept-greenlight", date, rationale summarizing the panel's pass). Do not touch any other field. Report files_changed + commit_message.`,
  { label: 'producer:transition', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Transition' })
if (!transition || transition.status !== 'ready') return { status: 'needsRework', phase: 'Transition', blockers: transition?.blockers || ['stage transition edit did not reach ready'], seats: { design_director: seatDesign, producer: seatProducer } }

return {
  status: 'ready',
  verdict: 'pass',
  project: projectRef,
  next_stage: 'preproduction',
  seats: { design_director: seatDesign, producer: seatProducer },
  files: transition.files_changed,
  commit_message: transition.commit_message || `chore: concept-greenlight pass — ${projectRef} advances to preproduction`,
  note: 'Working tree edited (config.json stage transition). No git run — review and commit yourself.',
}
