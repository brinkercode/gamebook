export const meta = {
  name: 'hotfix-wave',
  description: 'Expedited crash fix: correlate logs → root-cause + fix top signature → fix accepted ONLY when the re-driven repro proves the error gone → full gate. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Correlate' },
    { title: 'Fix' },
    { title: 'Reprove' },
  ],
  requires: [],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-crash-correlator': 'haiku', 'qa-bug-hunter': 'sonnet', 'qa-gate-verifier': 'haiku' }
const STAGES = ['beta', 'gold', 'live']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, notes: { type: 'string' } } }
const CRASHES = { type: 'object', required: ['crashes'], properties: {
  crashes: { type: 'array', items: { type: 'object', required: ['signature', 'kind'], properties: {
    signature: { type: 'string' }, kind: { type: 'string' }, count: { type: 'integer' },
    callstack_top: { type: 'array', items: { type: 'string' } }, suspected_module: { type: 'string' }, log_excerpt: { type: 'string' } } } },
  sources_parsed: { type: 'array', items: { type: 'string' } }, unparsed_failures: { type: 'integer' } } }
const HANDOFF = { type: 'object', required: ['schema_version', 'agent', 'status', 'files_changed'], properties: {
  schema_version: { type: 'string' }, agent: { type: 'string' }, status: { type: 'string', enum: ['ready', 'blocked', 'skipped'] },
  escalate: { type: 'boolean' },
  files_changed: { type: 'array', items: { type: 'object', required: ['path', 'op', 'summary'], properties: { path: { type: 'string' }, op: { type: 'string' }, summary: { type: 'string' } } } },
  decisions: { type: 'array' }, blockers: { type: 'array', items: { type: 'string' } }, commit_message: { type: 'string' } } }
const REPRO = { type: 'object', required: ['reproduced'], properties: {
  reproduced: { type: 'boolean' }, evidence: { type: 'string' } } }
const GATE = { type: 'object', required: ['result', 'steps'], properties: {
  result: { type: 'string', enum: ['pass', 'fail'] },
  steps: { type: 'array', items: { type: 'object', required: ['step', 'result'], properties: { step: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'skip'] } } } },
  failed_step: { type: ['string', 'null'] }, logs_tail: { type: ['string', 'null'] } } }

const error = (A && (A.error || A.description)) || ''
const projectRef = (A && A.project) || '_TEMPLATE'
if (!error) return { status: 'needsInput', reason: 'hotfix-wave needs an error description or log path (A.error).' }

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `hotfix-wave runs in [${STAGES.join(', ')}] but stage is '${project.stage}' — use /fix earlier in the lifecycle` }

phase('Correlate')
const crashes = await agent(
  `Correlate this reported error on "${projectRef}": "${error}". Parse it plus Saved/Logs + recent automation output into a deduped crash inventory; identify the TOP signature (highest count / matches the report). Parse only — no root-causing.`,
  { label: 'qa-crash-correlator', agentType: 'qa-crash-correlator', model: M['qa-crash-correlator'], schema: CRASHES, phase: 'Correlate' })
const top = crashes && crashes.crashes && crashes.crashes[0]
if (!top) return { status: 'needsInput', reason: 'no crash signature could be extracted — provide a log path or repro steps', unparsed: crashes?.unparsed_failures || 0 }
log(`top signature: ${top.signature} (${top.kind}, count ${top.count || 1})`)

phase('Fix')
const fix = await agent(
  `Root-cause and fix this crash on "${projectRef}" — expedited hotfix, stage '${project.stage}' (debug-only regime; smallest correct fix). Signature: ${top.signature}. Callstack: ${JSON.stringify(top.callstack_top || [])}. Module: ${top.suspected_module || 'unknown'}. Log: ${(top.log_excerpt || '').slice(0, 1500)}. ONE surface; escalate:true if the real fix needs structural change. Record the root cause in decisions[]. Slice-gate; self-report advisory.`,
  { label: 'qa-bug-hunter', agentType: 'qa-bug-hunter', model: M['qa-bug-hunter'], schema: HANDOFF, phase: 'Fix' })
if (fix?.escalate) return { status: 'escalate', reason: 'the real fix is structural — run /feature (or accept a mitigation via /fix)', root_cause: fix.decisions, signature: top.signature }
if (!fix || fix.status !== 'ready') return { status: 'needsRework', phase: 'Fix', blockers: fix?.blockers || ['fix did not complete'] }

phase('Reprove')
const reprove = await agent(
  `RE-DRIVE the crash scenario and report whether it still occurs. Signature: ${top.signature}; original evidence: ${(top.log_excerpt || '').slice(0, 800)}. Run the automation test or scenario that triggered it; check the fresh logs for the signature. reproduced:false ONLY if you actually re-drove it and the signature is gone — never accept the fixer's word. Do not edit.`,
  { label: 'reprove', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: REPRO, phase: 'Reprove' })
if (!reprove || reprove.reproduced !== false) return { status: 'needsRework', phase: 'Reprove', reason: 'the crash still reproduces (or could not be re-driven) — fix not accepted', evidence: reprove?.evidence }
const gate = await agent(
  `Full \`make gate\` (STEP=all) after the hotfix. Do not edit.`,
  { label: 'gate:final', agentType: 'qa-gate-verifier', model: M['qa-gate-verifier'], schema: GATE, phase: 'Reprove' })
if (!gate || gate.result !== 'pass') return { status: 'needsRework', phase: 'Reprove', failed: gate?.failed_step, logs: gate?.logs_tail }

return {
  status: 'ready', project: projectRef,
  signature: top.signature, root_cause: fix.decisions || [],
  files: fix.files_changed,
  verification: reprove.evidence,
  commit_message: fix.commit_message || `hotfix: ${top.signature} — re-driven repro clean`,
  note: 'Fix proven by re-driving the repro + full gate. Deploy via your patch flow. No git run.',
}
