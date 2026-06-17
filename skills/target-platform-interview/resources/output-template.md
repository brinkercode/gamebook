# TARGET_PLATFORM.md — Template

---

# Target Platform: {{ Project Name }}

## Platform Targets

**Vertical slice:** {{ Windows PC / PS5 / Xbox Series X|S / Steam Deck }}

**Full release (planned):** {{ list }}

**Exclusivity:** {{ None / {{ platform }} timed exclusive through {{ date }} }}

## Hardware Specification

### PC

| | Minimum | Recommended |
|---|---|---|
| GPU | GTX 1060 6GB | GTX 1080 Ti / RTX 2070 |
| CPU | Ryzen 5 1600 | Ryzen 7 3700X |
| RAM | 16 GB | 16 GB |
| OS | Windows 10 64-bit | Windows 10/11 64-bit |
| Storage | {{ GB }} | {{ GB }} SSD |
| Resolution/FPS | 1080p / 60 FPS | 1440p / 60 FPS |

### Console

**Target FPS:** 60 FPS locked

**Resolution strategy:** {{ Native {{ n }}p / Dynamic resolution scaling (TSR) }}

## Input Paradigm

**Primary:** {{ Controller / KBM }}

**Supported controllers:** {{ Xbox XInput / PS5 DualSense / PS4 DualShock 4 / Switch Pro }}

**Platform-specific input features:** {{ DualSense adaptive triggers / haptics / Steam Deck gyro / None }}

**Steam Deck:** {{ Verified target / Playable target / Not targeted }}

## Accessibility

**Required for vertical slice:**

- [ ] Subtitles / closed captions
- [ ] Colorblind modes ({{ Deuteranopia / Protanopia / Tritanopia }})
- [ ] Controller remapping (UEnhancedInputUserSettings)
- [ ] HUD scale slider
- [ ] FoV slider ({{ min }}°–{{ max }}°)
- [ ] Motion sickness reduction options

## Store and Distribution

**Steam App ID:** {{ APP_ID }} (Steamworks Partner)

**EOS Product ID:** {{ PRODUCT_ID }} (dev.epicgames.com)

**Steam DRM:** {{ Yes / No }}

**Launch type:** {{ Full launch / Early Access }}

**Target regions:** {{ Global / list specific regions }}

**Age rating required:** {{ ESRB {{ rating }} / PEGI {{ rating }} / both }}

## Build Targets

```
Source/<Project>.Target.cs         — Game (Win64, PS5, XboxOneGDK)
Source/<Project>Editor.Target.cs   — Editor (Win64 only)
Source/<Project>Server.Target.cs   — Dedicated server ({{ Yes / No }})
```

## Configuration Notes

{{ Notes from config-mapping.md: platform ini sections, Enhanced Input priority, depot config }}
