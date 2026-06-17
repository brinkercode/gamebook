# Weapon Class — Scoping Questions

Ask before writing any code.

1. **What is the weapon name and category?** (e.g., "AssaultRifle", "Shotgun", "SniperRifle", "Pistol", "Melee")
2. **Hitscan or projectile?**
   - Hitscan: instant line trace; no travel time; correct for most firearms at typical FPS engagement distances
   - Projectile: spawns a `BP_Projectile` actor with velocity; required for grenades, rockets, slow-moving plasma bolts
3. **What are the target fire rate, magazine size, and damage values?** (First pass — these go into the data asset, not hardcoded)
4. **Does this weapon have an alternate fire mode?** (ADS scope zoom, burst mode, grenade launcher underbarrel — yes escalates scope)
