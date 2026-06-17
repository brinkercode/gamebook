# {{PROJECT_NAME}} — Master Makefile
# Single source of truth for what passes locally + in CI + in pre-commit.
# All agents must run `make gate` before handing off.

.PHONY: help build cook-smoke automation-critical gauntlet-critical package-dev package-shipping \
        gate index clean

GAMEBOOK   ?= $(HOME)/.claude/gamebook
PROJECT    := {{PROJECT_NAME}}
UE_ROOT    ?= /opt/UnrealEngine
UBT        := $(UE_ROOT)/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool
UAT        := $(UE_ROOT)/Engine/Build/BatchFiles/RunUAT.sh
EDITOR_CMD := $(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor
# On macOS swap Linux → Mac; on Windows use .exe equivalents.

UPROJECT   := $(PROJECT).uproject
TEST_MAP   ?= /Game/Levels/Test_Persistent
COOK_MAP   ?= /Game/Levels/LT_SmokeCook

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-26s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─── Compile ──────────────────────────────────────────────────
build: ## Compile editor + game modules via UnrealBuildTool
	$(UBT) $(PROJECT)Editor Linux Development $(CURDIR)/$(UPROJECT) -waitmutex
	@echo "✅ build passed"

# ─── Cook ─────────────────────────────────────────────────────
cook-smoke: ## Cook a minimal map variant for smoke / Phase 3 validation
	$(UAT) BuildCookRun \
	  -project=$(CURDIR)/$(UPROJECT) \
	  -platform=Linux \
	  -configuration=Development \
	  -cook -map=$(COOK_MAP) \
	  -skipcookingeditorcontent \
	  -nocompile -nocompileeditor
	@echo "✅ cook-smoke passed"

# ─── Functional / Gauntlet tests ─────────────────────────────
automation-critical: ## Run Functional Tests tagged @critical via automation framework
	$(EDITOR_CMD) $(CURDIR)/$(UPROJECT) \
	  -unattended -nopause -nosplash \
	  -ExecCmds="Automation RunTests $(PROJECT).Critical; Quit" \
	  -testexit="Automation Test Queue Empty" \
	  -log -abslog=$(CURDIR)/Saved/Logs/automation-critical.log
	@grep -q "SUCCEEDED" Saved/Logs/automation-critical.log && echo "✅ automation-critical passed" \
	  || (echo "❌ automation-critical FAILED — see Saved/Logs/automation-critical.log"; exit 1)

gauntlet-critical: ## Run Gauntlet stress tests tagged @critical
	$(UAT) RunUnrealTests \
	  -project=$(CURDIR)/$(UPROJECT) \
	  -platform=Linux \
	  -configuration=Development \
	  -test="$(PROJECT).Gauntlet.Critical"
	@echo "✅ gauntlet-critical passed"

# ─── Gate (deterministic — used by CI + agents) ───────────────
gate: ## Full deterministic gate — build + cook-smoke + automation-critical
ifeq ($(STEP),compile)
	$(MAKE) build
else ifeq ($(STEP),test)
	$(MAKE) automation-critical
else
	$(MAKE) build
	$(MAKE) cook-smoke
	$(MAKE) automation-critical
	@echo "✅ gate passed"
endif

# ─── Index ────────────────────────────────────────────────────
index: ## Regenerate .claude/INDEX.json (token-saving project manifest for agents)
	@bash $(GAMEBOOK)/scripts/gen-index.sh
	@echo "✅ index refreshed"

# ─── Package ──────────────────────────────────────────────────
package-dev: ## Package Development config (no shipping optimizations; for internal playtests)
	$(UAT) BuildCookRun \
	  -project=$(CURDIR)/$(UPROJECT) \
	  -platform=Linux \
	  -configuration=Development \
	  -cook -stage -pak -archive \
	  -archivedirectory=$(CURDIR)/Packaged/Dev
	@echo "✅ package-dev done → Packaged/Dev/"

package-shipping: ## Package Shipping config (final, optimized; for distribution)
	$(UAT) BuildCookRun \
	  -project=$(CURDIR)/$(UPROJECT) \
	  -platform=Linux \
	  -configuration=Shipping \
	  -cook -stage -pak -archive -distribution \
	  -archivedirectory=$(CURDIR)/Packaged/Shipping
	@echo "✅ package-shipping done → Packaged/Shipping/"

# ─── Clean ────────────────────────────────────────────────────
clean: ## Remove Binaries/, Intermediate/, Saved/Cooked/ (NOT Saved/Logs)
	rm -rf Binaries Intermediate Saved/Cooked
	@echo "✅ clean done"
