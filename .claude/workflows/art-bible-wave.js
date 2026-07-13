export const meta = {
  name: 'art-bible-wave',
  description: 'Preproduction art bible: art-director (style guide) + art-concept (Megascans/marketplace asset strategy) draft in parallel → art-director merges docs/ART_BIBLE.md. Never runs git.',
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
  'resolve-project': 'haiku', 'art-director': 'opus', 'art-concept': 'sonnet',
}

// preproduction only — the art bible drafts alongside the macro/tech plan, before the repo exists
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
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `art-bible-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}'.` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

// ── Phase: Draft (parallel — style guide + asset strategy) ─────────────────
phase('Draft')
const [styleGuide, assetStrategy] = await parallel([
  () => agent(
    `Draft the ART STYLE GUIDE half of the art bible for "${projectRef}". Read references/${projectRef}/config.json design pillars and reference-game analysis if present. Cover: palettes (per biome/set if applicable), lighting mood, proportions/silhouette language, and overall UI look. This is direction, not a full GDD section — keep it tight and decisive. Return the draft content in your handoff summary/decisions; do not write docs/ART_BIBLE.md yet — that happens at Merge.`,
    { label: 'art-director', agentType: R('art-director'), model: M['art-director'], schema: HANDOFF, phase: 'Draft' }),
  () => agent(
    `Draft the ASSET STRATEGY half of the art bible for "${projectRef}". Read references/${projectRef}/config.json. Per the locked asset strategy (Quixel Megascans + Marketplace first, in-house art minimal): produce pick lists per biome/set naming candidate Megascans/marketplace packs, and a gap list of anything that needs custom in-house work with a rough reason why off-the-shelf won't cover it. Return the draft content in your handoff summary/decisions; do not write docs/ART_BIBLE.md yet — that happens at Merge.`,
    { label: 'art-concept', agentType: 'art-concept', model: M['art-concept'], schema: HANDOFF, phase: 'Draft' }),
])
if (!styleGuide || styleGuide.status !== 'ready') return { status: 'needsRework', phase: 'Draft', blockers: styleGuide?.blockers || ['style guide draft did not reach ready'] }
if (!assetStrategy || assetStrategy.status !== 'ready') return { status: 'needsRework', phase: 'Draft', blockers: assetStrategy?.blockers || ['asset strategy draft did not reach ready'] }

// ── Phase: Merge (art-director owns the merged docs/ART_BIBLE.md) ──────────
phase('Merge')
const merged = await agent(
  `Merge the two art bible drafts into a single docs/ART_BIBLE.md for "${projectRef}". Style guide draft (yours): ${JSON.stringify(styleGuide.decisions || styleGuide.files_changed)}. Asset strategy draft (art-concept): ${JSON.stringify(assetStrategy.decisions || assetStrategy.files_changed)}. Sections required: (1) style guide — palettes, lighting mood, proportions, UI look; (2) asset strategy — Megascans/marketplace pick lists per biome/set, gap list needing custom work. Resolve any conflicts between the two drafts yourself; you own the final document.`,
  { label: 'art-director:merge', agentType: R('art-director'), model: M['art-director'], schema: HANDOFF, phase: 'Merge' })
if (!merged || merged.status !== 'ready') return { status: 'needsRework', phase: 'Merge', blockers: merged?.blockers || ['art bible merge did not reach ready'] }

const files = [...(styleGuide?.files_changed || []), ...(assetStrategy?.files_changed || []), ...(merged?.files_changed || [])]
return {
  status: 'ready',
  project: projectRef,
  files,
  commit_message: merged.commit_message || `docs: art bible for ${projectRef}`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
