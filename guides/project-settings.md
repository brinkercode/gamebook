# Project Settings — .uproject and Config/Default*.ini

> UE5 project configuration lives in two places: the `.uproject` file (module declarations, plugin enable/disable) and the `Config/Default*.ini` family (engine, game, input, and editor settings). This guide documents the canonical values for a new gamebook project — the minimum-correct set that `project-scaffolder` writes, with explanations for every non-obvious choice.

---

## The .uproject File

```json
{
    "FileVersion": 3,
    "EngineAssociation": "5.7",
    "Category": "",
    "Description": "",
    "Modules": [
        {
            "Name": "ProjectName",
            "Type": "Runtime",
            "LoadingPhase": "Default"
        },
        {
            "Name": "ProjectNameEditor",
            "Type": "Editor",
            "LoadingPhase": "PostEngineInit"
        },
        {
            "Name": "ProjectNameTests",
            "Type": "RuntimeAndProgram",
            "LoadingPhase": "Default"
        }
    ],
    "Plugins": [
        { "Name": "GameplayAbilities",    "Enabled": true },
        { "Name": "EnhancedInput",        "Enabled": true },
        { "Name": "CommonUI",             "Enabled": true },
        { "Name": "Niagara",              "Enabled": true },
        { "Name": "OnlineSubsystem",      "Enabled": true },
        { "Name": "OnlineSubsystemSteam", "Enabled": true },
        { "Name": "EOSSDKPlugin",         "Enabled": true },
        { "Name": "EOSShared",            "Enabled": true },
        { "Name": "OnlineSubsystemEOS",   "Enabled": true },
        { "Name": "FunctionalTestingEditor", "Enabled": true, "Type": "EditorNoCommandlet" },

        { "Name": "Paper2D",              "Enabled": false },
        { "Name": "AndroidMoviePlayer",   "Enabled": false },
        { "Name": "AndroidPermission",    "Enabled": false }
    ]
}
```

**Plugin decision notes:**
- `GameplayAbilities` — required for GAS. Always enabled.
- `EnhancedInput` — replaces legacy input. Always enabled.
- `CommonUI` — required for activatable widget stacks and gamepad-safe buttons.
- `EOSSDKPlugin` + `OnlineSubsystemEOS` — required for EOS Ecom entitlement queries (microtransactions) even on Steam builds.
- `FunctionalTestingEditor` — enables Functional Test framework. Editor-only.
- Disabled plugins are explicit — helps UBT skip scanning them and reduces editor startup time.

**Wwise:** Wwise does not use a standard plugin entry. It generates its own `Plugins/Wwise/` folder via the Wwise Launcher integration. Do not add it manually to `.uproject`.

---

## Config/DefaultEngine.ini

```ini
[/Script/Engine.RendererSettings]
r.DefaultFeature.AutoExposure.Method=1
r.DefaultFeature.AntiAliasing=2              ; TAA — stable, works on GTX 1060
r.DefaultFeature.Bloom=True
r.DefaultFeature.AmbientOcclusion=True
r.DefaultFeature.AmbientOcclusionStaticFraction=True

; Nanite OFF for vertical slice — GTX 1060 baseline
r.Nanite=0
; Lumen OFF for vertical slice — use baked lighting
r.Lumen.Reflections=0
r.Lumen.GlobalIllumination=0

; Shadows — cascaded, fixed resolution for 1060 baseline
r.Shadow.MaxResolution=2048
r.Shadow.CSM.MaxCascades=3

; Texture streaming — conservative for 4 GB VRAM
r.Streaming.PoolSize=2000

[/Script/Engine.Engine]
+ActiveGameNameRedirects=(OldGameName="TP_FirstPerson",NewGameName="/Script/ProjectName")
+ActiveGameNameRedirects=(OldGameName="/Script/TP_FirstPerson",NewGameName="/Script/ProjectName")
bSmoothFrameRate=True
SmoothedFrameRateRange=(LowerBound=(Type=Inclusive,Value=30),UpperBound=(Type=Exclusive,Value=200))

[/Script/Engine.GarbageCollectionSettings]
gc.TimeBetweenPurgingPendingKillObjects=60
; Increase if hitching on GC — reduce if memory pressure is high

[OnlineSubsystem]
DefaultPlatformService=Steam

[OnlineSubsystemSteam]
bEnabled=True
SteamDevAppId=480
bRelaunchInSteam=False
GameServerQueryPort=27015
bAllowP2PPacketRelay=True

[/Script/Engine.StreamingSettings]
s.MinDesiredResidentMipCount=4

[CoreRedirects]
; Add class renames here when refactoring, so old save data still loads
; +ClassRedirects=(OldName="/Script/ProjectName.OldClassName",NewName="/Script/ProjectName.NewClassName")
```

