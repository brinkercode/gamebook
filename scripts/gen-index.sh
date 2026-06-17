#!/usr/bin/env bash
# gen-index.sh — emit .claude/INDEX.json so agents can resolve game project context.
#
# Run from any UE5 project root. Idempotent. Writes .claude/INDEX.json.

set -uo pipefail

ROOT="$(pwd)"
OUT="$ROOT/.claude/INDEX.json"
mkdir -p "$ROOT/.claude"

NAME=$(basename "$ROOT")
DESC=""
if [ -f "$ROOT/CLAUDE.md" ]; then
  HEADING=$(grep -m1 '^# ' "$ROOT/CLAUDE.md" 2>/dev/null | sed 's/^#[[:space:]]*//; s/[[:space:]]*—.*$//')
  [ -n "$HEADING" ] && NAME="$HEADING"
  DESC=$(grep -m1 '^>' "$ROOT/CLAUDE.md" 2>/dev/null | sed 's/^>[[:space:]]*//' || true)
fi

# ── Detect stack ──────────────────────────────────────────────
STACK=("ue5" "cpp" "blueprint")
if [ -d "$ROOT/Source" ]; then STACK+=("c++"); fi
if [ -f "$ROOT/Config/DefaultEngine.ini" ]; then STACK+=("ini-config"); fi
STACK_JSON=$(printf '%s\n' "${STACK[@]}" | jq -R . | jq -s 'map(select(. != ""))')

# ── Entry points ──────────────────────────────────────────────
entry_points() {
  jq -n \
    --arg uproject "$( find "$ROOT" -maxdepth 1 -name '*.uproject' -print -quit )" \
    --arg content_root "$( [ -d Content ] && echo Content || echo "" )" \
    --arg source_root "$( [ -d Source ] && echo Source || echo "" )" \
    '{ uproject: $uproject, content_root: $content_root, source_root: $source_root }
     | with_entries(select(.value != ""))'
}

# ── Task routing — map task type to relevant files/dirs ───────
task_routing() {
  cat <<'JSON'
{
  "add_ability":           ["Source/*/Abilities/", "Source/*/AI/", "Content/Data/", "docs/ABILITIES.md"],
  "add_weapon":            ["Source/*/Weapons/", "Content/Weapons/", "Content/VFX/", "docs/GAMEPLAY.md"],
  "add_character":         ["Source/*/Characters/", "Content/Characters/", "Content/Animations/", "docs/CHARACTERS.md"],
  "add_ui_widget":         ["Source/*/UI/", "Content/UI/", "docs/UI.md"],
  "add_level":             ["Content/Levels/", "Source/*/Levels/", "docs/LEVELS.md"],
  "add_vfx":               ["Content/VFX/", "Source/*/VFX/", "docs/VFX.md"],
  "add_audio_event":       ["Content/Audio/", "Source/*/Audio/", "docs/AUDIO.md"],
  "add_data_asset":        ["Content/Data/", "Source/*/Data/", "docs/DATA.md"],
  "wwise_integration":     ["Source/*/Audio/", "Config/DefaultEngine.ini", "docs/AUDIO.md"],
  "network_replication":   ["Source/*/Gameplay/", "docs/NETWORKING.md"],
  "gas_feature":           ["Source/*/Abilities/", "Source/*/Gameplay/", "docs/ABILITIES.md"],
  "review_security":       [".claude/agents/_shared/SECURITY_CHECKLIST.md", "docs/SECURITY.md"],
  "write_tests":           ["Source/*/Tests/", "Source/*Tests/", "docs/TESTING.md"]
}
JSON
}

# ── Inventory: C++ classes ────────────────────────────────────
cpp_classes() {
  if [ -d "$ROOT/Source" ]; then
    find "$ROOT/Source" -name '*.h' -not -path '*/Intermediate/*' -not -path '*/Binaries/*' 2>/dev/null \
      | grep -E '(A[A-Z]|U[A-Z])' \
      | head -100 \
      | jq -R '{ path: . }' | jq -s '.'
  else
    echo '[]'
  fi
}

# ── Inventory: Blueprint classes ──────────────────────────────
blueprints() {
  if [ -d "$ROOT/Content" ]; then
    find "$ROOT/Content" -name '*.uasset' 2>/dev/null \
      | grep -iE '(bp_|da_|w_)' \
      | head -100 \
      | jq -R '{ path: . }' | jq -s '.'
  else
    echo '[]'
  fi
}

# ── Inventory: levels ─────────────────────────────────────────
levels() {
  if [ -d "$ROOT/Content/Levels" ]; then
    find "$ROOT/Content/Levels" -name '*.uasset' 2>/dev/null \
      | jq -R '{ path: . }' | jq -s '.'
  else
    echo '[]'
  fi
}

# ── Inventory: data assets ────────────────────────────────────
data_assets() {
  if [ -d "$ROOT/Content/Data" ]; then
    find "$ROOT/Content/Data" -name '*.uasset' 2>/dev/null \
      | jq -R '{ path: . }' | jq -s '.'
  else
    echo '[]'
  fi
}

# ── Inventory: Abilities (GAS) ────────────────────────────────
abilities() {
  if [ -d "$ROOT/Source" ]; then
    grep -r "class.*UGameplayAbility" "$ROOT/Source" 2>/dev/null \
      | cut -d: -f1 \
      | sort -u \
      | head -50 \
      | jq -R '{ path: . }' | jq -s '.'
  else
    echo '[]'
  fi
}

# ── Inventory: config files ───────────────────────────────────
config_files() {
  if [ -d "$ROOT/Config" ]; then
    find "$ROOT/Config" -name 'Default*.ini' 2>/dev/null \
      | jq -R '{ path: . }' | jq -s '.'
  else
    echo '[]'
  fi
}

# ── Stale-detection hash ──────────────────────────────────────
TREE_HASH=""
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  TREE_HASH=$(git -C "$ROOT" ls-tree -r HEAD 2>/dev/null | sha256sum | cut -c1-16)
fi

# ── Compose ───────────────────────────────────────────────────
jq -n \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg name "$NAME" \
  --arg desc "$DESC" \
  --arg tree_hash "$TREE_HASH" \
  --argjson stack "$STACK_JSON" \
  --argjson entry_points "$(entry_points)" \
  --argjson task_routing "$(task_routing)" \
  --argjson cpp_classes "$(cpp_classes)" \
  --argjson blueprints "$(blueprints)" \
  --argjson levels "$(levels)" \
  --argjson data_assets "$(data_assets)" \
  --argjson abilities "$(abilities)" \
  --argjson config_files "$(config_files)" \
  '{
     generated_at: $generated_at,
     tree_hash: $tree_hash,
     project: { name: $name, description: $desc, stack: $stack },
     entry_points: $entry_points,
     task_routing: $task_routing,
     inventory: {
       cpp_classes: $cpp_classes,
       blueprints: $blueprints,
       levels: $levels,
       data_assets: $data_assets,
       abilities: $abilities,
       config_files: $config_files
     }
   }' > "$OUT"

echo "✓ wrote $OUT (tree_hash=$TREE_HASH)"
