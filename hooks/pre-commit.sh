#!/usr/bin/env bash
# Pre-commit hook — fast checks on STAGED files only for UE5 game projects. Blocks commit on failure.
# Install: ln -sf "$(git rev-parse --show-toplevel)/../gamebook/hooks/pre-commit.sh" .git/hooks/pre-commit
# Or via gamebook-init.sh which symlinks automatically.

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
skip() { echo -e "${YELLOW}-${NC} $1"; }

STAGED=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$STAGED" ] && exit 0

# ── Detect transient directories that should NEVER be committed ──────
TRANSIENT=$(echo "$STAGED" | grep -E '^(Saved|Intermediate|DerivedDataCache|Binaries)/' || true)
if [ -n "$TRANSIENT" ]; then
  fail "Transient directories detected (Saved/Intermediate/DerivedDataCache/Binaries). These must not be in git."
fi

# ── Git LFS checks ─────────────────────────────────────────────────
# Blocks binary assets >100MB not in LFS; blocks common asset types if NOT tracked by LFS.
LARGE_BINARIES=$(echo "$STAGED" | while read f; do
  [ -f "$f" ] || continue
  size=$(stat --format=%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo 0)
  # >100MB without LFS attribute is forbidden
  if [ "$size" -gt 104857600 ]; then
    in_lfs=$(git check-attr filter "$f" 2>/dev/null | grep -q 'lfs' && echo 1 || echo 0)
    if [ "$in_lfs" -eq 0 ]; then
      echo "$f"
    fi
  fi
done)

if [ -n "$LARGE_BINARIES" ]; then
  fail "Binary files >100MB must be tracked by Git LFS. Not in LFS:\n$(echo "$LARGE_BINARIES" | sed 's/^/  /')"
fi

# Blocks .uasset/.umap/.fbx/.png/.wav/.ogg if NOT in Git LFS
MUST_LFS=$(echo "$STAGED" | grep -E '\.(uasset|umap|fbx|png|wav|ogg)$' || true)
if [ -n "$MUST_LFS" ]; then
  NOT_LFS=$(echo "$MUST_LFS" | while read f; do
    in_lfs=$(git check-attr filter "$f" 2>/dev/null | grep -q 'lfs' && echo 1 || echo 0)
    [ "$in_lfs" -eq 0 ] && echo "$f"
  done)
  if [ -n "$NOT_LFS" ]; then
    fail "Asset files must be in Git LFS:\n$(echo "$NOT_LFS" | sed 's/^/  /')"
  fi
fi

ok "No large binaries / LFS check passed"

# ── Light UE5 naming convention check on .uasset paths ──────────────
UASSETS=$(echo "$STAGED" | grep '\.uasset$' || true)
if [ -n "$UASSETS" ]; then
  BAD_NAMES=$(echo "$UASSETS" | while read f; do
    filename=$(basename "$f" .uasset)
    # Check against common UE5 prefixes: BP_ M_ T_ MI_ SK_ SM_ S_ Cue_ A_ DA_ DT_ E_ NS_ GA_ GE_
    # Warn (don't fail) if it doesn't match a known prefix
    if ! echo "$filename" | grep -qE '^(BP_|M_|MI_|MF_|T_|SK_|SM_|S_|Cue_|A_|ABP_|DA_|DT_|E_|NS_|NE_|LT_|GA_|GE_|GAS_)'; then
      echo "$f: '$filename' — consider UE5 prefix (BP_, DA_, DT_, M_, T_, etc.)"
    fi
  done)
  if [ -n "$BAD_NAMES" ]; then
    echo -e "${YELLOW}⚠${NC} UE5 naming conventions:\n$(echo "$BAD_NAMES" | sed 's/^/  /')"
  fi
fi

# ── .uproject Engine version vs Config/DefaultEngine.ini check ───────
# Only enforce on commit to 'main' branch to catch version drift
if git rev-parse --abbrev-ref HEAD | grep -q '^main$'; then
  UPROJECT=$(find . -maxdepth 1 -name "*.uproject" -print -quit)
  if [ -n "$UPROJECT" ] && [ -f "Config/DefaultEngine.ini" ]; then
    ENGINE_VER=$(grep '"EngineAssociation"' "$UPROJECT" | grep -oE '[0-9]+\.[0-9]+' | head -1 || true)
    INI_VER=$(grep -i 'EngineVersion' "Config/DefaultEngine.ini" | grep -oE '[0-9]+\.[0-9]+' | head -1 || true)

    if [ -n "$ENGINE_VER" ] && [ -n "$INI_VER" ] && [ "$ENGINE_VER" != "$INI_VER" ]; then
      fail ".uproject Engine version ($ENGINE_VER) does not match Config/DefaultEngine.ini ($INI_VER). Update before committing to main."
    fi
  fi
fi

# ── Clang-format on C++ source files ────────────────────────────────
CPP_FILES=$(echo "$STAGED" | grep -E '\.(h|hpp|cpp|cc)$' || true)
if [ -n "$CPP_FILES" ] && command -v clang-format >/dev/null; then
  FORMAT_ISSUES=$(echo "$CPP_FILES" | while read f; do
    # Use --dry-run (exit code 0 = formatted, 1 = needs format)
    if ! clang-format --dry-run --output-replacements-xml "$f" 2>/dev/null | grep -q '</replacements>$'; then
      echo "$f"
    fi
  done)
  if [ -n "$FORMAT_ISSUES" ]; then
    fail "Clang-format issues. Run: clang-format -i $(echo "$FORMAT_ISSUES" | tr '\n' ' ')"
  fi
  ok "clang-format"
elif [ -n "$CPP_FILES" ]; then
  skip "clang-format not installed (skipping C++ format check)"
fi

ok "pre-commit passed"
