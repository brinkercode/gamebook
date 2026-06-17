#!/usr/bin/env bash
# Deterministic gate runner for UE5 projects — every agent calls this before handoff.
# Same checks CI runs (templates/.github/workflows/ci.yml).
# Exit 0 = pass. Non-zero = structured JSON to stdout describing the failure.
#
# Requires: UE_ROOT environment variable (e.g., /home/user/UnrealEngine/Engine)
#
# Usage: bash gate.sh [step]
#   step ∈ {lint,test,build,cook,index,all}  (default: all)
#   Each step gated by UE_ROOT env; skips gracefully if missing.

set -uo pipefail

STEP="${1:-all}"
GAMEBOOK="${GAMEBOOK:-$HOME/.claude/gamebook}"
UE_ROOT="${UE_ROOT:-}"
PROJECT_NAME=$(find . -maxdepth 1 -name "*.uproject" -exec basename {} .uproject \; 2>/dev/null | head -1 || echo "Project")
FAILED_STEP=""
FAILED_LOGS=""

run() {
  local label="$1" cmd="$2"
  echo "▶ $label"
  local out
  if out=$(eval "$cmd" 2>&1); then
    echo "  ✓ $label"
    return 0
  else
    FAILED_STEP="$label"
    FAILED_LOGS=$(echo "$out" | tail -50)
    echo "  ✗ $label"
    return 1
  fi
}

emit_failure() {
  jq -n \
    --arg step "$FAILED_STEP" \
    --arg logs "$FAILED_LOGS" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ gate_result: "fail", failed_step: $step, logs: $logs, timestamp: $ts }'
  exit 1
}

emit_success() {
  jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ gate_result: "pass", timestamp: $ts }'
  exit 0
}

# ── lint (clang-format on Source/) ──────────────────────────────────
if [[ "$STEP" == "all" || "$STEP" == "lint" ]]; then
  if [ -d Source ] && command -v clang-format >/dev/null; then
    run "lint:clang-format" "find Source -type f \\( -name '*.h' -o -name '*.hpp' -o -name '*.cpp' -o -name '*.cc' \\) -exec clang-format --dry-run --output-replacements-xml {} \\; | grep -q '</replacements>$' && exit 1 || exit 0" || emit_failure
  elif [ -d Source ]; then
    echo "  - clang-format not installed; skipping C++ format check"
  fi
fi

# ── test (Functional Tests via UnrealEditor-Cmd) ────────────────────
if [[ "$STEP" == "all" || "$STEP" == "test" ]]; then
  if [ -z "$UE_ROOT" ]; then
    echo "  - UE_ROOT not set; skipping Functional Tests"
  else
    EDITOR_CMD="$UE_ROOT/Binaries/Linux/UE4Editor-Cmd"
    if [ ! -x "$EDITOR_CMD" ]; then
      EDITOR_CMD="$UE_ROOT/Binaries/Win64/UE4Editor-Cmd.exe"
    fi
    if [ ! -x "$EDITOR_CMD" ]; then
      EDITOR_CMD="$UE_ROOT/Binaries/Mac/UE4Editor-Cmd"
    fi

    if [ -x "$EDITOR_CMD" ]; then
      UPROJECT=$(find . -maxdepth 1 -name "*.uproject" -print -quit || echo "")
      if [ -n "$UPROJECT" ]; then
        run "test:functional" "$EDITOR_CMD '$UPROJECT' -ExecCmds='Automation RunTests ${PROJECT_NAME}.+Functional;Quit' -unattended -nopause -nullrhi" || emit_failure
      fi
    fi
  fi
fi

# ── build (UnrealBuildTool compile editor target) ───────────────────
if [[ "$STEP" == "all" || "$STEP" == "build" ]]; then
  if [ -z "$UE_ROOT" ]; then
    echo "  - UE_ROOT not set; skipping build"
  else
    UBT="$UE_ROOT/Build/BatchFiles/Linux/Build.sh"
    if [ ! -x "$UBT" ]; then
      UBT="$UE_ROOT/Build/BatchFiles/Build.bat"
    fi

    if [ -x "$UBT" ]; then
      UPROJECT=$(find . -maxdepth 1 -name "*.uproject" -print -quit || echo "")
      if [ -n "$UPROJECT" ]; then
        run "build:editor" "$UBT $PROJECT_NAME Linux Development \"$(pwd)/$UPROJECT\"" || emit_failure
      fi
    fi
  fi
fi

# ── cook (slim variant: Development, single platform, single map) ───
if [[ "$STEP" == "all" || "$STEP" == "cook" ]]; then
  if [ -z "$UE_ROOT" ]; then
    echo "  - UE_ROOT not set; skipping cook"
  else
    UPROJECT=$(find . -maxdepth 1 -name "*.uproject" -print -quit || echo "")
    if [ -n "$UPROJECT" ]; then
      # Find the first map in Content/Levels/
      MAP=$(find Content/Levels -maxdepth 1 -name "*.umap" -print -quit 2>/dev/null || echo "")
      if [ -z "$MAP" ]; then
        echo "  - No maps found in Content/Levels/; skipping cook"
      else
        MAP_NAME=$(basename "$MAP" .umap)
        # Use Cook content tool (UAT / UnrealAutomationTool) or Unreal Automation Tool
        run "cook:slim" "$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh BuildCookRun -project='$(pwd)/$UPROJECT' -targetplatform=Linux -build -cook -stage -package -map='$MAP_NAME' -clientconfig=Development" || emit_failure
      fi
    fi
  fi
fi

# ── index (regenerate .claude/INDEX.json) ──────────────────────────
if [[ "$STEP" == "all" || "$STEP" == "index" ]]; then
  if [ -x "$GAMEBOOK/scripts/gen-index.sh" ]; then
    run "index:gen" "bash $GAMEBOOK/scripts/gen-index.sh" || emit_failure
  fi
fi

emit_success
