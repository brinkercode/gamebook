export const meta = {
  name: 'cert-preflight-wave',
  description: 'Per-platform compliance preflight (Steam review, Deck Verified, TRC/XR/Lotcheck-shaped) — one qa-compliance seat per platform, aggregate go/no-go, manual hardware checks surfaced honestly. Read-only. Never runs git.',
  phases: [
    { title: 'Resolve' },
    { title: 'Check' },
  ],
  requires: ['build'],
}

const A = (typeof args === "string") ? JSON.parse(args) : (args || {})

const M = { 'resolve-project': 'haiku', 'qa-compliance': 'haiku' }
const STAGES = ['beta', 'gold']

const PROJECT = { type: 'object', required: ['resolved', 'source', 'stage', 'staffing'], properties: {
  resolved: { type: 'boolean' }, source: { type: 'string', enum: ['references', 'in-repo', 'none'] },
  project: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } },
  stage: { type: 'string' }, staffing: { type: 'string' }, repo_path: { type: ['string', 'null'] },
  stack: { type: 'object' }, platforms: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } } }
const CERT = { type: 'object', required: ['platform', 'verdict', 'items'], properties: {
  platform: { type: 'string' }, verdict: { type: 'string', enum: ['go', 'no-go'] },
  items: { type: 'array', items: { type: 'object', required: ['item', 'result'], properties: {
    item: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'n/a', 'unverifiable-headless'] },
    blocking: { type: 'boolean' }, evidence: { type: 'string' } } } },
  blocking_failures: { type: 'array', items: { type: 'string' } },
  manual_checks_needed: { type: 'array', items: { type: 'string' } } } }

const projectRef = (A && A.project) || '_TEMPLATE'

phase('Resolve')
const project = await agent(
  `Resolve the binding profile for project "${projectRef}" (references/${projectRef}/config.json + local overlay; in-repo fallback).`,
  { label: 'resolve-project', agentType: 'resolve-project', model: M['resolve-project'], schema: PROJECT })
if (!project || !project.resolved) return { status: 'needsInput', reason: `No project profile for "${projectRef}".` }
if (!STAGES.includes(project.stage)) return { status: 'skipped', reason: `cert-preflight runs in [${STAGES.join(', ')}] but stage is '${project.stage}'` }
if (!(project.capabilities || []).includes('build')) return { status: 'skipped', reason: "profile lacks capability 'build'" }

const platMap = { Win64: 'steam', Linux: 'steam', SteamDeck: 'steam-deck', PS5: 'ps5', Xbox: 'xbox', XSX: 'xbox', Switch: 'switch', Switch2: 'switch' }
const platforms = [...new Set((project.platforms || ['Win64']).map((p) => platMap[p] || p.toLowerCase()))]
if ((project.capabilities || []).includes('steam') && !platforms.includes('steam-deck')) platforms.push('steam-deck')
log(`preflighting: ${platforms.join(', ')}`)

const CHECKLISTS = {
  steam: 'Steam review requirements: store-page/build parity, Content Survey answers consistent with the build, no crash on boot/quit, controller support claims accurate, no debug console in shipping config, build uploaded via SteamPipe branch structure (guides/steam-deploy.md)',
  'steam-deck': 'Deck Verified: controller-complete UI (no mouse-only flows), text legible at 1280x800, default proton/native-Linux launch clean, no launcher blocking, performance target on Deck-class hardware (quality/performance-budgets.md)',
  ps5: 'TRC-shaped: suspend/resume safety of saves, correct button-prompt glossary, save integrity under storage-full and power-loss, activity/trophy hooks if declared, loading over 2min needs progress UI',
  xbox: 'XR-shaped: XR-001 stability (no crash/hang in core loop), save roaming safety, correct account/sign-out handling, suspend/constrain behavior, 2-min load rule',
  switch: 'Lotcheck-shaped: button terminology, docked/handheld transitions, sleep/wake safety, save integrity on abrupt power-off',
}

phase('Check')
const verdicts = await parallel(platforms.map((p) => () => agent(
  `Cert preflight for platform "${p}" on "${projectRef}". Checklist: ${CHECKLISTS[p] || 'platform-general: stability, saves, input, loading'}. Verify each item by reading code/config/cook output where possible; items needing real hardware or a devkit go in manual_checks_needed and result "unverifiable-headless" — NEVER marked pass. Blocking items that fail go in blocking_failures. Read-only.`,
  { label: `cert:${p}`, agentType: 'qa-compliance', model: M['qa-compliance'], schema: CERT, phase: 'Check' })))

const clean = verdicts.filter(Boolean)
const go = clean.length === platforms.length && clean.every((v) => v.verdict === 'go')
const manual = clean.flatMap((v) => (v.manual_checks_needed || []).map((m) => `[${v.platform}] ${m}`))
const blocking = clean.flatMap((v) => (v.blocking_failures || []).map((b) => `[${v.platform}] ${b}`))

return {
  status: 'ready', project: projectRef,
  aggregate: go ? 'go' : 'no-go',
  platforms: clean,
  blocking_failures: blocking,
  manual_checks_needed: manual,
  note: go
    ? (manual.length ? 'GO from the harness side — but the listed manual hardware checks are still yours before real submission.' : 'GO on every platform.')
    : 'NO-GO — fix blocking failures via /fix, re-run. First-submission cert failure is normal in the industry; preflight exists to catch it here.',
}