---

## Config/DefaultGame.ini

```ini
[/Script/EngineSettings.GeneralProjectSettings]
ProjectName=ProjectName
CompanyName=YourStudio
CopyrightNotice=Copyright 2024 YourStudio. All Rights Reserved.
Description=First-person shooter vertical slice.
ProjectDisplayedTitle=NSLOCTEXT("ProjectName", "ProjectName", "ProjectName")
ProjectVersion=0.1.0

[/Script/Engine.GameModeBase]
; Set in level Blueprint WorldSettings or override per-map
; Default game mode registered here as fallback
+GameModeRedirects=(OldGameMode="Default",NewGameMode="/Script/ProjectName.ProjectNameGameMode")

[/Script/GameplayAbilities.AbilitySystemGlobals]
AbilitySystemGlobalsClassName=/Script/ProjectName.ProjectNameAbilitySystemGlobals
; Gameplay Cue notify paths — where to scan for cue notifiers
+GameplayCueNotifyPaths=/Game/Core/GAS/Cues

[/Script/UnrealEd.ProjectPackagingSettings]
BuildConfiguration=Shipping
bUseIoStore=True
bMakeBinaryConfig=True
bSkipEditorContent=True
BlueprintNativizationMethod=Disabled

; Chunks for streaming install (set up DLC here when ready)
; +PakFileAdditionalCompressionOptions=()
```

---

## Config/DefaultInput.ini

Enhanced Input replaces this file for game input. Keep only the minimal defaults.

```ini
[/Script/EnhancedInput.EnhancedInputSettings]
DefaultMappingContexts=

[/Script/Engine.InputSettings]
; Leave empty — all input defined in Input Action + Mapping Context assets
; Do NOT add AxisMappings or ActionMappings here for Enhanced Input projects
bEnableMouseSmoothing=False
bEnableGestureEvents=False
```

---

## Config/DefaultEditorPerProjectUserSettings.ini

Committed to track team-wide editor defaults. Individual overrides go in `Saved/Config/` (gitignored).

```ini
[/Script/UnrealEd.EditorPerProjectUserSettings]
bDisplayDocumentationLink=False
bShowActionMenuItemParent=False
bSCSEditorShowGrid=True
bSCSEditorShowFloor=True

[/Script/UnrealEd.LevelEditorViewportSettings]
bLevelStreamingVolumePrevis=False

[/Script/LevelEditor.LevelEditorPlaySettings]
PlayNetMode=PIE_Standalone
PlayNumberOfClients=1
ServerPort=17777
```

---

## Config/DefaultDeviceProfiles.ini

Set scalability defaults. GTX 1060 / PS5-equivalent maps to **High** preset.

