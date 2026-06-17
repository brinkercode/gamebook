#!/usr/bin/env bash
# cook-smoke.sh — cook one map with UnrealEditor-Cmd; verify startup succeeds.
# Runs after Phase 2. Validates "the project cooks," not just "tests pass."
#
# Conventions:
# - UE_ROOT environment variable points to engine directory (e.g., ~/UE_5.7.4)
# - Default map: Content/Levels/MainLevel or Content/Levels/L_Main
# - Project root: contains .uproject file
# - Exit 0 = pass. Non-zero = structured JSON to stdout.
#
# Usage:
#   bash cook-smoke.sh
#   DEFAULT_LEVEL="Content/Levels/Gameplay/L_Arena" bash cook-smoke.sh

set -uo pipefail

ROOT="$(pwd)"
UE_ROOT="${UE_ROOT:-}"
TIMEOUT="${COOK_TIMEOUT:-600}"
DEFAULT_LEVEL="${DEFAULT_LEVEL:-Content/Levels/MainLevel}"

# Find .uproject file
UPROJECT=""
if [ -f "$ROOT/"*.uproject ]; then
  UPROJECT=$(find "$ROOT" -maxdepth 1 -name '*.uproject' -print -quit)
  PROJECT_NAME=$(basename "$UPROJECT" .uproject)
else
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ cook_result: "skip", timestamp: $ts, reason: "no .uproject file found" }'
  exit 0
fi

# Detect UE_ROOT if not set
if [ -z "$UE_ROOT" ]; then
  # Try common install locations
  for candidate in \
    "$HOME/UE_5.7.4" \
    "$HOME/UE_5.5.0" \
    "$HOME/UnrealEngine" \
    "/opt/UnrealEngine/5.7" \
    "/opt/UnrealEngine/5.5"; do
    if [ -f "$candidate/Engine/Build/BatchFiles/RunUAT.sh" ]; then
      UE_ROOT="$candidate"
      break
    fi
  done
fi

if [ -z "$UE_ROOT" ]; then
  echo "Error: UE_ROOT not set and engine not found in standard locations" >&2
  echo "Set UE_ROOT=/path/to/engine and retry" >&2
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ cook_result: "skip", timestamp: $ts, reason: "UE_ROOT not found" }'
  exit 0
fi

if [ ! -f "$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh" ]; then
  echo "Error: RunUAT.sh not found at $UE_ROOT/Engine/Build/BatchFiles/" >&2
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ cook_result: "skip", timestamp: $ts, reason: "invalid UE_ROOT: no RunUAT.sh" }'
  exit 0
fi

echo "▶ cook-smoke: project=$PROJECT_NAME, level=$DEFAULT_LEVEL"
echo "  UE_ROOT=$UE_ROOT"

# Cook the level
COOK_DIR="$ROOT/Saved/Cooked"
mkdir -p "$COOK_DIR"

COOK_LOG="/tmp/cook-${PROJECT_NAME}-$$.log"
COOK_CMD="$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh BuildCookRun \
  -project=\"$UPROJECT\" \
  -targetplatform=Linux \
  -cookonthefly \
  -maps=\"$DEFAULT_LEVEL\" \
  -stdout \
  -unattended \
  2>&1"

echo "  Running cook..."
if timeout "$TIMEOUT" bash -c "eval \"$COOK_CMD\"" > "$COOK_LOG" 2>&1; then
  echo "  ✓ Cook succeeded"
  COOK_RESULT="pass"
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "  ✗ Cook timed out after ${TIMEOUT}s"
    COOK_RESULT="fail"
    FAILURE="Cook timed out"
  else
    echo "  ✗ Cook failed (exit code: $EXIT_CODE)"
    COOK_RESULT="fail"
    FAILURE="Cook failed with exit code $EXIT_CODE"
  fi
  tail -100 "$COOK_LOG"
fi

# Emit result
if [ "$COOK_RESULT" = "pass" ]; then
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg level "$DEFAULT_LEVEL" \
    '{ cook_result: "pass", timestamp: $ts, level: $level }'
  exit 0
else
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg failure "$FAILURE" \
    '{ cook_result: "fail", timestamp: $ts, failure: $failure }'
  exit 1
fi
