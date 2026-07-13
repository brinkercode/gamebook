export const meta = {
  name: 'review-wave',
  description: 'Multi-dimension code/content review: 4 dimension reviewers find → adversarial skeptic tries to REFUTE each finding → only CONFIRMED findings reported. Read-only. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Find' },
    { title: 'Verify' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'eng-gameplay': 'sonnet', 'eng-network': 'sonnet', 'design-technical': 'sonnet', 'qa-lead': 'sonnet', 'qa-bug-hunter': 'sonnet' }
const STAGES = ['vertical-slice', 'production', 'alpha', 'beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const FINDING = { type: 'object', required: ['dimension', 'findings'], properties: {
  dimension: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', required: ['title', 'detail', 'severity'], properties: {
    title: { type: 'string' }, detail: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
    fix: { type: 'string' }, verdict: { type: 'string', enum: ['CONFIRMED', 'REFUTED', 'UNVERIFIED'] } } } } } }
const SKEPTIC = { type: 'object', required: ['verdict'], properties: {
  verdict: { type: 'string', enum: ['CONFIRMED', 'REFUTED'] }, reason: { type: 'string' } } }

const scope = (A && A.scope) || 'the whole project'
const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `no repo to review at stage '${project.stage}'` }
const multiplayer = (project.capabilities || []).includes('multiplayer')

const DIMS = [
  { key: 'gas-perf', role: 'eng-gameplay', prompt: `Review ${scope} for gas-patterns + perf anti-patterns: ability lifecycle (CommitAbility, EndAbility on all exits), attribute clamping placement, hand-rolled cooldowns, tick abuse, hard object references, per-frame allocations. Dimension: "gas-perf".` },
  ...(multiplayer ? [{ key: 'replication', role: 'eng-network', prompt: `Review ${scope} for replication correctness: RPCs missing WithValidation, Multicast used for state, missing COND_* flags, client-trusted state, GAS prediction misuse. Dimension: "replication".` }] : []),
  { key: 'bp-hygiene', role: 'design-technical', prompt: `Review ${scope} for bp-hygiene: logic living in Blueprints that belongs in C++ (combat math, replicated state, clamping), fat event graphs, missing thin-handler pattern, naming vs rules/ue5-naming.md. Dimension: "bp-hygiene".` },
  { key: 'save-security', role: 'qa-lead', prompt: `Review ${scope} against save-integrity + agents/_shared/SECURITY_CHECKLIST.md: unencrypted saves, missing schema version, raw UObject pointers serialized, monetization client-trust, debug console in Shipping. Dimension: "save-security".` },
]

phase('Find')
const found = await pipeline(DIMS,
  (d) => agent(`${d.prompt} Findings need file:line + the concrete failure each causes. You review; you do not edit.`,
    { label: `find:${d.key}`, agentType: d.role, model: M[d.role], schema: FINDING, phase: 'Find' }),
  (result, d) => {
    if (!result || !result.findings || !result.findings.length) return { dimension: d.key, findings: [] }
    return parallel(result.findings.slice(0, 6).map((f) => () =>
      agent(`Adversarially verify this ${d.key} finding — try to REFUTE it. "${f.title}": ${f.detail}. Read the actual code/assets; construct the concrete failure. If you cannot construct it, verdict REFUTED (the default). Do not edit anything.`,
        { label: `skeptic:${d.key}`, agentType: 'qa-bug-hunter', model: M['qa-bug-hunter'], schema: SKEPTIC, phase: 'Verify' })
        .then((s) => ({ ...f, verdict: s?.verdict || 'UNVERIFIED', skeptic_reason: s?.reason }))
    )).then((verified) => ({ dimension: d.key, findings: verified }))
  })

phase('Verify')
const confirmed = (found || []).filter(Boolean).flatMap((d) => (d.findings || []).filter((f) => f.verdict === 'CONFIRMED').map((f) => ({ ...f, dimension: d.dimension })))
const order = { blocker: 0, major: 1, minor: 2 }
confirmed.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
log(`${confirmed.length} confirmed finding(s) across ${found.filter(Boolean).length} dimensions`)

return {
  status: 'ready', project: projectRef, scope,
  confirmed,
  dimensions_run: DIMS.map((d) => d.key),
  note: confirmed.length ? 'Findings are read-only — apply fixes via /fix (small) or /feature (structural).' : 'No finding survived adversarial verification.',
}
