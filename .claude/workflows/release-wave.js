export const meta = {
  name: 'release-wave',
  description: 'Ship prep: dev+shipping packages → independent artifact verification (strip checks) → store assets + patch notes. The HUMAN presses publish; stage→live only on explicit confirm_live. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Package' },
    { title: 'Verify' },
    { title: 'Assets' },
    { title: 'Confirm' },
  ],
  requires: ['build'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'eng-build': 'sonnet', 'qa-gate-verifier': 'haiku', 'release-manager': 'sonnet', 'producer': 'opus' }
const STAGES = ['gold']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array' }, notes: { type: 'string' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `release-wave runs at gold but stage is '${project.stage}' — pass /rc first` }
if (!(project.capabilities || []).includes('build')) return { status: 'skipped', reason: "profile lacks capability 'build'" }

phase('Package')
const packaged = await agent(
  `Produce the release packages for "${projectRef}": \`make package-dev\` then \`make package-shipping\` (long-running; capture the log tails). Record artifact paths + sizes in decisions[]. If an engine install is unavailable, status:blocked with exactly what is missing — never fake a package.`,
  { label: 'eng-build', agentType: 'eng-build', model: M['eng-build'], schema: HANDOFF, phase: 'Package' })
if (!packaged || packaged.status !== 'ready') return { status: 'needsRework', phase: 'Package', blockers: packaged?.blockers || ['packaging failed'] }

phase('Verify')
const artifacts = await agent(
  `Independent artifact verification for "${projectRef}": shipping + dev packages exist at the paths in ${JSON.stringify(packaged.decisions || [])}, sizes sane (not KB-scale), and the shipping config passes the SECURITY_CHECKLIST strip checks — no debug console, symbols stripped, no .pdb next to the shipping exe, bUseUnityBuild sane. Report each as a step. Do not edit.`,
  { label: 'qa-gate-verifier', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Verify' })
if (!artifacts || artifacts.result !== 'pass') return { status: 'needsRework', phase: 'Verify', failed: artifacts?.failed_step, logs: artifacts?.logs_tail }

phase('Assets')
const assets = await agent(
  `Release assets for "${projectRef}": write/update docs/store/steam-page.md (skills/steam-store-page structure: short description, about, capsule checklist, tags, sysreqs from the perf baseline), docs/release/PATCH_NOTES.md for this build, and docs/release/SUBMISSION.md — the human's checklist: SteamPipe branch upload steps, dual Valve review timeline (3-5 business days each), Coming Soon 2-week minimum, and the explicit line "build promotion and release are YOUR button presses, never the harness's".`,
  { label: 'release-manager', agentType: 'release-manager', model: M['release-manager'], schema: HANDOFF, phase: 'Assets' })

phase('Confirm')
if (A.confirm_live === true) {
  const t = await agent(
    `The user has confirmed the game is PUBLISHED. Record it for "${projectRef}": stage to "live" in references/${projectRef}/config.json, stage_history append {gate: "release", event: "published", from: "gold", to: "live", date: today}.`,
    { label: 'producer', agentType: 'producer', model: M['producer'], schema: HANDOFF, phase: 'Confirm' })
  return { status: 'ready', published: true, files: [...(packaged.files_changed || []), ...((assets && assets.files_changed) || []), ...((t && t.files_changed) || [])], commit_message: 'chore(release): published — stage live', note: 'Stage is now live. /update, /hotfix, /season are unlocked.' }
}
return {
  status: 'ready', published: false,
  artifacts: packaged.decisions || [],
  files: [...(packaged.files_changed || []), ...((assets && assets.files_changed) || [])],
  commit_message: 'chore(release): packages built + store/submission docs prepared',
  note: 'Everything is prepared; docs/release/SUBMISSION.md is your checklist. Publishing is your button. After the game is actually live, re-run /release with confirm_live:true to flip the stage.',
}
