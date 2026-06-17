#!/usr/bin/env bash
# new-agent.sh — scaffold a new gamebook agent from templates/AGENT.md.
#
# Usage: new-agent.sh <name> [model]
#   name   kebab-case agent name (becomes agents/<name>.md)
#   model  opus | sonnet | haiku   (default: sonnet — gate-checked build work)
#
# Creates agents/<name>.md with placeholders stamped. Edit the {{...}} fields,
# then add the agent to templates/commands/ship.md or fix.md if it joins a phase.

set -euo pipefail

GAMEBOOK="${GAMEBOOK:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
name="${1:-}"; model="${2:-sonnet}"
[ -n "$name" ] || { echo "usage: new-agent.sh <name> [opus|sonnet|haiku]" >&2; exit 2; }
case "$model" in opus|sonnet|haiku) ;; *) echo "model must be opus|sonnet|haiku" >&2; exit 2;; esac

dest="$GAMEBOOK/agents/$name.md"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
[ -f "$GAMEBOOK/templates/AGENT.md" ] || { echo "missing templates/AGENT.md" >&2; exit 1; }

title="$(printf '%s' "$name" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')"
sed -e "s/{{AGENT_NAME}}/$name/g" \
    -e "s/{{AGENT_TITLE}}/$title Agent/g" \
    -e "s/{{HANDOFF_FILE}}/$name/g" \
    -e "s/{{MODEL}}/$model/g" \
    "$GAMEBOOK/templates/AGENT.md" > "$dest"

echo "✓ created $dest (model: $model)"
echo "  next: fill the {{...}} placeholders; wire into ship.md/fix.md if it joins a phase."
