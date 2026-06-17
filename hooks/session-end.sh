#!/usr/bin/env bash
# session-end.sh — runs on Claude Code Stop event (chat finishes / agent stops).
# Wired via .claude/settings.json `hooks.Stop`. Refreshes repo-derived data so the
# next session starts with an accurate INDEX.json + activity log.
#
# For UE5 projects: also cleans DerivedDataCache/Intermediate scratch directories.
# Cheap and idempotent. Never blocks the user.

set -uo pipefail

GAMEBOOK="${GAMEBOOK:-$HOME/.claude/gamebook}"
ROOT="$(pwd)"
LOG="$ROOT/.claude/activity.log"

mkdir -p "$ROOT/.claude" 2>/dev/null || true

# 1. Refresh INDEX.json so the next agent has a current task-routing map.
if [ -x "$GAMEBOOK/scripts/gen-index.sh" ]; then
  "$GAMEBOOK/scripts/gen-index.sh" >/dev/null 2>&1 || true
fi

# 1b. Sync the gamebook brain: absorb any memories the harness wrote this session
#     into gamebook/brain/, refresh the symlinks, and regenerate MEMORY.md.
#     Namespace = repo basename → brain/projects/<ns>/. Cheap, idempotent, never blocks.
if [ -x "$GAMEBOOK/scripts/brain-link.sh" ]; then
  "$GAMEBOOK/scripts/brain-link.sh" "$(basename "$ROOT")" >/dev/null 2>&1 || true
fi

# 1c. UE5-specific: Clean scratch directories safely.
#     Only clean if no editor is running (check for Editor process or lock files).
EDITOR_RUNNING=$(pgrep -f "UE4Editor|UnrealEditor" || true)
LOCK_FILE="Intermediate/.lockfile"
if [ -z "$EDITOR_RUNNING" ] && [ ! -f "$LOCK_FILE" ]; then
  # Safe to clean derived data and intermediate files
  [ -d "DerivedDataCache" ] && rm -rf "DerivedDataCache" 2>/dev/null || true
  [ -d "Intermediate" ] && rm -rf "Intermediate" 2>/dev/null || true
  mkdir -p "Intermediate" 2>/dev/null || true
fi

# 1a. Reap any stray dev-bg daemons this project left running.
#     Looks for pid files written by `make dev-bg` and kills cleanly.
for pidfile in /tmp/*-api.pid /tmp/*-web.pid; do
  [ -f "$pidfile" ] || continue
  pid=$(cat "$pidfile" 2>/dev/null)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && kill "$pid" 2>/dev/null || true
  rm -f "$pidfile" 2>/dev/null || true
done

# 2. Append a one-line activity entry. Captures: timestamp, branch, dirty/clean,
#    files-changed-this-session (vs HEAD), commits-this-session.
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BRANCH="-"
DIRTY="-"
CHANGED_COUNT=0
COMMITS_TODAY=0

if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  BRANCH=$(git -C "$ROOT" symbolic-ref --short HEAD 2>/dev/null)
  [ -z "$BRANCH" ] && BRANCH="-"
  if [ -z "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; then
    DIRTY="clean"
  else
    DIRTY="dirty"
  fi
  CHANGED_COUNT=$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  COMMITS_TODAY=$(git -C "$ROOT" log --since="24 hours ago" --oneline 2>/dev/null | wc -l | tr -d ' ')
fi

# Read input from Claude Code (it pipes JSON to Stop hooks). We don't require it.
INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat 2>/dev/null || true)
fi
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || true)
[ -z "$SESSION_ID" ] && SESSION_ID="-"

printf "%s\tbranch=%s\tstate=%s\tchanged=%d\tcommits24h=%d\tsession=%s\n" \
  "$TS" "$BRANCH" "$DIRTY" "$CHANGED_COUNT" "$COMMITS_TODAY" "$SESSION_ID" \
  >> "$LOG"

# Trim log to last 500 lines so it doesn't grow forever.
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 500 ]; then
  tail -500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

# Summary: report Content/ and Source/ changes for the agent to see at next session
CONTENT_SUMMARY=$(git -C "$ROOT" diff HEAD~1 HEAD --name-only 2>/dev/null | grep '^Content/' | head -5 || true)
SOURCE_SUMMARY=$(git -C "$ROOT" diff HEAD~1 HEAD --name-only 2>/dev/null | grep '^Source/' | head -5 || true)

if [ -n "$CONTENT_SUMMARY" ] || [ -n "$SOURCE_SUMMARY" ]; then
  {
    echo "Session summary — content & source changes:"
    [ -n "$CONTENT_SUMMARY" ] && echo "  Content/: $(echo "$CONTENT_SUMMARY" | tr '\n' ', ' | sed 's/,$//')"
    [ -n "$SOURCE_SUMMARY" ] && echo "  Source/: $(echo "$SOURCE_SUMMARY" | tr '\n' ', ' | sed 's/,$//')"
  } >> "$LOG"
fi

# Stop hooks can return JSON to influence Claude. We just acknowledge silently.
exit 0
