# Enemy AI — Scoping Questions

1. **What is the enemy archetype name and role?** (e.g., "PatrolGuard", "HeavyGunner", "SniperElite", "Swarmer")
2. **What is the primary combat behavior?**
   - Patrol → Alert → Combat → Retreat to cover
   - Patrol → Alert → Charge melee
   - Stationary sentry → Alert on sight → Call for reinforcements
   - Other — describe
3. **Does this enemy use GAS abilities?** (If yes: which abilities? A GAS ability on an enemy requires `UAbilitySystemComponent` on the pawn and a separate `UEnemyAttributeSet`. Flag as additional scope.)
4. **What is the enemy's health and damage budget?** (First pass numbers — go into `DA_Enemy_<Name>` data asset)
