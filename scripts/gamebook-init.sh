#!/usr/bin/env bash
# gamebook-init.sh — bootstrap a new UE5 game project from gamebook templates.
# Idempotent: re-running only fills in missing pieces.
#
# Usage:
#   bash ~/.claude/gamebook/scripts/gamebook-init.sh \
#     [--name NAME] [--desc DESC] \
#     [--ue-version 5.7+] [--wwise] [--multiplayer]
#
# Run from inside the empty (or partial) project directory.

set -euo pipefail

GAMEBOOK="${GAMEBOOK:-$HOME/.claude/gamebook}"
TEMPLATES="$GAMEBOOK/templates"
ROOT="$(pwd)"

NAME=""
DESC=""
UE_VERSION="5.7"
WWISE=1
MULTIPLAYER=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)         NAME="$2"; shift 2 ;;
    --desc)         DESC="$2"; shift 2 ;;
    --ue-version)   UE_VERSION="$2"; shift 2 ;;
    --no-wwise)     WWISE=0; shift ;;
    --multiplayer)  MULTIPLAYER=1; shift ;;
    -h|--help)      sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1"; exit 1 ;;
  esac
done

# Auto-detect name from project.config.json if it exists
if [ -f "$ROOT/project.config.json" ] && command -v jq &>/dev/null; then
  DETECTED=$(jq -r '.name // empty' "$ROOT/project.config.json" 2>/dev/null)
  if [ -n "$DETECTED" ] && [ "$DETECTED" != "null" ]; then
    NAME="$DETECTED"
    echo "→ Detected project name from project.config.json: $NAME"
  fi
fi

# ── Prompts (only for missing args, with defaults) ────────────
if [ -z "$NAME" ]; then
  read -rp "Project name [$(basename "$ROOT")]: " NAME
  NAME="${NAME:-$(basename "$ROOT")}"
fi
if [ -z "$DESC" ]; then
  read -rp "One-line description: " DESC
  DESC="${DESC:-A new UE5 game.}"
fi

echo "→ Project:     $NAME"
echo "→ Engine:      UE $UE_VERSION"
echo "→ Audio:       $([ $WWISE -eq 1 ] && echo "Wwise" || echo "MetaSounds")"
echo "→ Multiplayer: $([ $MULTIPLAYER -eq 1 ] && echo "enabled" || echo "disabled")"
echo "→ Root:        $ROOT"
echo

# ── Helper: substitute placeholders ───────────────────────────
subst() {
  sed -e "s|{{PROJECT_NAME}}|$NAME|g" \
      -e "s|{{DESCRIPTION}}|$DESC|g" \
      -e "s|{{UE_VERSION}}|$UE_VERSION|g" "$1"
}

copy_file() {
  local src="$1" dst="$2"
  if [ -f "$dst" ]; then
    echo "  · skip (exists): $dst"
  else
    mkdir -p "$(dirname "$dst")"
    subst "$src" > "$dst"
    echo "  + $dst"
  fi
}

# ── Root files ────────────────────────────────────────────────
echo "▶ Root files"
if [ -f "$ROOT/CLAUDE.md" ]; then
  echo "  = CLAUDE.md exists, leaving as-is"
else
  GAMEBOOK="$GAMEBOOK" bash "$GAMEBOOK/scripts/gen-claude-md.sh" "$ROOT" || copy_file "$TEMPLATES/CLAUDE.md" "$ROOT/CLAUDE.md"
fi
copy_file "$TEMPLATES/.gitignore"          "$ROOT/.gitignore"
copy_file "$TEMPLATES/.editorconfig"       "$ROOT/.editorconfig"
copy_file "$TEMPLATES/.env.example"        "$ROOT/.env.example"
copy_file "$TEMPLATES/Makefile"            "$ROOT/Makefile"
copy_file "$TEMPLATES/.gitattributes"      "$ROOT/.gitattributes"

# ── docs/ ─────────────────────────────────────────────────────
echo "▶ docs/"
for f in "$TEMPLATES/docs/"*.md; do
  [ -f "$f" ] || continue
  copy_file "$f" "$ROOT/docs/$(basename "$f")"
done

# ── .github/workflows/ci.yml ──────────────────────────────────
echo "▶ CI"
copy_file "$TEMPLATES/.github/workflows/ci.yml" "$ROOT/.github/workflows/ci.yml"

# ── .claude/ ──────────────────────────────────────────────────
echo "▶ .claude/"
copy_file "$TEMPLATES/.claude/settings.json" "$ROOT/.claude/settings.json"
mkdir -p "$ROOT/.claude/hooks" "$ROOT/.claude/agents" "$ROOT/.claude/rules" "$ROOT/.claude/skills"

