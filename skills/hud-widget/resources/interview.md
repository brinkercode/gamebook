# HUD Widget — Scoping Questions

1. **What is the widget name and what data does it display?** (e.g., "HealthBar — displays current and max health as a progress bar")
2. **What GAS attribute or game state drives this widget?** (e.g., `UPlayerAttributeSet::Health`, weapon `CurrentAmmo`, ability cooldown remaining)
3. **Does the widget animate on value change?** (e.g., health bar flashes red on damage, cooldown ring spins down — yes adds animator node and anim Blueprint setup)
4. **Where does it appear on screen?** (Corner position, center, or anchored to a specific game element — affects anchor setup in UMG)
