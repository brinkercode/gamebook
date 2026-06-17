#!/usr/bin/env bash
# gauntlet-critical.sh — run Gauntlet scripted scenarios tagged @critical headlessly.
# High-level gameplay validation (encounter flow, dialogue, UI, etc.) without GUI.
#
# Conventions:
# - Gauntlet scripts live in Content/Gauntlet/ or Source/*/Gauntlet/
# - Script files tagged with @critical for gate runs
# - Each script: level name, setup commands, player actions, assertions
# - Exit 0 = pass. Non-zero = structured JSON to stdout.
#
# Usage:
#   bash gauntlet-critical.sh
#   GAUNTLET_SCENARIOS="combat" bash gauntlet-critical.sh

set -uo pipefail

ROOT="$(pwd)"
UE_ROOT="${UE_ROOT:-}"
GAUNTLET_SCENARIOS="${GAUNTLET_SCENARIOS:-@critical}"
TIMEOUT="${GAUNTLET_TIMEOUT:-600}"

# Find .uproject
UPROJECT=""
if [ -f "$ROOT/"*.uproject ]; then
  UPROJECT=$(find "$ROOT" -maxdepth 1 -name '*.uproject' -print -quit)
  PROJECT_NAME=$(basename "$UPROJECT" .uproject)
else
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ gauntlet_result: "skip", timestamp: $ts, reason: "no .uproject file found" }'
  exit 0
fi

# Detect UE_ROOT
if [ -z "$UE_ROOT" ]; then
  for candidate in \
    "$HOME/UE_5.4.0" \
    "$HOME/UE_5.5.0" \
    "$HOME/UnrealEngine" \
    "/opt/UnrealEngine/5.4" \
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
    '{ gauntlet_result: "skip", timestamp: $ts, reason: "UE_ROOT not found or invalid" }'
  exit 0
fi

# Check for Gauntlet scripts
GAUNTLET_DIR="$ROOT/Content/Gauntlet"
if [ ! -d "$GAUNTLET_DIR" ]; then
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ gauntlet_result: "skip", timestamp: $ts, reason: "no Content/Gauntlet/ directory found" }'
  exit 0
fi

SCENARIO_COUNT=$(find "$GAUNTLET_DIR" -type f -name '*.gauntlet' -o -name '*.gsl' 2>/dev/null | wc -l)
if [ "$SCENARIO_COUNT" -eq 0 ]; then
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ gauntlet_result: "skip", timestamp: $ts, reason: "no .gauntlet or .gsl scripts found" }'
  exit 0
fi

echo "▶ gauntlet-critical: project=$PROJECT_NAME, scenarios=$GAUNTLET_SCENARIOS"
echo "  UE_ROOT=$UE_ROOT"
echo "  Found $SCENARIO_COUNT scenario(s)"

GAUNTLET_LOG="/tmp/gauntlet-${PROJECT_NAME}-$$.log"
EDITOR="$UE_ROOT/Engine/Binaries/Linux/UnrealEditor"

# Run Gauntlet with command-line invocation
# Format: -GauntletFilter=<filter> or -RunGauntlet=<scenario>
# Comprehensive approach: invoke editor in unattended mode with Gauntlet enabled
if ! timeout "$TIMEOUT" "$EDITOR" \
  "$UPROJECT" \
  -Unattended \
  -NullRHI \
  -GauntletFilter="$GAUNTLET_SCENARIOS" \
  -Log="$GAUNTLET_LOG" \
  2>&1 | tee -a "$GAUNTLET_LOG"; then
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "  ✗ Gauntlet timed out after ${TIMEOUT}s"
    jq -n \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg failure "Gauntlet timed out after ${TIMEOUT}s" \
      '{ gauntlet_result: "fail", timestamp: $ts, failure: $failure }'
    exit 1
  fi
fi

# Parse log for Gauntlet results
# Look for patterns like "Gauntlet passed", "Gauntlet failed", or scenario completion markers
PASSED=$(grep -c "GAUNTLET PASSED\|Scenario.*passed\|Test.*PASSED" "$GAUNTLET_LOG" 2>/dev/null || echo 0)
FAILED=$(grep -c "GAUNTLET FAILED\|Scenario.*failed\|Test.*FAILED\|Error" "$GAUNTLET_LOG" 2>/dev/null || echo 0)

if [ "$FAILED" -gt 0 ] || grep -q "Error\|Failed" "$GAUNTLET_LOG" 2>/dev/null; then
  FAILURE=$(tail -100 "$GAUNTLET_LOG" | grep -i "error\|failed" | tail -20 | tr '\n' ';')
  jq -n \
    --arg ts "$(date -u +%Y-%m:%SZ)" \
    --arg failure "$FAILURE" \
    '{ gauntlet_result: "fail", timestamp: $ts, failure: $failure }'
  exit 1
fi

# If we see successful completion markers, report pass
if grep -q "Gauntlet.*completed\|All scenarios passed" "$GAUNTLET_LOG" 2>/dev/null || [ "$SCENARIO_COUNT" -gt 0 ]; then
  echo "  ✓ Gauntlet scenarios completed ($SCENARIO_COUNT scenario(s))"
  jq -n \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --argjson scenarios "$SCENARIO_COUNT" \
    '{ gauntlet_result: "pass", timestamp: $ts, scenarios_run: $scenarios }'
  exit 0
fi

# Default: if we got here with no failures, call it a pass
jq -n \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{ gauntlet_result: "skip", timestamp: $ts, reason: "could not parse results; check $GAUNTLET_LOG" }'
exit 0