# Symlink hooks back to gamebook so updates propagate
for h in pre-commit.sh post-commit-audit.sh gate.sh session-end.sh; do
  if [ ! -e "$ROOT/.claude/hooks/$h" ]; then
    ln -sf "$GAMEBOOK/hooks/$h" "$ROOT/.claude/hooks/$h"
    echo "  + .claude/hooks/$h → $GAMEBOOK/hooks/$h"
  fi
done

# Copy rules (versioned per-project)
for r in "$GAMEBOOK/rules/"*.md; do
  [ -f "$r" ] && copy_file "$r" "$ROOT/.claude/rules/$(basename "$r")"
done

# Symlink agents back to gamebook
if [ -d "$GAMEBOOK/agents" ]; then
  ADDED=0
  for a in "$GAMEBOOK/agents/"*; do
    name=$(basename "$a")
    if [ ! -e "$ROOT/.claude/agents/$name" ]; then
      ln -sf "$a" "$ROOT/.claude/agents/$name"
      ADDED=$((ADDED+1))
    fi
  done
  [ $ADDED -gt 0 ] && echo "  + .claude/agents/* → $GAMEBOOK/agents/* ($ADDED new symlink(s))"
fi

# Symlink skills back to gamebook
if [ -d "$GAMEBOOK/skills" ]; then
  ADDED=0
  for s in "$GAMEBOOK/skills/"*/; do
    [ -d "$s" ] || continue
    name=$(basename "$s")
    if [ ! -e "$ROOT/.claude/skills/$name" ]; then
      ln -sf "${s%/}" "$ROOT/.claude/skills/$name"
      ADDED=$((ADDED+1))
    fi
  done
  [ $ADDED -gt 0 ] && echo "  + .claude/skills/* → $GAMEBOOK/skills/* ($ADDED new symlink(s))"
fi

# Create handoffs directory for agent-to-agent JSON handoffs
mkdir -p "$ROOT/.claude/handoffs"
touch "$ROOT/.claude/handoffs/.gitkeep"

