# Target Platform Interview — Question Bank

---

## Section 1: Platform Targets

1. **Which platforms are in scope for the vertical slice launch?**
   - PC (Windows — Steam, EOS, or both)
   - PC (Linux — Steam Proton compatibility only, or native Linux build)
   - PS5
   - Xbox Series X/S
   - Nintendo Switch (note: significant porting effort; exclude from vertical slice unless already planned)
   - Mobile (iOS/Android — exclude unless explicitly planned; UE5 FPS on mobile is non-trivial)
2. **Which platforms are in scope for the full release?** (May be larger than vertical slice scope)
3. **Is there a platform exclusivity deal or timed exclusive?** (Affects store configuration and build target priority)

---

## Section 2: Minimum Hardware Specification

4. **PC minimum spec confirmation:** The default locked spec is GTX 1060 6GB / Ryzen 5 1600 / 16GB RAM / Windows 10 64-bit at 1080p 60 FPS with medium quality preset. Confirm this is correct or state the target change and why.
5. **PC recommended spec:** (GTX 1080 Ti / Ryzen 7 3700X / 16GB RAM / Windows 10 or 11 — confirm or adjust)
6. **Console target framerate:** 60 FPS locked or 30 FPS? (60 FPS is locked in the project defaults — confirm)
7. **Resolution strategy on console:**
   - Native 1080p / 1440p / 4K
   - Dynamic resolution scaling (recommended — TSR or DLSS if RTX target)
   - Fixed resolution

---

## Section 3: Input Paradigm

8. **Controller-first or KBM-first?**
   - Controller-first: gamepad feel is the primary design target; KBM is secondary support.
   - KBM-first: mouse + keyboard are primary; gamepad is secondary support.
   - Equal priority (requires more QA — both control schemes must feel polished).
9. **Which controllers must be explicitly supported?**
   - Xbox controller (XInput) — default on Windows
   - PS5 DualSense (including adaptive triggers and haptics)
   - PS4 DualShock 4
   - Nintendo Switch Pro Controller
   - Steam Deck (Deck-verified checklist applies)
10. **Are there any platform-specific input features to use?**
    - DualSense adaptive triggers (resistance on weapon fire)
    - DualSense haptics (hit feedback, footstep texture)
    - Steam Deck gyroscope (optional aiming assist)
11. **Is there a Steam Deck verified / playable target?** (Affects UI scale, minimum touch target size, default graphics preset, and controller glyph set)

---

## Section 4: Accessibility

12. **What accessibility features are required for the vertical slice?**
    - Subtitles / closed captions for all voiced audio
    - Colorblind modes (Deuteranopia, Protanopia, Tritanopia — post-process LUT swaps)
    - Controller remapping (Enhanced Input supports this natively via `UEnhancedInputUserSettings`)
    - HUD scaling (UI scale slider in settings)
    - Field of view slider (60°–110°)
    - Motion sickness reduction options (reduce camera bob, vignette on sprint)
13. **Are there any platform certification accessibility requirements?** (PlayStation: some accessibility features required for certification — confirm which apply)

---

## Section 5: Store and Distribution

14. **Steam App ID:** (Create via Steamworks Partner — needed for SteamMicroTxn, DRM, and depot config)
15. **EOS Product ID / Sandbox / Deployment:** (Create via dev.epicgames.com — needed for EOS SDK init)
16. **Will the game use Steam DRM (Steamworks DRM)?** (Recommended for paid games; not needed for free-to-play with server-auth)
17. **Early Access or full launch?** (Early Access: must ship a playable loop even if incomplete; changes store page requirements)
18. **What is the target launch region?** (Global / specific regions — affects age rating requirements per region and loot-box law exposure)
