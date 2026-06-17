# Weapon GAS Integration

## GE_WeaponCost_Ammo

Create in `Content/GAS/Effects/GE_WeaponCost_Ammo.uasset`:

- **Duration Policy:** Instant
- **Modifiers:**
  - Attribute: `UPlayerAttributeSet.Ammo`
  - Modifier Op: Add
  - Magnitude Calculation Type: Scalable Float
  - Scalable Float Magnitude: `-1.0`

The weapon data asset `AmmoCostEffect` field points to this effect. Each `Fire()` call applies it once, decrementing the GAS Ammo attribute by 1. The GAS attribute is the authoritative ammo count (not the `CurrentAmmo` int32 on `UWeaponBase` — keep them in sync via `OnRep_Ammo`).

## GE_WeaponCooldown_FireRate

Create in `Content/GAS/Effects/GE_WeaponCooldown_FireRate.uasset`:

- **Duration Policy:** Has Duration
- **Duration Magnitude:** Scalable Float `= 1.0 / WeaponData->FireRate` (set dynamically — see below)
- **Granted Tags (while active):** `Cooldown.Weapon.Fire`

Because duration must be set per-weapon, compute it dynamically:

```cpp
// In UWeaponBase::ApplyFireEffects()
if (WeaponData->FireRateCooldownEffect && OwnerASC)
{
    FGameplayEffectContextHandle Context = OwnerASC->MakeEffectContext();
    FGameplayEffectSpecHandle Spec =
        OwnerASC->MakeOutgoingSpec(WeaponData->FireRateCooldownEffect, 1.f, Context);

    // Set the cooldown duration to 1/FireRate seconds
    Spec.Data->SetSetByCallerMagnitude(
        FGameplayTag::RequestGameplayTag(FName("SetByCaller.Cooldown.FireRate")),
        1.0f / WeaponData->FireRate);

    OwnerASC->ApplyGameplayEffectSpecToSelf(*Spec.Data.Get());
}
```

In `GE_WeaponCooldown_FireRate`, set Duration source to `Set By Caller` with tag `SetByCaller.Cooldown.FireRate`.

## GE_WeaponDamage

Created per weapon or shared with magnitude driven by `UDA_WeaponData.Damage`:

- **Duration Policy:** Instant
- **Target:** the hit actor's ASC (applied via `ApplyGameplayEffectSpecToTarget`)
- **Modifiers:**
  - Attribute: `UEnemyAttributeSet.Health`
  - Modifier Op: Add
  - Magnitude: SetByCaller `SetByCaller.Damage`

```cpp
// In UWeaponBase::PerformHitscan(), after hit confirmed:
FGameplayEffectContextHandle DamageContext = OwnerASC->MakeEffectContext();
DamageContext.AddHitResult(HitResult);
FGameplayEffectSpecHandle DamageSpec =
    OwnerASC->MakeOutgoingSpec(WeaponData->DamageEffect, 1.f, DamageContext);
DamageSpec.Data->SetSetByCallerMagnitude(
    FGameplayTag::RequestGameplayTag(FName("SetByCaller.Damage")),
    -WeaponData->Damage);  // negative = damage

UAbilitySystemBlueprintLibrary::ApplyGameplayEffectSpecToTarget(
    DamageSpec, TargetASC);
```

## Ammo Attribute on UPlayerAttributeSet

```cpp
// In UPlayerAttributeSet.h
UPROPERTY(BlueprintReadOnly, Category="Ammo", ReplicatedUsing=OnRep_Ammo)
FGameplayAttributeData Ammo;
ATTRIBUTE_ACCESSORS(UPlayerAttributeSet, Ammo)

UPROPERTY(BlueprintReadOnly, Category="Ammo", ReplicatedUsing=OnRep_MaxAmmo)
FGameplayAttributeData MaxAmmo;
ATTRIBUTE_ACCESSORS(UPlayerAttributeSet, MaxAmmo)

UFUNCTION()
void OnRep_Ammo(const FGameplayAttributeData& OldAmmo);
```

`UWeaponBase::BeginPlay()` reads the initial ammo from the ASC attribute, not from `MagazineSize` directly, so GAS is always authoritative.
