#!/bin/bash
# Post-commit quality audit hook for UE5 game projects
# Copy to .claude/hooks/post-commit-audit.sh and register in .claude/settings.json
#
# Checks for:
# - Missing data assets when Content/ changes
# - Missing Functional Tests when Source/ changes
# - Config drift when DefaultGame.ini or DefaultEngine.ini change

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger on git commit commands
if [[ ! "$COMMAND" =~ git[[:space:]]+commit ]]; then
  exit 0
fi

# Get files changed in the most recent commit
FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)
if [ -z "$FILES" ]; then
  exit 0
fi

# Separate files by type
CONTENT_FILES=$(echo "$FILES" | grep '^Content/' || true)
SOURCE_FILES=$(echo "$FILES" | grep '^Source/' || true)
CONFIG_FILES=$(echo "$FILES" | grep -E '^Config/(DefaultGame|DefaultEngine)\.ini$' || true)

FAILURES=0
PASSES=0
FAILURE_DETAILS=""
PASS_DETAILS=""

check() {
  local label="$1"
  local result="$2"
  local detail="$3"

  if [ "$result" = "PASS" ]; then
    PASSES=$((PASSES + 1))
    PASS_DETAILS="${PASS_DETAILS}  ✅ ${label}\n"
  else
    FAILURES=$((FAILURES + 1))
    FAILURE_DETAILS="${FAILURE_DETAILS}  ⚠️  ${label}\n"
    if [ -n "$detail" ]; then
      FAILURE_DETAILS="${FAILURE_DETAILS}$(echo "$detail" | head -10 | sed 's/^/     /')\n"
    fi
  fi
}

# ─── Content Assets Check (DA_ / DT_) ──────────────────────────────
# If Content/ changed, verify that data assets were also updated

if [ -n "$CONTENT_FILES" ]; then
  # Count the number of data assets (DA_ = Data Assets, DT_ = Data Tables) in commit
  DATA_ASSETS=$(echo "$FILES" | grep -E 'DA_.*\.uasset$|DT_.*\.uasset$' || true)
  LEVEL_ASSETS=$(echo "$FILES" | grep -E '\.umap$' || true)
  BLUEPRINT_ASSETS=$(echo "$FILES" | grep -E 'BP_.*\.uasset$' || true)

  # If content changed but NO data assets or levels were touched, warn
  if [ -z "$DATA_ASSETS" ] && [ -z "$LEVEL_ASSETS" ] && [ -z "$BLUEPRINT_ASSETS" ]; then
    DETAIL="Content/ changed but no data assets (DA_*), data tables (DT_*), or blueprints (BP_*) were updated. If this commit only updates meshes/materials, this is OK; otherwise add supporting data."
    check "Content assets align with data" "FAIL" "$DETAIL"
  else
    check "Content assets align with data" "PASS"
  fi
fi

# ─── C++ Source Check (Functional Tests) ──────────────────────────
# If Source/ changed, verify that at least one Functional Test was added/touched

if [ -n "$SOURCE_FILES" ]; then
  # Look for Functional Test files (typically *_FTest.cpp or inside Tests/ directory)
  TEST_FILES=$(echo "$FILES" | grep -E '(Tests/.*\.cpp|_FTest\.cpp|_Test\.cpp)' || true)

  if [ -z "$TEST_FILES" ]; then
    # Check if the Source changes are already in a Tests/ directory
    SOURCE_IN_TESTS=$(echo "$SOURCE_FILES" | grep '^Source/.*Tests/' || true)
    if [ -z "$SOURCE_IN_TESTS" ]; then
      DETAIL="Source/ changed but no Functional Tests (Tests/*.cpp, *_FTest.cpp) were added. Consider adding a test to gate.sh."
      check "Functional Tests coverage" "FAIL" "$DETAIL"
    else
      check "Functional Tests coverage" "PASS"
    fi
  else
    check "Functional Tests coverage" "PASS"
  fi
fi

# ─── Config Drift Check ────────────────────────────────────────────
# Warn if DefaultGame.ini or DefaultEngine.ini changed without a note in commit

if [ -n "$CONFIG_FILES" ]; then
  COMMIT_MSG=$(git log -1 --format=%B)
  # Check for keywords that indicate the config change was intentional
  if echo "$COMMIT_MSG" | grep -qiE '(config|ini|engine|game settings|default)'; then
    check "Config changes documented" "PASS"
  else
    DETAIL="DefaultGame.ini or DefaultEngine.ini changed. Commit message should mention the config change: $(echo "$CONFIG_FILES" | head -3)"
    check "Config changes documented" "FAIL" "$DETAIL"
  fi
fi

# ─── Refresh project INDEX (token-saving manifest for agents) ───
GAMEBOOK_DIR="${GAMEBOOK:-$HOME/.claude/gamebook}"
if [ -x "$GAMEBOOK_DIR/scripts/gen-index.sh" ]; then
  "$GAMEBOOK_DIR/scripts/gen-index.sh" >/dev/null 2>&1 || true
fi

# ─── Output ───────────────────────────────────────────────────

FILE_LIST=$(echo "$FILES" | sed 's/^/  /' | tr '\n' '|' | sed 's/|/\\n/g')

if [ "$FAILURES" -gt 0 ]; then
  CONTEXT="POST-COMMIT AUDIT: ⚠️  ${FAILURES} WARNINGS / ${PASSES} passed

Files: $(echo "$FILES" | tr '\n' ', ' | sed 's/,$//')

Warnings (review before next task):
$(echo -e "$FAILURE_DETAILS")
See docs/QUALITY.md or .claude/rules/ for detail."

  jq -n --arg ctx "$CONTEXT" '{
    "hookSpecificOutput": {
      "hookEventName": "PostToolUse",
      "additionalContext": $ctx
    }
  }'
else
  CONTEXT="POST-COMMIT AUDIT: ✅ ALL ${PASSES} CHECKS PASSED

Files: $(echo "$FILES" | tr '\n' ', ' | sed 's/,$//')"

  jq -n --arg ctx "$CONTEXT" '{
    "hookSpecificOutput": {
      "hookEventName": "PostToolUse",
      "additionalContext": $ctx
    }
  }'
fi

exit 0
