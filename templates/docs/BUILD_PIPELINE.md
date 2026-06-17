# Build Pipeline

> Cook, package, CI, Steam upload, and EOS Ecom wiring for {{PROJECT_NAME}}.

## Build Configurations

| Config | Optimized | Logging | Assertions | Use |
|---|---|---|---|---|
| `DebugGame` | No | Full | Yes | Debugging with symbols |
| `Development` | Partial | Full | Yes | Daily dev, playtests |
| `Shipping` | Full | None | No | Distribution |

Always package `Development` for internal playtests. `Shipping` only for release candidates.

## Make Targets (quick reference)

```bash
make build              # UnrealBuildTool — compile editor + game modules
make cook-smoke         # Cook LT_SmokeCook for validation
make package-dev        # Full Development package → Packaged/Dev/
make package-shipping   # Full Shipping package → Packaged/Shipping/
make gate               # compile + cook-smoke + automation-critical
```

## UAT Invocations

```bash
# Development package (all maps)
$(UAT) BuildCookRun \
  -project=$(UPROJECT) \
  -platform=Win64 \
  -configuration=Development \
  -cook -allmaps -stage -pak -archive \
  -archivedirectory=Packaged/Dev

# Shipping package (distribution)
$(UAT) BuildCookRun \
  -project=$(UPROJECT) \
  -platform=Win64 \
  -configuration=Shipping \
  -cook -allmaps -stage -pak -archive -distribution \
  -archivedirectory=Packaged/Shipping
```

## CI / CD

_(describe CI system: GitHub Actions / Jenkins / TeamCity)_

Minimum CI jobs per PR:
1. `compile` — UnrealBuildTool, all modules
2. `cook-smoke` — `LT_SmokeCook` only
3. `automation-critical` — `@critical` Functional Tests

Gate: all three jobs green = PR mergeable.

## Steam Upload

- Tool: SteamCMD + `steamcmd.sh` in `Build/Steam/`.
- App ID: _(populate)_
- Depot ID: _(populate)_
- Build script: `Build/Steam/app_build.vdf`

```bash
steamcmd +login <user> +run_app_build Build/Steam/app_build.vdf +quit
```

- Branch: `default` for release, `beta` for internal test.
- MicroTxn sandbox: use Steam partner sandbox until first review approval.

## EOS Ecom (if enabled)

- Organization ID: _(populate)_
- Product ID: _(populate)_
- Catalog setup: `Plugins/OnlineSubsystemEOS/Config/DefaultEngine.ini` → `[EOSEcom]`.
- Entitlement verification: server-side via `UEOSEcomSubsystem::VerifyEntitlement` — never trust client.
- Sandbox mode: `EOS_PRODUCTION_ENVIRONMENT=false` in dev `.env`-equivalent INI override.

## Platform-Specific Notes

### Windows
- Shipping build: enable `bCompressShaderData=true` in `DefaultEngine.ini`.
- Prerequisites redistributable: bundled via NSIS installer or Steam.

### PS5 / Xbox (if applicable)
- Separate platform cook: `-platform=PS5` or `-platform=XSX`.
- Cert requirements: _(link to platform partner NDA docs)_

## Git LFS in CI

All `.uasset`, `.umap`, `.ubulk`, `.uexp` tracked by Git LFS. CI runner must:
```bash
git lfs install
git lfs pull
```
before cook. Missing LFS objects silently produce broken packages.

## Package Checklist

Before tagging a release candidate:
- [ ] `make gate` green on clean checkout
- [ ] `make package-shipping` succeeds with zero cook errors
- [ ] All Wwise SoundBanks included in package (check `WwiseAudio/GeneratedSoundBanks/` is cooked)
- [ ] Crash reporter endpoint configured in `DefaultEngine.ini` → `[CrashReportClient]`
- [ ] Version string bumped in `DefaultGame.ini` → `ProjectVersion`
- [ ] Steam depot + EOS catalog entries updated (if applicable)
