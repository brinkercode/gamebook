export const meta = {
  name: 'playtest-wave',
  description: 'Weekly-build playtest: automation-driven walkthrough → experience findings vs design pillars (fun ≠ correctness). Read-only, no gates, no repairs. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Play' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-playtest-analyst': 'haiku' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const PLAYTEST = { type: 'object', required: ['session', 'findings'], properties: {
  session: { type: 'object', required: ['build', 'protocol'], properties: { build: { type: 'string' }, protocol: { type: 'string' }, duration_minutes: { type: 'integer' } } },
  findings: { type: 'array', items: { type: 'object', required: ['finding', 'impact', 'evidence'], properties: {
    finding: { type: 'string' }, impact: { type: 'string', enum: ['blocking-fun', 'major', 'minor', 'polish'] },
    evidence: { type: 'string' }, pillar: { type: 'string' }, suggestion: { type: 'string' } } } },
  incidental_defects: { type: 'array', items: { type: 'string' } },
  verdict: { type: 'string', enum: ['fun', 'promising', 'flat', 'broken'] } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `playtest-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }

phase('Play')
const report = await agent(
  `Playtest the current build of "${projectRef}"${A.focus ? ` focusing on: ${A.focus}` : ''}. Drive it via \`make automation-critical\` plus reading the resulting logs/screens; be HONEST in session.protocol about what a headless run cannot feel (game-feel, audio mix, readability). Judge the EXPERIENCE against the design pillars in references/${projectRef}/config.json and docs/GDD.md: pacing, clarity, friction, moment-to-moment engagement. Findings are experience observations, never bug reports — bugs you trip over go in incidental_defects verbatim. One-word verdict: fun/promising/flat/broken.`,
  { label: 'qa-playtest-analyst', agentType: 'qa-playtest-analyst', model: M['qa-playtest-analyst'], schema: PLAYTEST, phase: 'Play' })
if (!report) return { status: 'needsRework', phase: 'Play', reason: 'playtest returned nothing' }

return {
  status: 'ready', project: projectRef,
  verdict: report.verdict, findings: report.findings,
  incidental_defects: report.incidental_defects || [],
  session: report.session,
  note: (report.incidental_defects || []).length ? 'Incidental defects found — route them through /bug-hunt or /fix, they were not judged here.' : 'Experience report only; nothing edited.',
}
