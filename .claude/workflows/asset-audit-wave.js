export const meta = {
  name: 'asset-audit-wave',
  description: 'Content hygiene sweep: Git-LFS coverage, naming conventions, texture budgets, redirectors, orphans — report with violations; repairs route to /fix. Never runs git (read-only git queries excepted).',
  phases: [
    { title: 'Resolve' },
    { title: 'Audit' },
  ],
  requires: ['content'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-lead': 'sonnet' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const AUDIT = { type: 'object', required: ['result', 'checks'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  checks: { type: 'array', items: { type: 'object', required: ['check', 'result', 'violations'], properties: {
    check: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] },
    violations: { type: 'array', items: { type: 'string' } }, scanned: { type: 'integer' } } } },
  summary: { type: 'string' } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo to audit at stage '${project.stage}'` }
if (!(project.capabilities || []).includes('content')) return { status: 'skipped', reason: "profile lacks capability 'content'" }

phase('Audit')
const audit = await agent(
  `Asset-hygiene audit of "${projectRef}". Run each check and report violations (asset path + what is wrong):
1. lfs-coverage — READ-ONLY git queries: \`git lfs ls-files\` vs binary extensions actually present in Content/ (.uasset .umap .fbx .png .wav .ogg .wem .bnk); anything binary not in LFS is a violation (rules/git-lfs.md).
2. naming — asset prefixes vs rules/ue5-naming.md (BP_, WB_, DA_, DT_, GA_, GE_, NS_, IA_, IMC_, M_, MI_, T_, S_/SM_).
3. texture-budgets — textures over the ceilings in quality/performance-budgets.md (list by size from file metadata; skip if unreadable headlessly).
4. redirectors — leftover redirector assets in Content/.
5. orphans — assets with no inbound reference per .claude/INDEX.json heuristics (mark check skip if INDEX lacks reference data — never guess).
6. reference-integrity — generator scripts in Tools/Python/gen/ whose target assets are missing (regenerate needed) or vice versa.
You may write ONE report file: docs/audits/assets-<today>.md. No other edits, no git writes.`,
  { label: 'qa-lead', agentType: 'qa-lead', model: M['qa-lead'], schema: AUDIT, phase: 'Audit' })
if (!audit) return { status: 'needsRework', phase: 'Audit', reason: 'audit returned nothing' }

const totalViolations = (audit.checks || []).reduce((n, c) => n + (c.violations || []).length, 0)
return {
  status: 'ready', project: projectRef,
  result: audit.result, checks: audit.checks, summary: audit.summary,
  total_violations: totalViolations,
  commit_message: 'chore(audit): asset hygiene report — see docs/audits/',
  note: totalViolations ? 'Violations route through /fix — this wave repairs nothing.' : 'Content hygiene clean.',
}
