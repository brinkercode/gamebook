#!/usr/bin/env node
// check-wave-mirrors.mjs — the drift guard for the deterministic control plane.
//
// Wave scripts (.claude/workflows/*.js) can't import (the harness gives them no fs), so each
// embeds a compact mirror of models.json (`const M = {...}`) and of the verdict schemas. Mirrors
// are convenient but drift silently. This makes drift LOUD:
//   1. every role→model in a wave's M must equal models.json's tiers[roles[role]]
//   2. every wave must normalize args (`const A = ...`) and return a `status`
// Exit non-zero on any drift. Run in CI or after editing models.json / a wave.
//
// Usage: node scripts/check-wave-mirrors.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const models = JSON.parse(readFileSync(resolve(ROOT, 'models.json'), 'utf8'))
const { tiers, roles } = models
const expectedModel = (role) => tiers[roles[role]] // role → tier → model, or undefined

const WF = resolve(ROOT, '.claude', 'workflows')
const waves = readdirSync(WF).filter((f) => f.endsWith('.js'))

let problems = 0
const fail = (w, msg) => { console.error(`  ✗ ${w}: ${msg}`); problems++ }

for (const f of waves) {
  const w = basename(f)
  const src = readFileSync(resolve(WF, f), 'utf8')

  // 1. models mirror: pull the first `const M = { ... }` (flat, no nested braces) and each 'role':'model'
  const mBlock = src.match(/const M\s*=\s*\{([^}]*)\}/)
  if (mBlock) {
    const pairs = [...mBlock[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)]
    for (const [, role, model] of pairs) {
      const exp = expectedModel(role)
      if (exp === undefined) { fail(w, `M has role '${role}' not present in models.json roles`); continue }
      if (exp !== model) fail(w, `M['${role}'] = '${model}' but models.json resolves '${role}' → ${roles[role]} → '${exp}'`)
    }
  } else if (!/agentType:\s*'/.test(src) && !/model:\s*'/.test(src)) {
    // waves with no M and no explicit agentType/model use the default agent — allowed (e.g. understand)
  }

  // 2. structural invariants
  if (!/const A\s*=\s*\(typeof args/.test(src)) fail(w, 'missing the args-normalization line (const A = ...)')
  if (/export const meta/.test(src) === false) fail(w, 'missing `export const meta`')
  // capability gate: every wave must declare meta.requires[] (empty = universal, non-empty = gated)
  if (!/requires:\s*\[/.test(src)) fail(w, 'meta missing `requires: [...]` capability declaration (use [] for universal waves)')

  // 3. status envelope: must be present (literal, variable, or ternary), and every QUOTED status
  //    literal must be in the vocabulary. 'skipped' is allowed for inter-phase handoff placeholders.
  if (!/\bstatus:/.test(src)) fail(w, 'no `status:` field anywhere — envelope not standardized')
  const OK = new Set(['ready', 'needsInput', 'needsRework', 'blocked', 'escalate', 'clean', 'skipped'])
  for (const [, val] of src.matchAll(/\bstatus:\s*'([a-z-]+)'/g)) {
    if (!OK.has(val)) fail(w, `status literal '${val}' is outside the envelope vocabulary (${[...OK].join('|')})`)
  }
}

console.log(`checked ${waves.length} waves against models.json`)
if (problems) { console.error(`\n✗ ${problems} mirror drift problem(s)`); process.exit(1) }
console.log('✓ no mirror drift')
