export const meta = {
  name: 'gdd-wave',
  description: 'Preproduction GDD authoring: 7 department sections drafted in parallel → design-director synthesis into docs/GDD.md → producer scope-realism review. Docs-only. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Sections' },
    { title: 'Synthesize' },
    { title: 'Review' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'design-director': 'opus', 'design-systems': 'sonnet',
  'design-combat': 'sonnet', 'design-level': 'sonnet', 'narrative-designer': 'sonnet',
  'art-director': 'opus', 'audio-designer': 'sonnet', 'eng-director': 'opus', 'producer': 'opus',
}

// GDD authoring happens once, in preproduction — before there's even a .uproject
const STAGES = ['preproduction']

// staffing merges (subset of references/PROFILES.json relevant to this wave's roles) — at solo
// every design seat collapses onto design-director; narrative/art/audio/eng directors stand alone
const MERGE = {
  solo:  { 'design-systems': 'design-director', 'design-combat': 'design-director', 'design-level': 'design-director' },
  indie: { 'design-combat': 'design-systems' },
  studio: {},
}

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
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `gdd-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}' — the GDD is authored once, at preproduction.` }
for (const cap of meta.requires) if (!(project.capabilities || []).includes(cap)) return { status: 'skipped', reason: `profile lacks capability '${cap}'` }
const R = (r) => (MERGE[project.staffing] || {})[r] || r
const stackCtx = `UE ${project.stack?.engine_version || '5.7'}, GAS + Enhanced Input + UMG/CommonUI locked; audio=${project.stack?.audio || 'Wwise'}; networking=${project.stack?.networking?.mode || 'single-player'}.`
const docsBase = project.repo_path ? `${project.repo_path}/docs` : `references/${projectRef}/docs`
const docsRoot = `${docsBase}/gdd`
const gddFile = `${docsBase}/GDD.md`
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source} — docs under ${docsBase}`)

// ── Phase: Sections (parallel department drafts, deduped by staffing merge) ─
phase('Sections')
const sectionSpecs = [
  { role: 'design-systems', section: 'systems', brief: 'mechanics and progression design — core loop, systems that gate progression, unlock pacing' },
  { role: 'design-combat', section: 'combat', brief: 'combat design — verbs, encounters, difficulty curve, GAS ability surface expected' },
  { role: 'design-level', section: 'level', brief: 'world and level structure — hub/level topology, pacing through spaces, streaming boundaries' },
  { role: 'narrative-designer', section: 'narrative', brief: 'story structure — premise, arc, beats, how narrative interlocks with the core loop' },
  { role: 'art-director', section: 'art', brief: 'visual direction summary — mood, palette, silhouette language, reference pillars' },
  { role: 'audio-designer', section: 'audio', brief: 'audio direction — sonic identity, music/mix approach, Wwise vs MetaSounds implications' },
  { role: 'eng-director', section: 'technical', brief: 'technical constraints and feasibility flags — engine/perf risks, GAS/replication implications, anything infeasible at the locked stack' },
]
// dedupe merged seats onto one agent() call per resolved agentType — combine their section prompts
const groups = new Map()
for (const s of sectionSpecs) {
  const agentType = R(s.role)
  if (!groups.has(agentType)) groups.set(agentType, [])
  groups.get(agentType).push(s)
}
const groupEntries = [...groups.entries()]
const sectionResults = await parallel(groupEntries.map(([agentType, secs]) => () => {
  const list = secs.map(s => `- "${s.section}" (${s.brief}) → write ${docsRoot}/${s.section}.md`).join('\n')
  return agent(
    `Draft ${secs.length > 1 ? 'these GDD sections' : 'this GDD section'} for "${projectRef}" (stage: preproduction). ${stackCtx} Read references/${projectRef}/ (pitch one-sheet, prototype verdict if present) for grounding.\n${list}\nEach file stands alone (a reader jumping straight to it should understand the section) but cross-reference sibling sections by name rather than duplicating their content. files_changed MUST list every file written.`,
    { label: secs.map(s => s.section).join('+'), agentType, model: M[agentType] || M[secs[0].role], schema: HANDOFF, phase: 'Sections' })
}))
const sectionBlockers = []
const sectionFiles = []
for (let i = 0; i < groupEntries.length; i++) {
  const [agentType, secs] = groupEntries[i]
  const r = sectionResults[i]
  if (!r || r.status !== 'ready') { sectionBlockers.push(...(r?.blockers || [`${agentType} (${secs.map(s => s.section).join('+')}) did not reach ready`])); continue }
  sectionFiles.push(...(r.files_changed || []))
}
if (sectionBlockers.length) return { status: 'needsRework', phase: 'Sections', blockers: sectionBlockers }

// ── Phase: Synthesize (design-director merges all sections into docs/GDD.md) ─
phase('Synthesize')
const synthesis = await agent(
  `Synthesize the GDD sections drafted under ${docsRoot}/ into a single ${gddFile}. Sections: ${sectionSpecs.map(s => s.section).join(', ')}. Write a contents map (section → one-line summary → link) at the top, then either inline each section's content or a short synthesis with links back to ${docsRoot}/<section>.md — pick whichever keeps ${gddFile} navigable. Reconcile contradictions between sections explicitly (call them out, propose a resolution) rather than silently picking one.`,
  { label: 'design-director', agentType: 'design-director', model: M['design-director'], schema: HANDOFF, phase: 'Synthesize' })
if (!synthesis || synthesis.status !== 'ready') return { status: 'needsRework', phase: 'Synthesize', blockers: synthesis?.blockers || ['GDD synthesis did not reach ready'] }

// ── Phase: Review (producer scope-realism gate — not a craft review) ────────
phase('Review')
const review = await agent(
  `Scope-realism review of ${gddFile} for "${projectRef}" (${project.staffing} staffing). You are not grading craft — you are checking whether the scope described (systems, combat, level count/structure, narrative length, art/audio ambition) can plausibly fit this staffing scale and a preproduction→vertical-slice runway. Blockers ONLY for scope that cannot fit (e.g. a solo team's GDD implying a 20-level campaign, full VO, or bespoke tooling). List each blocker as 'section — what's oversized — what to cut/defer'. Advisories for anything risky but plausible.`,
  { label: 'producer', agentType: 'producer', model: M['producer'], schema: REVIEW, phase: 'Review' })
if (review?.result === 'fail' && review.blockers?.length) return { status: 'needsRework', phase: 'Review', blockers: review.blockers, review }

const files = [...sectionFiles, ...(synthesis.files_changed || [])]
return {
  status: 'ready',
  project: projectRef,
  docs: { sections: `${docsRoot}/`, gdd: gddFile },
  files,
  review,
  commit_message: synthesis.commit_message || `docs: draft GDD for ${projectRef}\n\n${sectionSpecs.length} sections synthesized into ${gddFile}.`,
  note: 'Working tree edited. No git run — review and commit yourself.',
}
