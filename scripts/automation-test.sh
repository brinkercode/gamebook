#!/usr/bin/env bash
# automation-test.sh — run Functional Tests (UE5 Automation Framework) tagged @critical headlessly.
# Validates gameplay and systems without a GUI.
#
# Conventions:
# - Functional tests live in Source/*Tests/ (C++)
# - Tag tests with @critical for the gate: FAutomationTestBase::AddExpectedMessage or equiv.
# - Project root contains .uproject and Source/
# - Exit 0 = pass / nothing to run. Non-zero = at least one failure.
#
# Usage:
#   bash automation-test.sh
#   TEST_FILTER="*Ability*" bash automation-test.sh     # grep-like pattern

set -uo pipefail

ROOT="$(pwd)"
UE_ROOT="${UE_ROOT:-}"
TEST_FILTER="${TEST_FILTER:-@critical}"
TIMEOUT="${AUTOMATION_TIMEOUT:-300}"

# Find .uproject
UPROJECT=""
if [ -f "$ROOT/"*.uproject ]; then
  UPROJECT=$(find "$ROOT" -maxdepth 1 -name '*.uproject' -print -quit)
  PROJECT_NAME=$(basename "$UPROJECT" .uproject)
else
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ automation_result: "skip", timestamp: $ts, reason: "no .uproject file found" }'
  exit 0
fi

# Detect UE_ROOT
if [ -z "$UE_ROOT" ]; then
  for candidate in \
    "$HOME/UE_5.7.4" \
    "$HOME/UE_5.5.0" \
    "$HOME/UnrealEngine" \
    "/opt/UnrealEngine/5.7" \
    "/opt/UnrealEngine/5.5"; do
    if [ -f "$candidate/Engine/Binaries/Linux/UnrealEditor" ]; then
      UE_ROOT="$candidate"
      break
    fi
  done
fi

if [ -z "$UE_ROOT" ] || [ ! -f "$UE_ROOT/Engine/Binaries/Linux/UnrealEditor" ]; then
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ automation_result: "skip", timestamp: $ts, reason: "UE_ROOT not found or invalid" }'
  exit 0
fi

# Check if tests exist
if [ ! -d "$ROOT/Source" ] || ! find "$ROOT/Source" -name '*Tests*' -o -name '*Test*.cpp' 2>/dev/null | grep -q .; then
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ automation_result: "skip", timestamp: $ts, reason: "no test code found in Source/" }'
  exit 0
fi

echo "▶ automation-test: project=$PROJECT_NAME, filter=$TEST_FILTER"
echo "  UE_ROOT=$UE_ROOT"
echo "  Running Functional Tests headlessly..."

TEST_LOG="/tmp/automation-${PROJECT_NAME}-$$.log"

# Run UnrealEditor in unattended mode with -ExecCmds to run automation tests
# Format: Automation RunTests <filter> or more specific test names
EDITOR="$UE_ROOT/Engine/Binaries/Linux/UnrealEditor"

if ! timeout "$TIMEOUT" "$EDITOR" \
  "$UPROJECT" \
  -Unattended \
  -NullRHI \
  -ExecCmds="Automation RunTests $TEST_FILTER; Quit" \
  -Log="$TEST_LOG" \
  2>&1 | tee -a "$TEST_LOG"; then
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "  ✗ Tests timed out after ${TIMEOUT}s"
    jq -n \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg failure "Tests timed out after ${TIMEOUT}s" \
      '{ automation_result: "fail", timestamp: $ts, failure: $failure }'
    exit 1
  fi
fi

# Parse log for test results
PASSED=$(grep -c "Test Completed" "$TEST_LOG" 2>/dev/null || echo 0)
FAILED=$(grep -c "Test Failed" "$TEST_LOG" 2>/dev/null || echo 0)

if [ "$FAILED" -gt 0 ]; then
  FAILURE=$(tail -50 "$TEST_LOG" | grep -A5 "Test Failed" | head -20)
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg failure "$FAILURE" \
    --argjson passed "$PASSED" \
    --argjson failed "$FAILED" \
    '{ automation_result: "fail", timestamp: $ts, passed: $passed, failed: $failed, failure: $failure }'
  exit 1
fi

if [ "$PASSED" -eq 0 ]; then
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ automation_result: "skip", timestamp: $ts, reason: "no tests matched filter '$TEST_FILTER'" }'
  exit 0
fi

echo "  ✓ $PASSED tests passed"
jq -n \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson passed "$PASSED" \
  '{ automation_result: "pass", timestamp: $ts, tests_passed: $passed }'
exit 0
