#!/usr/bin/env bash
# new-workflow.sh — scaffold a new gamebook wave from templates/WORKFLOW.md.
#
# Usage: new-workflow.sh <name>
#   name   kebab-case wave name WITHOUT the -wave suffix (becomes
#          .claude/workflows/<name>-wave.js). e.g. `new-workflow.sh review` → review-wave.js
#
# Extracts the ```js fenced block from templates/WORKFLOW.md, stamps the name, and
# writes it as an executable-by-the-harness .js. Edit the placeholders, then register
# the wave in .claude/workflows/README.md and (if it fronts a slash command) add a shim
# in templates/commands/. Mirrors new-agent.sh / new-skill.sh.

set -euo pipefail
GAMEBOOK="${GAMEBOOK:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
name="${1:-}"
[ -n "$name" ] || { echo "usage: new-workflow.sh <name>   (no -wave suffix)" >&2; exit 2; }
name="${name%-wave}"   # tolerate a trailing -wave

tmpl="$GAMEBOOK/templates/WORKFLOW.md"
dest="$GAMEBOOK/.claude/workflows/$name-wave.js"
[ -f "$tmpl" ] || { echo "missing $tmpl" >&2; exit 1; }
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$GAMEBOOK/.claude/workflows"

# Pull the first ```js ... ``` block out of the template and stamp <name>.
awk '/^```js$/{f=1;next} /^```$/{if(f)exit} f{print}' "$tmpl" \
  | sed "s/<name>/$name/g" > "$dest"

[ -s "$dest" ] || { echo "failed to extract js block from $tmpl" >&2; rm -f "$dest"; exit 1; }

echo "✓ created $dest"
echo "  next: fill the wave body; register it in .claude/workflows/README.md;"
echo "        add a templates/commands/$name.md shim if it fronts a slash command."