# Notify if global /ship and /fix slash commands aren't installed
MISSING_CMDS=()
[ ! -e "$HOME/.claude/commands/ship.md" ] && MISSING_CMDS+=("/ship")
[ ! -e "$HOME/.claude/commands/fix.md" ]  && MISSING_CMDS+=("/fix")
if [ ${#MISSING_CMDS[@]} -gt 0 ]; then
  echo "  ! ${MISSING_CMDS[*]} not installed at ~/.claude/commands/"
  echo "    Install machine-wide:  bash $GAMEBOOK/scripts/setup-claude.sh"
fi

# ── Project skeleton ──────────────────────────────────────────
echo "▶ Source/"
mkdir -p "$ROOT/Source/$NAME"/{Core,AI,Gameplay,Characters,Weapons,Input,Abilities}
mkdir -p "$ROOT/Source/${NAME}Editor"
mkdir -p "$ROOT/Source/${NAME}Tests"

echo "▶ Content/"
mkdir -p "$ROOT/Content"/{Core,Characters,Weapons,Levels,UI,VFX,Audio,Data,Input}

echo "▶ Config/"
mkdir -p "$ROOT/Config"
if [ ! -f "$ROOT/Config/DefaultEngine.ini" ]; then
  cat > "$ROOT/Config/DefaultEngine.ini" <<'INI'
[/Script/Engine.Engine]
bUseFixedFrameRate=False
FixedFrameRate=60

[/Script/Engine.RendererSettings]
r.DefaultFeature.AutoExposure=True
r.Nanite.ProjectEnabled=False
r.Lumen.Enabled=False

[/Script/Engine.WorldSettings]
WorldGravityZ=-980.0
INI
  echo "  + Config/DefaultEngine.ini"
fi

echo "▶ Plugins/"
mkdir -p "$ROOT/Plugins"

# ── .uproject file ────────────────────────────────────────────
echo "▶ Project file"
if [ ! -f "$ROOT/$NAME.uproject" ]; then
  cat > "$ROOT/$NAME.uproject" <<JSON
{
  "FileVersion": 3,
  "EngineAssociation": "$UE_VERSION",
  "Category": "Indie",
  "Description": "$DESC",
  "IsEnterprise": false,
  "Modules": [
    {
      "Name": "$NAME",
      "Type": "Runtime",
      "LoadingPhase": "Default"
    },
    {
      "Name": "${NAME}Editor",
      "Type": "Editor",
      "LoadingPhase": "PostDefault"
    },
    {
      "Name": "${NAME}Tests",
      "Type": "Runtime",
      "LoadingPhase": "PostDefault"
    }
  ],
  "Plugins": [
    {
      "Name": "GameplayAbilities",
      "Enabled": true
    },
    {
      "Name": "GameplayTasks",
      "Enabled": true
    },
    {
      "Name": "GameplayTags",
      "Enabled": true
    },
    {
      "Name": "EnhancedInput",
      "Enabled": true
    },
    {
      "Name": "CommonUI",
      "Enabled": true
    },
    {
      "Name": "Niagara",
      "Enabled": true
    }
  ]
}
JSON
  echo "  + $NAME.uproject"
fi

# ── Makefile ──────────────────────────────────────────────────
if [ ! -f "$ROOT/Makefile" ]; then
  cat > "$ROOT/Makefile" <<'MAKE'
.PHONY: help generate cook-smoke automation-critical gauntlet-critical gate dev-bg dev-stop index

help:
	@echo "UE5 Gamebook — Development Targets"
	@echo "  make generate              : Generate Visual Studio project"
	@echo "  make cook-smoke            : Cook one map, smoke-test startup"
	@echo "  make automation-critical   : Run Functional Tests @critical"
	@echo "  make gauntlet-critical     : Run Gauntlet scripted scenarios @critical"
	@echo "  make gate                  : Full validation (compile, cook, tests, gauntlet)"
	@echo "  make index                 : Regenerate .claude/INDEX.json"
	@echo "  make dev-bg                : Launch editor in background"
	@echo "  make dev-stop              : Kill background editor"

generate:
	@echo "Generating Visual Studio project..."
	@bash scripts/generate.sh

cook-smoke:
	@echo "Cooking smoke test map..."
	@bash scripts/cook-smoke.sh

automation-critical:
	@echo "Running critical Functional Tests..."
	@bash scripts/automation-test.sh

gauntlet-critical:
	@echo "Running critical Gauntlet scenarios..."
	@bash scripts/gauntlet-critical.sh

gate: compile cook-smoke automation-critical gauntlet-critical
	@echo "✓ Full gate passed"

compile:
	@echo "Compiling..."
	@bash scripts/compile.sh

dev-bg:
	@bash scripts/dev-bg.sh start

dev-stop:
	@bash scripts/dev-bg.sh stop

index:
	@GAMEBOOK="$${GAMEBOOK}" bash scripts/gen-index.sh

.PHONY: compile
MAKE
  echo "  + Makefile"
fi

# ── Project scripts (the Makefile targets call these repo-locally) ─────────
echo "▶ scripts/"
mkdir -p "$ROOT/scripts"
for s in gen-index cook-smoke automation-test gauntlet-critical generate compile dev-bg; do
  src="$GAMEBOOK/scripts/$s.sh"
  dst="$ROOT/scripts/$s.sh"
  if [ -f "$dst" ]; then
    echo "  · skip (exists): scripts/$s.sh"
  elif [ -f "$src" ]; then
    cp "$src" "$dst" && chmod +x "$dst"
    echo "  + scripts/$s.sh"
  else
    echo "  ! scripts/$s.sh not in gamebook — 'make $s' unavailable until authored"
  fi
done

# ── Git init + hooks ──────────────────────────────────────────
if [ ! -d "$ROOT/.git" ]; then
  git -C "$ROOT" init -q
  echo "  + git init"
fi
mkdir -p "$ROOT/.git/hooks"
ln -sf "$GAMEBOOK/hooks/pre-commit.sh" "$ROOT/.git/hooks/pre-commit"
chmod +x "$ROOT/.git/hooks/pre-commit"
echo "  + .git/hooks/pre-commit → gamebook/hooks/pre-commit.sh"

# ── First INDEX.json ──────────────────────────────────────────
echo "▶ Generating .claude/INDEX.json"
GAMEBOOK="$GAMEBOOK" bash "$GAMEBOOK/scripts/gen-index.sh" || echo "  · gen-index failed (jq missing?)"

# ── Done ──────────────────────────────────────────────────────
cat <<EOF

✅ $NAME initialized at $ROOT

Next:
  1. Edit Config/DefaultEngine.ini and Config/Default*.ini for your game
  2. Open $NAME.uproject in Unreal Engine
  3. make gate                                   # confirm baseline passes
  4. Start the project-scaffolder agent for the gameplay/design interviews.

Daily workflow:
  make dev-bg                                    # launch editor in background
  /ship "<feature description>"                  # single-prompt 2-phase parallel pipeline
  make gate                                      # full validation before commit
  make dev-stop                                  # when done iterating
EOF
