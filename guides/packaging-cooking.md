# Packaging and Cooking — Cook Pipeline, Build Configs, AutomationTool

> Cooking transforms raw UE5 content into platform-specific cooked packages; packaging wraps the cooked content and engine binaries into a shippable executable. Every step runs through `RunUAT.sh` (UnrealAutomationTool) or the project Makefile — never the Editor UI for CI. A "slim-variant smoke build" cooks only the maps and assets needed for the critical path so CI finishes in under 15 minutes.

---

## Build Configurations

| Config | Use |
|--------|-----|
| `Debug` | Full debug info, no optimization. Rarely used — too slow. |
| `DebugGame` | Debug symbols for game modules, engine optimized. Daily dev build. |
| `Development` | Shipping-like optimizations, stats and debug tools still on. |
| `Shipping` | No debug tools, full optimization, no cheats. Release candidate only. |
| `Test` | Like Shipping but with stats and Gauntlet support. CI test builds. |

For the vertical slice: develop on `Development`, run CI tests on `Test`, ship on `Shipping`.

---

## Cook Concepts

- **Cook** = process source assets into cooked `.uasset`/`.umap` packages for the target platform.
- **Stage** = copy cooked content + engine binaries to a staging directory.
- **Package** = produce the final executable (`.exe`, AppImage, etc.) from the staged content.
- **Archive** = copy the packaged build to `$(BUILD_DIR)` for distribution.

These steps correspond to the `-cook -stage -package -archive` RunUAT flags.

---

## Makefile

```makefile
# ─── Config ──────────────────────────────────────────────────────────────────
UE_ROOT    ?= /home/brinkercode/UnrealEngine
PROJECT    ?= $(shell pwd)
UPROJECT   := $(PROJECT)/ProjectName.uproject
PLATFORM   ?= Linux             # Win64 | Mac | Linux | PS5 | XSX
BUILD_DIR  := $(PROJECT)/Builds
COOK_DIR   := $(PROJECT)/Saved/Cooked
MAPS_SLIM  := /Game/Maps/TestLevel   # Minimal map set for smoke cook
MAPS_FULL  := +map=/Game/Maps/MainMenu +map=/Game/Maps/TestLevel +map=/Game/Maps/Level01

UAT := "$(UE_ROOT)/Engine/Build/BatchFiles/RunUAT.sh"
UEB := "$(UE_ROOT)/Engine/Build/BatchFiles/Linux/Build.sh"
UEC := "$(UE_ROOT)/Engine/Binaries/Linux/UnrealEditor-Cmd"

.PHONY: build build-server cook cook-slim package smoke automation-critical gate clean

# ─── Build ────────────────────────────────────────────────────────────────────

## Development Editor build (daily dev)
build:
	$(UEB) ProjectNameEditor Linux Development "$(UPROJECT)" -waitmutex -progress

## Dedicated server build (Shipping)
build-server:
	$(UEB) ProjectNameServer Linux Shipping "$(UPROJECT)" -waitmutex

# ─── Cook ────────────────────────────────────────────────────────────────────

## Full cook for all maps — slow, run before release candidate
cook:
	$(UAT) BuildCookRun \
	    -project="$(UPROJECT)" \
	    -noP4 -platform=$(PLATFORM) -clientconfig=Shipping \
	    -cook $(MAPS_FULL) \
	    -unversioned -compressed \
	    -cookdir="$(COOK_DIR)" \
	    -log

## Slim cook — only TestLevel, used by smoke target in CI
cook-slim:
	$(UEC) "$(UPROJECT)" \
	    -run=Cook \
	    -TargetPlatform=$(PLATFORM) \
	    -map=$(MAPS_SLIM) \
	    -unversioned -compressed \
	    -log

# ─── Package ─────────────────────────────────────────────────────────────────

## Full package to BUILD_DIR — run this for release candidate
package:
	$(UAT) BuildCookRun \
	    -project="$(UPROJECT)" \
	    -noP4 -platform=$(PLATFORM) -clientconfig=Shipping \
	    -cook $(MAPS_FULL) \
	    -stage -package -archive \
	    -archivedirectory="$(BUILD_DIR)/$(PLATFORM)" \
	    -compressed -unversioned \
	    -log

## Test/Automation package — Test config, includes Gauntlet runner
package-test:
	$(UAT) BuildCookRun \
	    -project="$(UPROJECT)" \
	    -noP4 -platform=$(PLATFORM) -clientconfig=Test \
	    -cook $(MAPS_SLIM) \
	    -stage -package -archive \
	    -archivedirectory="$(BUILD_DIR)/Test" \
	    -log

# ─── CI Targets ──────────────────────────────────────────────────────────────

## Smoke: slim cook + shader compile check (fast, < 15 min)
smoke: cook-slim
	@echo "Smoke cook complete. Checking for cook errors..."
	@grep -i "Error:" "$(PROJECT)/Saved/Logs/Cook.log" | grep -v "LogCook" && exit 1 || true
	@echo "Smoke passed."

## Automation: run Functional Tests tagged @critical in headless mode
automation-critical: package-test
	$(UEC) "$(UPROJECT)" \
	    -ExecCmds="Automation RunTests ProjectName.Critical;Quit" \
	    -TestExit \
	    -log \
	    -ReportOutputPath="$(BUILD_DIR)/TestResults"

## Gate: full CI gate — smoke + automation + lint
gate: smoke automation-critical
	@echo "Gate passed. Ready to commit."

# ─── Helpers ─────────────────────────────────────────────────────────────────

## Wipe cooked and staged content
clean:
	rm -rf "$(COOK_DIR)"
	rm -rf "$(PROJECT)/Saved/StagedBuilds"
	rm -rf "$(BUILD_DIR)"
```

