export const meta = {
  name: 'scaffold-wave',
  description: 'Turn a decided project config into a real UE5 repo: project-scaffolder runs gamebook-init.sh conventions at repo_path, persists repo_path + copies docs, an independent qa-gate-verifier checks skeleton integrity (not a full engine build). Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Create' },
    { title: 'Verify' },
  ],
  requires: [],
}

// normalize harness args (may arrive as object, JSON string, or undefined)
const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

// ── models.json mirror (scripts have no fs) ──────────────────────────────
const M = {
  'resolve-project': 'haiku', 'project-scaffolder': 'opus', 'qa-gate-verifier': 'haiku',
}

// scaffold-wave fires when preproduction-exit-wave passes; idempotent re-runs are legal
// once the repo exists at vertical-slice too (gamebook-init.sh never overwrites).
const STAGES = ['preproduction', 'vertical-slice']

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

// ── inputs ───────────────────────────────────────────────────────────────
const projectRef = (A && A.project) || ''
const repoPath = (A && A.repo_path) || ''
if (!projectRef) return { status: 'needsInput', reason: 'scaffold-wave needs a project name (A.project, kebab-case).' }
if (!repoPath) return { status: 'needsInput', reason: 'scaffold-wave needs a target repo_path (A.repo_path) to create the UE5 project skeleton at.' }

// ── Phase: Resolve ─────────────────────────────────────────────────────────
phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}". Read references/${projectRef}/config.json (+ config.local.json), else fall back to in-repo project.config.json. Return the structured profile; resolved:false if neither exists.`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}". Run /pitch (new project) first.` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `scaffold-wave runs in [${STAGES.join(', ')}] but "${projectRef}" is at '${project.stage}' — the repo skeleton is created once at preproduction exit.` }
log(`resolved ${projectRef} (${project.stage}, ${project.staffing} staffing) from ${project.source}`)

// ── Phase: Create (project-scaffolder — the only agent that runs gamebook-init.sh) ─────
phase('Create')
const created = await agent(
  `Create the UE5 project skeleton for "${projectRef}" at repo_path: ${repoPath}. Config: ${JSON.stringify(project.stack || {})}, platforms: ${JSON.stringify(project.platforms || [])}.
   Run \`bash scripts/gamebook-init.sh\` conventions non-destructively against ${repoPath}: Source/<Name>{,Editor,Tests}, Content/, Config/ (DefaultEngine.ini, perf baseline off Nanite/Lumen per project.stack.perf), docs/ stubs, Makefile, .gitattributes (Git LFS), .claude/ wiring (settings.json, hooks symlinks, rules copy, agents/skills symlinks, handoffs/), and the .uproject file.
   Then: (1) write repo_path="${repoPath}" into references/${projectRef}/config.local.json (shallow-merge, never clobber other keys), (2) copy references/${projectRef}/docs/*.md into ${repoPath}/docs/ (never overwrite a doc that already has real content — gamebook-init.sh's stub is fine to overwrite, a filled-in doc is not).
   Never write stage or stage_history — that is exclusively a greenlight/gate wave's job. Report every path touched in files_changed[] (op:"add" for new skeleton files, op:"modify" for config.local.json) and a commit_message. If repo_path already has a conflicting non-gamebook project at it, hand back status:blocked — do not overwrite unrelated content.`,
  { label: 'project-scaffolder', agentType: 'project-scaffolder', model: M['project-scaffolder'], schema: HANDOFF, phase: 'Create' })
if (!created || created.status !== 'ready') return { status: 'needsRework', phase: 'Create', blockers: created?.blockers || ['project scaffold did not reach ready'] }

// ── Phase: Verify (independent, skeleton-only — NOT a full engine build; the engine may not even be installed yet) ─
phase('Verify')
const verdict = await agent(
  `Independently verify the SKELETON (not a full build — the UE5 engine may not be installed on this machine yet) created at ${repoPath} for "${projectRef}". Changed files: ${JSON.stringify(created.files_changed || [])}.
   Check and report each as a step: (1) required paths exist — Source/, Content/, Config/, docs/, Makefile, .gitattributes, .claude/; (2) the .uproject file parses as valid JSON; (3) references/${projectRef}/config.local.json contains repo_path; (4) \`make index\` runs successfully from ${repoPath} if a Makefile + INDEX generator are present.
   Be honest about what is genuinely skippable (e.g. UnrealBuildTool compile, cook, automation tests) because the engine isn't installed — mark those steps "skip", not "pass". IGNORE any self-reported gate_result from project-scaffolder. Do not edit anything.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Verify' })
if (!verdict || verdict.result !== 'pass') return { status: 'needsRework', phase: 'Verify', failed: verdict?.failed_step, logs: verdict?.logs_tail }
if (verdict.self_report_matched === false) log('⚠ project-scaffolder self-reported a gate result that did not match reality (audit signal)')

return {
  status: 'ready',
  project: projectRef,
  repo_path: repoPath,
  files: created.files_changed || [],
  verify: verdict,
  commit_message: created.commit_message || `chore: scaffold ${projectRef} UE5 project skeleton`,
  note: 'Working tree edited (repo skeleton created at repo_path; references/ config.local.json updated). No git run — review and commit yourself. Full engine build/cook is unverified until the engine is installed — run /fix or /ship to exercise the real gate.',
}
