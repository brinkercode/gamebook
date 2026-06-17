#!/bin/bash
# Gamebook — Claude Code Global Settings Installer
#
# Installs standard game dev permissions to ~/.claude/settings.json
# so they apply across ALL projects, not just ones with .claude/settings.json.
#
# Usage:
#   ./scripts/setup-claude.sh          # Install (merges with existing)
#   ./scripts/setup-claude.sh --force  # Overwrite existing settings
#
# What it does:
#   - Auto-approves standard dev tools (make, git, curl, ls, find)
#   - Auto-approves Unreal tools (UnrealEditor, UnrealBuildTool, etc.)
#   - Auto-approves security scanners (gitleaks, trivy)
#   - Auto-approves git read operations (status, diff, log, blame, etc.)
#   - DENIES git write operations (commit, push, merge, rebase, reset, etc.)
#   - DENIES reading .env, .pem, .key, and credentials files
#
# The developer always controls commits and critical changes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAMEBOOK_DIR="$(dirname "$SCRIPT_DIR")"
SOURCE="$GAMEBOOK_DIR/.claude/settings.json"
TARGET="$HOME/.claude/settings.json"

if [ ! -f "$SOURCE" ]; then
  echo "Error: $SOURCE not found"
  exit 1
fi

# Ensure ~/.claude exists
mkdir -p "$HOME/.claude"

if [ "${1:-}" = "--force" ] || [ ! -f "$TARGET" ]; then
  # Fresh install or forced overwrite
  cp "$SOURCE" "$TARGET"
  echo "Installed gamebook dev permissions to $TARGET"
else
  # Merge: take existing settings, replace only the permissions block
  if command -v jq &>/dev/null; then
    MERGED=$(jq -s '
      .[0] as $existing |
      .[1] as $new |
      $existing * { permissions: $new.permissions }
    ' "$TARGET" "$SOURCE")
    echo "$MERGED" | jq '.' > "$TARGET"
    echo "Merged gamebook dev permissions into $TARGET (preserved non-permission settings)"
  else
    echo ""
    echo "jq is not installed. Cannot merge safely."
    echo ""
    echo "Options:"
    echo "  1. Install jq: sudo apt install jq (or brew install jq)"
    echo "  2. Run with --force to overwrite: $0 --force"
    echo "     (This will replace your entire ~/.claude/settings.json)"
    echo ""
    exit 1
  fi
fi

echo ""
echo "Settings installed. Restart Claude Code for changes to take effect."
echo ""
echo "What's allowed:  make, git read ops, curl, UE tools, security scanners"
echo "What's denied:   git commit/push/merge, reading .env/.pem/.key"
echo ""
echo "Override per-project with .claude/settings.local.json (gitignored)."

# ── Global slash commands ─────────────────────────────────────
# Symlink each template under gamebook/templates/commands/ into ~/.claude/commands/
# so edits in the gamebook propagate to the live command file.
COMMANDS_SRC="$GAMEBOOK_DIR/templates/commands"
COMMANDS_DST="$HOME/.claude/commands"

if [ -d "$COMMANDS_SRC" ]; then
  mkdir -p "$COMMANDS_DST"
  LINKED=0
  for cmd in "$COMMANDS_SRC"/*.md; do
    [ -f "$cmd" ] || continue
    name=$(basename "$cmd")
    target="$COMMANDS_DST/$name"
    # Compare canonical paths so any equivalent symlink path is recognized as correct
    cmd_real="$(readlink -f "$cmd")"
    if [ -L "$target" ] && [ "$(readlink -f "$target" 2>/dev/null)" = "$cmd_real" ]; then
      continue
    elif [ -e "$target" ] && [ ! -L "$target" ] && [ "${1:-}" != "--force" ]; then
      echo "  · /$( basename "$name" .md ): existing file at $target (use --force to replace)"
    else
      ln -sfn "$cmd" "$target"
      LINKED=$((LINKED+1))
      echo "  + /$( basename "$name" .md ) → $cmd"
    fi
  done
  [ $LINKED -gt 0 ] && echo ""
fi
