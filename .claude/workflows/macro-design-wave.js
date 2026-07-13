export const meta = {
  name: 'macro-design-wave',
  description: 'Preproduction macro design doc: design-director authors docs/MACRO_DESIGN.md (level x story x systems flow matrix, difficulty curve, player-verb inventory) → producer reviews for scope. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Author' },
    { title: 'Review' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'design-director': 'opus', 'producer': 'opus',
}

// preproduction only — the macro locks at preproduction-exit
const STAGES = ['preproduction']

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
const REVIEW = { type: 'object', required: ['result', 'blockers'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] }, blockers: { type: 'array', items: { type: 'string' } },
  advisories: { type: 'array' }, dimensions_checked: { type: 'array' }, docs_drift: { type: 'array' } } }

// ── inputs ───────────────────────────────────────────────────────────────
const projectRef = (A && A.project) || '_TEMPLATE'

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else fall back to in-repo project.config.json. Return the structured profile; resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch (new project) first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `macro-design-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}'.` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

// ── Phase: Author (design-director writes the ~5-page macro) ───────────────
phase('Author')
const macro = await agent(
  `Author docs/MACRO_DESIGN.md for "${projectRef}" — a tight ~5-page macro design document, NOT a full GDD. Read references/${projectRef}/config.json design pillars and any existing docs/GDD.md if present. Sections required: (1) a level x story x systems flow matrix mapping each level/beat to its story beat and the systems/verbs active in it, (2) a difficulty curve across the full arc, (3) a player-verb inventory (every core verb the player can perform, with the level/system that introduces it). Keep it macro-level — no line-item content lists, no scene-by-scene script. This document LOCKS at preproduction-exit: flag any section you're uncertain of as a decision needing producer sign-off rather than guessing.`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: HANDOFF, phase: 'Author' })
if (!macro || macro.status !== 'ready') return { status: 'needsRework', phase: 'Author', blockers: macro?.blockers || ['macro design draft did not reach ready'] }

// ── Phase: Review (producer — independent, scope-focused) ──────────────────
phase('Review')
const review = await agent(
  `Review docs/MACRO_DESIGN.md for "${projectRef}" for SCOPE: is the level x story x systems matrix buildable at this project's staffing (${project.staffing}) and stack? Does the difficulty curve and verb inventory imply more systems/content than the profile can support? Blockers as 'section — what — fix'. You review; you do not author.`,
  { label: 'producer', agentType: 'producer', model: M['producer'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers, review }

return {
  status: 'ready',
  project: projectRef,
  files: macro.files_changed || [],
  review,
  commit_message: macro.commit_message || `docs: macro design for ${projectRef}`,
  note: 'Working tree edited. No git run — review and commit yourself. The macro LOCKS at preproduction-exit: post-lock edits require a /milestone deficiency finding or design-director sign-off, not an ad hoc rerun of this wave.',
}
