#!/usr/bin/env bash
# gen-claude-md.sh — generate a slim, stack-tailored CLAUDE.md from project.config.json.
#
# Emits a project-specific CLAUDE.md that @imports ONLY the rules for the chosen
# stack + a short intent block from the scaffolder answers. Smaller context,
# nothing irrelevant.
#
# Usage: gen-claude-md.sh [project-root]   (default: cwd)
# Falls back to copying templates/CLAUDE.md when project.config.json or jq is absent.

set -uo pipefail

GAMEBOOK="${GAMEBOOK:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT="${1:-$PWD}"
CFG="$ROOT/project.config.json"
OUT="$ROOT/CLAUDE.md"
RULES_DIR="$GAMEBOOK/rules"

fallback() {
  echo "[gen-claude-md] $1 — copying static templates/CLAUDE.md" >&2
  cp "$GAMEBOOK/templates/CLAUDE.md" "$OUT"
  exit 0
}

command -v jq >/dev/null 2>&1 || fallback "jq not found"
[ -f "$CFG" ] || fallback "no project.config.json"

g() { jq -r "$1 // \"\"" "$CFG" 2>/dev/null; }

NAME="$(g '.name')"; DESC="$(g '.description')"
ENGINE="$(g '.stack.engine')"; UE_VERSION="$(g '.stack.engine_version')"
ABILITIES="$(g '.stack.abilities')"; INPUT="$(g '.stack.input')"
AUDIO="$(g '.stack.audio')"; VFX="$(g '.stack.vfx')"
MULTIPLAYER="$(g '.stack.multiplayer')"; PERSISTENCE="$(g '.stack.persistence')"
MONETIZATION="$(g '.integrations.monetization')"

PROB="$(g '.business.problem')"; VISION="$(g '.business.vision')"; RISK="$(g '.business.biggest_risk')"
ART="$(g '.design.art_direction')"; TONE="$(g '.design.tone')"

[ -n "$NAME" ] || fallback "project.config.json missing .name"

# ── choose the rule files this stack needs ──
rules=( "standards.md" "cpp-backend.md" "blueprint.md" )
[ "$MULTIPLAYER" != "true" ] && [ "$MULTIPLAYER" != "enabled" ] || rules+=("networking.md")
[ "$AUDIO" = "wwise" ] && rules+=("wwise-integration.md")
[ "$MONETIZATION" != "none" ] && [ -n "$MONETIZATION" ] && rules+=("monetization.md")

imports=""; missing=""
for r in "${rules[@]}"; do
  if [ -f "$RULES_DIR/$r" ]; then imports+="@.claude/rules/$r"$'\n'; else missing+="$r "; fi
done
[ -n "$missing" ] && echo "[gen-claude-md] note: no rule file for: $missing" >&2

line() { [ -n "$2" ] && [ "$2" != "none" ] && printf '%s' "$1$2"; }

{
cat <<EOF
# $NAME — Claude Game Playbook

> $DESC

## Stack (this project)

- **Engine** — $ENGINE $(line ' / ' "$UE_VERSION")
- **Gameplay** — $(line '' "$ABILITIES")$(line ' · input ' "$INPUT")$(line ' · vfx ' "$VFX")
- **Audio** — $(line '' "$AUDIO")
- **Persistence** — $(line '' "$PERSISTENCE")
- **Multiplayer** — $([ "$MULTIPLAYER" = "true" ] || [ "$MULTIPLAYER" = "enabled" ] && echo "enabled" || echo "single-player")
- **Monetization** — $(line '' "$MONETIZATION")

Canonical record: \`project.config.json\`. Agents read it on every invocation.

## Intent

EOF
[ -n "$PROB" ]  && echo "- **Problem** — $PROB"
[ -n "$VISION" ] && echo "- **Vision** — $VISION"
[ -n "$RISK" ]  && echo "- **Biggest risk** — $RISK"
{ [ -n "$ART" ] || [ -n "$TONE" ]; } && echo "- **Design** — ${ART}$(line ' (tone: ' "$TONE")$([ -n "$TONE" ] && echo ')')"
cat <<EOF

## Rules (auto-loaded for this stack)

$imports
## First read every session

1. \`.claude/INDEX.json\` — machine-generated game project map. Read FIRST; refresh with \`make index\`.
2. \`.claude/agents/README.md\` — agent index + handoff convention.
3. The \`docs/*.md\` listed in \`task_routing\` for the current task type.

## Commands

| Size | Command |
|---|---|
| Trivial | inline edit (typo, comment, macro, small config tweak) |
| Small | \`/fix <change>\` — single C++ class OR one Blueprint OR one data asset; code-reviewer + gate |
| Full feature | \`/ship <feature>\` — systems + content multi-agent pipeline, file-based handoffs |

\`make gate\` (full) at integration boundaries · \`make index\` · \`make dev-bg\` / \`make dev-stop\` · \`make cook-smoke\` · \`make automation-critical\` · \`make gauntlet-critical\`.

Project skills live in \`.claude/skills/\` (interviews + feature recipes) — invoke by intent.

## Non-negotiables

1. Read \`.claude/INDEX.json\` before any Glob/Grep.
2. \`make gate\` before any handoff; block on non-zero exit.
3. GAS abilities are replicated via AttributeSets; never replicate state manually.
4. All save/load via USaveGame subclasses; never serialize pointers directly.
5. Data-driven design: designers tweak Data Tables + Data Assets, not C++ hardcodes.
6. Update the relevant \`docs/*.md\` when behavior changes.
EOF
} > "$OUT"

echo "✓ generated $OUT (rules: ${rules[*]})"