```ini
[/Script/Engine.DeviceProfileManager]
DeviceProfiles=(Name="Windows,Type="Windows")

[Windows DeviceProfile]
+CVars=r.SceneColorFringeQuality=1
+CVars=r.BloomQuality=5
+CVars=sg.PostProcessQuality=2
+CVars=sg.ShadowQuality=2
+CVars=sg.TextureQuality=2
+CVars=sg.EffectsQuality=2
+CVars=sg.FoliageQuality=2
+CVars=sg.ShadingQuality=2

; Low-end override — for machines below GTX 1060
[Windows_Low DeviceProfile]
BaseProfileName=Windows
+CVars=r.BloomQuality=0
+CVars=sg.PostProcessQuality=0
+CVars=sg.ShadowQuality=0
+CVars=sg.TextureQuality=1
+CVars=sg.EffectsQuality=0
```

---

## Config/DefaultScalability.ini

Performance baseline: 60 FPS on GTX 1060.

```ini
[TextureQuality@2]
r.Streaming.MipBias=0
r.Streaming.PoolSize=2000
r.MaxAnisotropy=8

[ShadowQuality@2]
r.Shadow.MaxResolution=2048
r.Shadow.CSM.MaxCascades=3
r.Shadow.RadiusThreshold=0.01

[PostProcessQuality@2]
r.MotionBlurQuality=2
r.AmbientOcclusionMipLevelFactor=0.4
r.AmbientOcclusionMaxQuality=100
r.BloomQuality=4

[EffectsQuality@2]
r.SSR.Quality=2
r.DepthOfFieldQuality=2
fx.Niagara.QualityLevel=2
```

---

## Config/DefaultCryptographySettings.ini

Required for encrypted save files (see [save-load.md](save-load.md)):

```ini
[/Script/Crypto.CryptoKeysSettings]
bEncryptPakIniFiles=True
bEncryptAllAssetFiles=True
bEncryptIndex=True
; Generated AES key — unique per project, stored in Saved/ (gitignored)
; project-scaffolder runs `GenerateCryptoKeys` once at setup
EncryptionKey=(Key="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX==")
```

The key is auto-generated by `project-scaffolder`. Never commit it. The `.gitignore` entry for `Saved/` covers `Saved/Cooked/` and `Saved/StagedBuilds/` — but the crypto key lives in `Config/` by default. Move it:

```ini
; Config/DefaultCryptographySettings.ini — point to external key file
[/Script/Crypto.CryptoKeysSettings]
EncryptionKeyFilePath="{PROJECT_DIR}/Secrets/ProjectName.aes"
```

Add `Secrets/` to `.gitignore`. Store the key in your CI secrets manager and inject at build time.

---

## .gitignore Additions (UE5-specific)

```
# Build artifacts
Binaries/
Build/
DerivedDataCache/
Intermediate/
Saved/
.vs/
.vscode/
*.opensdf
*.sdf
*.suo
*.user

# Cooked content
*.uasset filter=lfs     ← handled by .gitattributes, not .gitignore
Saved/Cooked/
Saved/StagedBuilds/
Saved/Logs/

# Wwise
AkAudio/

# Secrets
Secrets/
Config/DefaultCryptographySettings.ini   ← if key is inline
```

Commit: `Config/`, `Content/`, `Source/`, `Plugins/`, `.uproject`, `.gitattributes`.

---

## Key Rules

1. **`EngineAssociation` pinned to `"5.7"`** — prevents accidental engine upgrades that break the team.
2. **Disabled plugins listed explicitly** — UBT skips them, reducing compile time and Editor startup.
3. **Nanite and Lumen off by default** — GTX 1060 baseline. Re-evaluate post-vertical-slice.
4. **`r.DefaultFeature.AntiAliasing=2` (TAA)** — stable on all target hardware. DLSS/TSR requires higher-end hardware.
5. **No legacy `AxisMappings` / `ActionMappings` in DefaultInput.ini** — Enhanced Input project, everything in IA + IMC assets.
6. **Crypto key never in the repo** — `Secrets/` is gitignored; key injected from CI secrets at build time.
7. **`ProjectVersion`** in DefaultGame.ini — bump on every release candidate to match the Steam build description.
