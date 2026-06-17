# Gameplay Tags — Standard Taxonomy

Add to `Config/DefaultGameplayTags.ini`:

```ini
[/Script/GameplayTags.GameplayTagsSettings]
; State tags
+GameplayTagList=(Tag="State.Alive",DevComment="Pawn is alive and able to act")
+GameplayTagList=(Tag="State.Dead",DevComment="Pawn is dead")
+GameplayTagList=(Tag="State.Stunned",DevComment="Pawn cannot activate abilities")
+GameplayTagList=(Tag="State.Sprinting",DevComment="Pawn is sprinting")
+GameplayTagList=(Tag="State.ADS",DevComment="Pawn is aiming down sights")

; Ability active tags (granted while ability is running)
+GameplayTagList=(Tag="Ability.Sprint.Active",DevComment="")
+GameplayTagList=(Tag="Ability.ThrowGrenade.Active",DevComment="")
+GameplayTagList=(Tag="Ability.Dash.Active",DevComment="")
+GameplayTagList=(Tag="Ability.Reload.Active",DevComment="")

; Cooldown tags (granted by cooldown GEs)
+GameplayTagList=(Tag="Cooldown.Weapon.Fire",DevComment="Weapon fire rate lock")
+GameplayTagList=(Tag="Cooldown.Ability.Sprint",DevComment="")
+GameplayTagList=(Tag="Cooldown.Ability.ThrowGrenade",DevComment="")
+GameplayTagList=(Tag="Cooldown.Ability.Dash",DevComment="")

; Set By Caller tags (used as magnitude keys)
+GameplayTagList=(Tag="SetByCaller.Damage",DevComment="")
+GameplayTagList=(Tag="SetByCaller.Heal",DevComment="")
+GameplayTagList=(Tag="SetByCaller.Cooldown.FireRate",DevComment="")
+GameplayTagList=(Tag="SetByCaller.Cost.Stamina",DevComment="")
+GameplayTagList=(Tag="SetByCaller.Cost.Ammo",DevComment="")

; Event tags (fired via SendGameplayEventToActor)
+GameplayTagList=(Tag="GameplayEvent.HitReact",DevComment="")
+GameplayTagList=(Tag="GameplayEvent.Reload.Complete",DevComment="")
+GameplayTagList=(Tag="GameplayEvent.GrenadeThrown",DevComment="")

; Damage type tags
+GameplayTagList=(Tag="DamageType.Bullet",DevComment="")
+GameplayTagList=(Tag="DamageType.Explosive",DevComment="")
+GameplayTagList=(Tag="DamageType.Fire",DevComment="")
+GameplayTagList=(Tag="DamageType.Melee",DevComment="")

; Cosmetic tags (no gameplay impact)
+GameplayTagList=(Tag="Cosmetic.Skin.Character",DevComment="")
+GameplayTagList=(Tag="Cosmetic.Skin.Weapon",DevComment="")
+GameplayTagList=(Tag="Cosmetic.Emote",DevComment="")
```

## Tag Naming Rules

- All tags lowercase, dot-separated hierarchy
- Parent tag implies child: `State` is not a valid state; `State.Alive` is
- Never use a parent tag as a leaf tag — keep hierarchy clean
- New ability adds three tags minimum: `Ability.<Name>.Active`, `Cooldown.Ability.<Name>`, `SetByCaller.Cost.<AttributeName>`
