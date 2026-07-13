#!/usr/bin/env bash
# harness-check.sh — the gamebook's own gate. Run in CI or before committing harness changes.
# Fails loudly on: mirror/capability drift, a wave that won't parse, or invalid JSON.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

echo "== mirror + capability drift =="
node scripts/check-wave-mirrors.mjs || fail=1

echo "== wave parse (AsyncFunction body) =="
for f in .claude/workflows/*.js; do
  { echo 'async function _w(){const args="{}";const agent=async()=>({});const parallel=async()=>[];const pipeline=async()=>[];const workflow=async()=>({});const phase=()=>{};const log=()=>{};'
    sed 's/^export const meta/const meta/' "$f"; echo '}'; } > /tmp/_hc.mjs
  node --check /tmp/_hc.mjs 2>/dev/null || { echo "  ✗ parse $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "  ✓ waves parse"

echo "== json validity =="
for j in models.json references/PROFILES.json references/_TEMPLATE/config.json agents/_shared/schemas/*.json; do
  jq -e . "$j" >/dev/null 2>&1 || { echo "  ✗ $j"; fail=1; }
done
[ $fail -eq 0 ] && echo "  ✓ json valid"

echo "== every wave has a command shim =="
for f in .claude/workflows/*-wave.js; do
  n=$(basename "$f" -wave.js)
  [ -f "templates/commands/$n.md" ] || { echo "  ✗ no shim templates/commands/$n.md for $(basename "$f")"; fail=1; }
done
[ $fail -eq 0 ] && echo "  ✓ shims present"

echo
[ $fail -eq 0 ] && { echo "✓ harness-check passed"; exit 0; } || { echo "✗ harness-check failed"; exit 1; }
