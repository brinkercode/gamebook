# Steam Deployment — SteamCMD, Depots, Branches, Beta

> Getting a cooked build onto Steam requires SteamCMD, a correctly configured App / Depot / Branch hierarchy in Steamworks, and a repeatable upload script that CI can drive. This guide covers the complete publish path from a packaged build to a Steam beta branch, plus the branch promotion workflow to push it to the `default` (public) branch.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| SteamCMD | Latest | `apt install steamcmd` or [download](https://developer.valvesoftware.com/wiki/SteamCMD) |
| Steamworks SDK | 1.57+ | Bundled with UE5's Steam OSS plugin |
| Steamworks app | — | Created in Steamworks Partner — you need an App ID |
| Build machine OS | Linux or Windows | SteamCMD runs cross-platform |

---

## Steamworks App / Depot Model

```
App ID (e.g. 1234560)
├── Depot: 1234561   Windows client
├── Depot: 1234562   Linux client
├── Depot: 1234563   macOS client    (optional for vertical slice)
└── Depot: 1234564   Dedicated server (optional — multiplayer path only)

Branches (set in Steamworks → Builds tab):
├── default       → public release (approved manually)
├── beta          → opt-in public beta
├── qa            → internal QA only (password-protected)
└── dev           → CI uploads (password-protected)
```

One depot per OS. Never mix OS builds in a single depot — SteamPipe can't filter by platform within a depot.

---

## SteamCMD Login

Create a dedicated Steam account for CI. Enable Steam Guard Mobile Authenticator and store the TOTP seed in CI secrets (not the password — SteamCMD accepts TOTP codes).

```bash
# First-time login (interactive — stores session token)
steamcmd +login "$STEAM_USERNAME" "$STEAM_PASSWORD" +quit

# Subsequent CI logins use the cached session token (no password needed if token valid)
steamcmd +login "$STEAM_USERNAME" +quit
```

Store credentials:
- `STEAM_USERNAME` — CI secret, not in code.
- `STEAM_PASSWORD` — CI secret, rotate after every team change.
- Never commit `.steamcmd/` or `config/loginusers.vdf` — those hold session tokens.

---

## App Build Script

SteamCMD takes `.vdf` (Valve Data Format) scripts. Keep them in `deploy/steam/`.

### deploy/steam/app_build.vdf

```vdf
"AppBuild"
{
    "AppID"        "1234560"
    "Desc"         "ProjectName v$(BUILD_VERSION) $(BUILD_DATE)"
    "Silent"       "1"

    "Depots"
    {
        "1234561"
        {
            "FileMapping"
            {
                "LocalPath"   "$(BUILD_DIR)/Win64/*"
                "DepotPath"   "."
                "recursive"   "1"
            }
            "FileExclusion"  "*.pdb"
            "FileExclusion"  "*.exp"
            "FileExclusion"  "Crash*"
        }

        "1234562"
        {
            "FileMapping"
            {
                "LocalPath"   "$(BUILD_DIR)/Linux/*"
                "DepotPath"   "."
                "recursive"   "1"
            }
            "FileExclusion"  "*.sym"
        }
    }
}
```

### deploy/steam/branch_set.vdf (post-upload: promote build to a branch)

```vdf
"AppBuild"
{
    "AppID"    "1234560"
    "SetLive"  "dev"     ← change to "beta" or "default" for promotions
}
```

---

## Upload Script

`deploy/steam/upload.sh` — called by CI or manually by the build engineer.

```bash
#!/usr/bin/env bash
set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
APP_ID="${STEAM_APP_ID:?}"
USERNAME="${STEAM_USERNAME:?}"
BUILD_DIR="${BUILD_DIR:?}"
STEAM_SCRIPTS="$(dirname "$0")"
BUILD_VERSION="${1:?Usage: upload.sh <version>}"    # e.g. "0.4.2"
BUILD_DATE="$(date +%Y-%m-%d)"
TARGET_BRANCH="${2:-dev}"                            # default: dev branch

# ─── Substitute variables into VDF ───────────────────────────────────────────
envsubst '${BUILD_VERSION},${BUILD_DATE},${BUILD_DIR}' \
    < "${STEAM_SCRIPTS}/app_build.vdf.tmpl" \
    > /tmp/app_build_resolved.vdf

# ─── Upload ───────────────────────────────────────────────────────────────────
echo "[steam] Uploading build ${BUILD_VERSION} to depot(s)..."
steamcmd \
    +login "${USERNAME}" \
    +run_app_build /tmp/app_build_resolved.vdf \
    +quit

# ─── Set live on branch ───────────────────────────────────────────────────────
echo "[steam] Setting build live on branch: ${TARGET_BRANCH}..."
steamcmd \
    +login "${USERNAME}" \
    +app_set_build_live "${APP_ID}" <(cat "${STEAM_SCRIPTS}/branch_set.vdf" | sed "s/dev/${TARGET_BRANCH}/") \
    +quit

echo "[steam] Done. Check https://partner.steamgames.com/apps/builds/${APP_ID}"
```

Usage:
```bash
# CI: upload to dev branch
BUILD_DIR=./Builds STEAM_APP_ID=1234560 STEAM_USERNAME=ci_bot \
    deploy/steam/upload.sh "0.4.2"

# Release: upload to beta branch
BUILD_DIR=./Builds STEAM_APP_ID=1234560 STEAM_USERNAME=ci_bot \
    deploy/steam/upload.sh "0.4.2" "beta"
```

---

## Makefile Integration

```makefile
.PHONY: steam-upload steam-promote-beta steam-promote-default

## Upload current build to dev branch
steam-upload: package
	BUILD_DIR="$(BUILD_DIR)" \
	STEAM_APP_ID="$(STEAM_APP_ID)" \
	STEAM_USERNAME="$(STEAM_USERNAME)" \
	    deploy/steam/upload.sh "$(VERSION)"

## Promote dev build to beta branch (human runs this)
steam-promote-beta:
	steamcmd \
	    +login "$(STEAM_USERNAME)" \
	    +app_set_build_live $(STEAM_APP_ID) $(BETA_BUILD_ID) beta \
	    +quit

## Promote to default (public release — requires lead sign-off)
steam-promote-default:
	@read -p "Promote build $(DEFAULT_BUILD_ID) to public default branch? [y/N] " ans; \
	[ "$$ans" = "y" ] || exit 1
	steamcmd \
	    +login "$(STEAM_USERNAME)" \
	    +app_set_build_live $(STEAM_APP_ID) $(DEFAULT_BUILD_ID) "" \
	    +quit
```

---

## Branch Promotion Workflow

```
CI packages build
    └─ make steam-upload VERSION=0.4.2
          └─ Upload to "dev" branch (password-protected, internal only)

QA tests the dev branch build
    └─ Approve? → eng-build runs: make steam-promote-beta
          └─ Build goes live on "beta" (opt-in public beta)

Beta feedback integrated → release candidate built
    └─ Lead approves → make steam-promote-default
          └─ Build goes live on "default" (all players)
```

Never push directly to `default` from CI. Always through `dev → beta → default`. The interactive confirmation in `steam-promote-default` is intentional.

---

## Steam Cloud (Save Sync)

Configure in Steamworks → Cloud:
- Enable `User Data`:
  - `RemoteStorage_UserFileWrite` for all files under `%USERPROFILE%\Saved Games\ProjectName\`
  - Quota: 100 MB per user (generous — save files are small)
- Exclude:
  - Shader caches
  - `*.log` files
  - `*.crash` files

UE5 integration: `USaveSubsystem` (see [save-load.md](save-load.md)) detects `IOnlineSubsystem::GetUserCloudInterface()` and mirrors save slots to Steam Cloud on successful async save.

---

## Steam Overlay and EOS

The Steam Overlay requires `bUseSteam=true` in `OnlineSubsystemSteam`:

```ini
# Config/DefaultEngine.ini
[OnlineSubsystemSteam]
bEnabled=True
SteamDevAppId=480    ; Use 480 (SpaceWar) in development; replace with real App ID at ship
bRelaunchInSteam=False
GameServerQueryPort=27015
bAllowP2PPacketRelay=True

[OnlineSubsystem]
DefaultPlatformService=Steam
```

For EOS entitlement queries used in microtransactions, see [microtransactions.md](microtransactions.md).

---

## Pre-Upload Checklist

- [ ] Build config is `Shipping` (not `Development`)
- [ ] Version string matches `$(BUILD_VERSION)` — no "0.0.0" placeholders
- [ ] All maps cooked without errors (`grep "Error:" Cook.log`)
- [ ] Gate passed (`make gate`)
- [ ] PDB / debug symbols excluded from depot FileExclusions
- [ ] Steam App ID is the real ID, not the test ID (480)
- [ ] STEAM_USERNAME and STEAM_PASSWORD set in CI secrets (not committed)
- [ ] `app_build.vdf` BUILD_DIR paths match actual packaged output directories
- [ ] Lead has approved the promotion to beta / default

---

## Key Rules

1. **Dedicated CI Steam account** — never the personal account of a team member. Rotate the password on team membership changes.
2. **One depot per OS** — don't mix platforms in a single depot.
3. **CI uploads to `dev` branch only** — `beta` and `default` promotions are human-gated.
4. **Version string in every build description** — makes rollback and bisection tractable.
5. **PDB exclusion in depot scripts** — debug symbols double the upload size and should not be on Steam CDN.
6. **Steam Cloud quota set before launch** — retroactively shrinking quota can delete player saves.
7. **Test on the actual Steam client** — overlay, achievement unlock, and microtransaction flows only work with a real Steam installation, not a loose binary.
