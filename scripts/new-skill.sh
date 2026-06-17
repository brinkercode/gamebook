#!/usr/bin/env bash
# new-skill.sh — scaffold a new gamebook skill from templates/SKILL.md.
#
# Usage: new-skill.sh <name>
#   name   kebab-case skill name (becomes skills/<name>/SKILL.md)
#
# Creates skills/<name>/{SKILL.md, resources/} with placeholders stamped. Keep
# SKILL.md short (it's always loaded); push depth into resources/ for on-demand reads.
# gamebook-init.sh symlinks skills/* into each project's .claude/skills/.

set -euo pipefail

GAMEBOOK="${GAMEBOOK:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
name="${1:-}"
[ -n "$name" ] || { echo "usage: new-skill.sh <name>" >&2; exit 2; }

dir="$GAMEBOOK/skills/$name"
[ -e "$dir" ] && { echo "exists: $dir" >&2; exit 1; }
[ -f "$GAMEBOOK/templates/SKILL.md" ] || { echo "missing templates/SKILL.md" >&2; exit 1; }

mkdir -p "$dir/resources"
title="$(printf '%s' "$name" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')"
sed -e "s/{{SKILL_NAME}}/$name/g" \
    -e "s/{{SKILL_TITLE}}/$title/g" \
    "$GAMEBOOK/templates/SKILL.md" > "$dir/SKILL.md"
touch "$dir/resources/.gitkeep"

echo "✓ created $dir/SKILL.md + resources/"
echo "  next: fill the {{...}} placeholders; move deep examples into resources/."
