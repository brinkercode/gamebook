# Platform Decisions → UE5 Configuration

---

## Build Targets (`Source/<Project>.Target.cs`)

```csharp
// <Project>.Target.cs — game
public class MyGameTarget : TargetRules
{
    public MyGameTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        // Add per-platform overrides below
    }
}

// <Project>Server.Target.cs — dedicated server (if multiplayer)
public class MyGameServerTarget : TargetRules
{
    public MyGameServerTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Server;
        DefaultBuildSettings = BuildSettingsVersion.V4;
    }
}
```

---

## `DefaultEngine.ini` Platform Sections

### PC Windows (minimum spec)

```ini
[/Script/Engine.RendererSettings]
r.DefaultFeature.AntiAliasing=4          ; TAA
r.DefaultFeature.AutoExposure=True
r.DynamicGlobalIlluminationMethod=0      ; Baked (off by default)
r.ReflectionMethod=0                     ; Baked reflections

[SystemSettings]
r.Shadow.MaxResolution=1024
r.ShadowQuality=2
r.PostProcessAAQuality=4
```

### PS5 / Xbox (console targets)

```ini
[PS5 DeviceProfiles]
+CVars=r.LandscapeLODBias=0
+CVars=r.Shadow.MaxResolution=2048
+CVars=r.DynamicRes.OperationMode=1     ; Dynamic resolution enabled on console
```

### Steam Deck

```ini
[SteamDeck DeviceProfile]
+CVars=r.Shadow.MaxResolution=512
+CVars=r.PostProcessAAQuality=2
+CVars=sg.ShadowQuality=1
```

---

## Enhanced Input — Input Mapping Context Priority

KBM-first project:
```
IMC_KBM (priority 100) — loaded at game start
IMC_Gamepad (priority 50) — loaded at game start, lower priority
IMC_UI (priority 200) — pushed on menu open
```

Controller-first project:
```
IMC_Gamepad (priority 100) — loaded at game start
IMC_KBM (priority 50) — loaded at game start, lower priority
IMC_UI (priority 200) — pushed on menu open
```

Switch active IMC on input device change:
```cpp
void AMyPlayerController::OnInputDeviceChanged(ECommonInputType NewType)
{
    UEnhancedInputLocalPlayerSubsystem* Subsystem =
        ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer());
    if (NewType == ECommonInputType::Gamepad)
    {
        Subsystem->AddMappingContext(IMC_Gamepad, 100);
        Subsystem->RemoveMappingContext(IMC_KBM);
    }
    else
    {
        Subsystem->AddMappingContext(IMC_KBM, 100);
        Subsystem->RemoveMappingContext(IMC_Gamepad);
    }
}
```

---

## Steam Depot Configuration (`steam_build.vdf`)

```
"AppBuild"
{
    "AppID" "{{ STEAM_APP_ID }}"
    "Desc" "Vertical Slice Build"
    "BuildOutput" "../../build/steam/"
    "Depots"
    {
        "{{ DEPOT_ID_WIN }}"
        {
            "FileMapping" { "LocalPath" "WindowsNoEditor/*" "DepotPath" "." "recursive" "1" }
        }
    }
}
```

---

## EOS SDK Initialization (`DefaultEngine.ini`)

```ini
[OnlineSubsystem]
DefaultPlatformService=EOS

[OnlineSubsystemEOS]
bEnabled=true
ProductId={{ EOS_PRODUCT_ID }}
SandboxId={{ EOS_SANDBOX_ID }}
DeploymentId={{ EOS_DEPLOYMENT_ID }}
ClientCredentialsId={{ EOS_CLIENT_ID }}
ClientCredentialsSecret={{ EOS_CLIENT_SECRET }}
```

Store all EOS credentials in environment variables; never commit secrets to git.

---

## Steam Deck Verified Checklist

- [ ] All UI navigable with gamepad only (no mouse required)
- [ ] All text readable at 720p on 7-inch display (minimum 16pt font)
- [ ] Correct controller glyphs shown (UE5 `UCommonUILibrary::GetInputTypeFromController`)
- [ ] Default graphics preset runs at 60 FPS on Steam Deck hardware
- [ ] No mandatory keyboard input (no text fields required to progress)
- [ ] Game exits cleanly from Steam Deck power menu