---

## Cook Options Reference

| Flag | Meaning |
|------|---------|
| `-cook` | Enable content cooking |
| `-unversioned` | Do not write version numbers into cooked packages (smaller, faster) |
| `-compressed` | Compress cooked packages with Oodle |
| `-map=` | Cook only specified maps (slim variant) |
| `+map=` | Append additional map to cook list |
| `-iterativecooking` | Incremental: only re-cook changed assets |
| `-CookAll` | Cook every asset, even unreferenced ones (avoid — bloats package) |
| `-SkipCook` | Skip cook, use existing cooked content (faster staging) |
| `-DLCName=` | Cook a named DLC chunk only |

---

## Shader Compilation

Shaders are the dominant cook-time bottleneck. On first cook, the shader compiler will run for 20–60 minutes depending on material count.

```bash
# Force-rebuild all shaders (run after major material refactor)
$(UEC) "$(UPROJECT)" \
    -run=CompileAllShaders \
    -targetplatform=$(PLATFORM) \
    -log

# Check shader compile errors without a full cook
$(UEC) "$(UPROJECT)" \
    -run=DeriveDataCache \
    -fill \
    -log
```

**Reduce iteration time:**
- Keep `r.ShaderDevelopmentMode=1` in `Config/DefaultEngine.ini` during development — enables hot-reload of modified shaders without full cook.
- Use `r.Shaders.Optimize=0` in `Development` config — faster compile, more debug info.
- Enable `SharedDDC` (Derived Data Cache on a network share) for multi-dev teams — shaders compiled once, shared to all workstations.

---

## Iterative Cooking

```bash
# Faster cooks after the first run: only changed assets
$(UAT) BuildCookRun \
    -project="$(UPROJECT)" \
    -noP4 -platform=$(PLATFORM) -clientconfig=Development \
    -cook -iterativecooking \
    -stage -package \
    -log
```

The DDC tracks hashes of source assets. Unchanged assets are served from cache. First cook: 45 min. Subsequent incremental cooks: 3–8 min on a warm cache.

---

## Config/DefaultGame.ini Cook Settings

```ini
[/Script/UnrealEd.ProjectPackagingSettings]
BuildConfiguration=Shipping
FullRebuild=False
bUseIoStore=True                   ; Pak file IO optimization — enable for shipping
bMakeBinaryConfig=True
bSkipEditorContent=True            ; Don't ship editor-only assets
BlueprintNativizationMethod=Disabled   ; Keep BPs as-is; nativization not stable

[/Script/Engine.Engine]
bSmoothFrameRate=True
SmoothedFrameRateRange=(LowerBound=(Type=Inclusive,Value=30),UpperBound=(Type=Exclusive,Value=120))

[StagingSettings]
; Specify chunks for DLC-like streaming installs
+DirectoriesToAlwaysStageAsUFS=(Path="Localization")
```

---

## Automation Test Tagging

Tag Functional Tests so `automation-critical` runs only the fast/critical subset:

```cpp
// In AFunctionalTest subclass or test spec:
// Tag via category string "ProjectName.Critical" in the Test Name field,
// or use the UE test category system:

// In the .ini: always run @critical on CI, run @full on release candidate
```

```ini
# Config/DefaultEditor.ini
[/Script/FunctionalTesting.FunctionalTestingManager]
+TestsToRun=(Path="/Game/Tests/", Filter="ProjectName.Critical")
```

---

## Platform-Specific Notes

### PC (Win64 / Linux)
- Use Oodle compression (`-compressed`).
- Enable `bUseIoStore=True` for faster load times via IoStore container files.
- Test on GTX 1060 equivalent before tagging a build as vertical-slice-passing.

### PS5 / XSX
- Requires platform SDK and devkit hardware. Cook flags add `-platform=PS5` or `-platform=XSX`.
- PSSL shader compilation replaces HLSL — expect longer first-cook times.
- Console builds go to `$(BUILD_DIR)/Console/` and require certification submission workflow (separate doc).

### macOS
- Requires Mac build agent for codesigning. Not a primary target for vertical slice.

---

## Key Rules

1. **Never cook or package from the Editor UI in CI** — always `RunUAT.sh` or Makefile targets. UI cook does not error-exit cleanly.
2. **Slim cook for smoke** — cook only `TestLevel` for the fast gate. Full cook only on release candidate.
3. **`-iterativecooking` for dev loops** — full rebuild only on a clean machine or after asset restructuring.
4. **Check `Cook.log` for errors** — `RunUAT` exit code 0 does not mean the cook is clean. Check `grep "Error:" Saved/Logs/Cook.log`.
5. **Shader DDC on a shared network drive** for teams of 2+** — one compile, everyone benefits.
6. **`bUseIoStore=True` before shipping** — significant load time improvement, no runtime downside.
7. **Test config for automation builds** — `Test` config includes Gauntlet runner; `Shipping` does not.
