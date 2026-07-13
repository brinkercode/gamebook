export const meta = {
  name: 'pitch-wave',
  description: 'Concept interview → high concept + comparables + visual/tone direction → one-sheet, pitch deck, comparables doc → creates references/<project>/ (config.json at stage:concept). Never runs git.',
  phases: [
    { title: 'Draft' },
    { title: 'Assemble' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'design-director': 'opus', 'producer': 'opus',
  'art-concept': 'sonnet', 'narrative-designer': 'sonnet',
}

// This wave CREATES the project binding — there is no project yet to resolve or gate a
// stage against. No resolve-project call, no STAGES guard. Declared empty for the checklist.
const STAGES = []

// ── compact schema mirrors (ad hoc — no canonical shared schema for pitch drafts) ─
const DESIGN_DRAFT = { type: 'object', required: ['high_concept', 'pillars', 'core_loop', 'one_sheet_draft'], properties: {
  high_concept: { type: 'string' }, pillars: { type: 'array', items: { type: 'string' } },
  core_loop: { type: 'string' }, one_sheet_draft: { type: 'string' },
  genre: { type: 'string' }, player_fantasy: { type: 'string' } } }
const BUSINESS_DRAFT = { type: 'object', required: ['comparables', 'audience', 'biggest_risk', 'scope_runway'], properties: {
  comparables: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, similarity: { type: 'string' } } } },
  audience: { type: 'string' }, biggest_risk: { type: 'string' }, scope_runway: { type: 'string' },
  vision: { type: 'string' }, one_pager: { type: 'string' } } }
const ART_DRAFT = { type: 'object', required: ['visual_direction', 'references'], properties: {
  visual_direction: { type: 'string' }, references: { type: 'array', items: { type: 'string' } }, tone_words: { type: 'array', items: { type: 'string' } } } }
const NARRATIVE_DRAFT = { type: 'object', required: ['tone', 'delivery_mode'], properties: {
  tone: { type: 'string' }, delivery_mode: { type: 'string' }, notes: { type: 'string' } } }
// mirrors agents/_shared/schemas/handoff.schema.json (compact) — used for the Assemble write
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' },
  status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }

// ── inputs ───────────────────────────────────────────────────────────────
const concept = (A && A.concept) || ''
const projectRef = (A && A.project) || ''
const staffing = (A && A.staffing) || 'solo'
if (!projectRef) return { status: 'needsInput', reason: 'pitch-wave needs a project name (A.project, kebab-case).' }
if (!concept || concept.trim().split(/\s+/).length < 6) {
  return { status: 'needsInput', reason: 'Concept is too thin to draft a pitch. Run the skills/concept-interview question bank (Section 1: genre + player fantasy + core loop) with the user, then re-launch with a fuller A.concept.' }
}
log(`drafting pitch for "${projectRef}" (${staffing} staffing)`)

// ── Phase: Draft (parallel — 4 independent seats, no cross-talk yet) ───────
phase('Draft')
const [design, business, art, narrative] = await parallel([
  () => agent(`High concept for a new UE5 FPS project: "${concept}". If thin, apply skills/concept-interview Section 1 & 3 framing yourself (one-sentence player-fantasy pitch, core loop, 3-5 design pillars with a named tiebreaker). Draft a one-sheet.`,
    { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: DESIGN_DRAFT, phase: 'Draft' }),
  () => agent(`Comparables + business framing for: "${concept}". Name 3+ direct comparable games with similarity notes, target audience, the single biggest business/scope risk, and a scope-runway note (team size × timeline × "done" for a vertical slice per skills/concept-interview Section 2). Draft a business one-pager.`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: BUSINESS_DRAFT, phase: 'Draft' }),
  () => agent(`Visual direction for: "${concept}". Tone in three words, prose direction, and a reference list (games/films/art) per skills/concept-interview Section 5 framing.`,
    { label: 'art-concept', agentType: 'art-concept', model: M['art-concept'], schema: ART_DRAFT, phase: 'Draft' }),
  () => agent(`Narrative tone + delivery mode for: "${concept}". Is story environmental, scripted-linear, audio-log, cutscene-driven, or absent? One paragraph of notes.`,
    { label: 'narrative-designer', agentType: 'narrative-designer', model: M['narrative-designer'], schema: NARRATIVE_DRAFT, phase: 'Draft' }),
])
if (!design || !design.high_concept) return { status: 'needsInput', reason: 'design-director could not produce a high concept — concept is likely still too thin.' }
if (!business) return { status: 'needsRework', phase: 'Draft', blockers: ['producer draft failed'] }
if (!art) return { status: 'needsRework', phase: 'Draft', blockers: ['art-concept draft failed'] }
if (!narrative) return { status: 'needsRework', phase: 'Draft', blockers: ['narrative-designer draft failed'] }

// ── Phase: Assemble (design-director merges the four drafts + creates the project binding) ─
phase('Assemble')
const assembled = await agent(
  `Assemble the pitch for "${projectRef}" (staffing: ${staffing}) from these four drafts and create the project binding.
   Design draft: ${JSON.stringify(design)}
   Business draft: ${JSON.stringify(business)}
   Art draft: ${JSON.stringify(art)}
   Narrative draft: ${JSON.stringify(narrative)}

   Write exactly these files:
   1. references/${projectRef}/pitch/one-sheet.md — high concept, pillars, core loop, tone.
   2. references/${projectRef}/pitch/pitch-deck.md — full pitch: concept, pillars, audience, visual direction, narrative approach, references, biggest risk, scope runway.
   3. references/${projectRef}/pitch/comparables.md — the comparables list with similarity notes.
   4. references/${projectRef}/config.json — copy the shape of references/_TEMPLATE/config.json exactly (all keys present), filling: name="${projectRef}", description=<one-line high concept>, staffing="${staffing}", stage="concept", stage_history=[{ stage: "concept", note: "pitch-wave created project binding" }], design.genre/pillars/reference_games/art_direction/narrative.tone/narrative.delivery from the drafts above, business.vision/audience/biggest_risk/comparables from the business draft. Leave stack/platforms/storefronts at template defaults unless the concept explicitly demands otherwise.

   Report files_changed[] (op:"add" for all four) and a commit_message.`,
  { label: 'design-director:assemble', agentType: 'design-director', model: M['design-director'], schema: HANDOFF, phase: 'Assemble' })
if (!assembled || assembled.status !== 'ready') return { status: 'needsRework', phase: 'Assemble', blockers: assembled?.blockers || ['pitch assembly did not reach ready'] }

return {
  status: 'ready',
  project: projectRef,
  high_concept: design.high_concept,
  pillars: design.pillars,
  files: assembled.files_changed,
  commit_message: assembled.commit_message || `feat: pitch for ${projectRef}\n\nOne-sheet, pitch deck, comparables. Project binding created at stage:concept.`,
  note: 'Working tree edited. No git run — review and commit yourself. Next: run /prototype to graybox one mechanic, then /concept-greenlight once a prototype verdict exists.',
}
