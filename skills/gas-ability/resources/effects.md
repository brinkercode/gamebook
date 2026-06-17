# GAS Cost and Cooldown Effects

---

## GE_<Name>_Cost

`Content/GAS/Effects/GE_<Name>_Cost.uasset`

| Property | Value |
|---|---|
| Duration Policy | Instant |
| Modifier Attribute | `UPlayerAttributeSet.<ResourceAttribute>` (e.g., Stamina) |
| Modifier Op | Add |
| Magnitude Type | Set By Caller |
| Set By Caller Tag | `SetByCaller.Cost.<Name>` |

Set the cost at grant time:

```cpp
FGameplayAbilitySpec Spec(UGA_<Name>::StaticClass(), 1, INDEX_NONE, this);
Spec.SetByCallerTagMagnitudes.Add(
    FGameplayTag::RequestGameplayTag(FName("SetByCaller.Cost.<Name>")),
    -25.0f);  // negative = costs 25 stamina
AbilitySystemComponent->GiveAbility(Spec);
```

Or set cost at commit time (variable costs):

```cpp
// In ActivateAbility before CommitAbility
FGameplayEffectSpecHandle CostSpec = MakeOutgoingGameplayEffectSpec(CostGameplayEffectClass);
CostSpec.Data->SetSetByCallerMagnitude(
    FGameplayTag::RequestGameplayTag(FName("SetByCaller.Cost.<Name>")),
    -ComputedCostValue);
```

---

## GE_<Name>_Cooldown

`Content/GAS/Effects/GE_<Name>_Cooldown.uasset`

| Property | Value |
|---|---|
| Duration Policy | Has Duration |
| Duration Magnitude | Set By Caller: `SetByCaller.Cooldown.<Name>` |
| Granted Tags (Gameplay Effect Asset Tags) | `Cooldown.<Name>` |

The cooldown tag blocks re-activation (add `Cooldown.<Name>` to `ActivationBlockedTags` on the ability, or rely on `CommitAbility` cooldown check — both work).

Set duration at grant time:

```cpp
Spec.SetByCallerTagMagnitudes.Add(
    FGameplayTag::RequestGameplayTag(FName("SetByCaller.Cooldown.<Name>")),
    5.0f);  // 5 second cooldown
```

Query remaining cooldown for HUD:

```cpp
float Remaining, Total;
AbilitySystemComponent->GetCooldownGameplayEffectDuration(
    AbilitySystemComponent->FindAbilitySpecFromClass(UGA_<Name>::StaticClass())->GetAbilitySpecDef(),
    Remaining, Total);
```

---

## ScalableFloat with Curve Table (for level-scaling)

If cooldown or cost should scale with ability level, use a `FScalableFloat` referencing a `UCurveTable`:

1. Create `Content/Data/GAS/CT_AbilityScaling.uasset` (CurveTable, interpolation type: Constant)
2. Add row `GA_<Name>.Cooldown` with key = ability level (1, 2, 3...), value = cooldown seconds
3. In the GE: Duration Magnitude Type = Scalable Float; point to `CT_AbilityScaling`, row `GA_<Name>.Cooldown`

The ability level is the second argument to `GiveAbility` spec.
