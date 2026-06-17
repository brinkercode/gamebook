# UDA_WeaponData — Data Asset

## Header: `Source/<Project>/Weapons/DA_WeaponData.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayEffect.h"
#include "DA_WeaponData.generated.h"

UCLASS(BlueprintType)
class MYGAME_API UDA_WeaponData : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    // Identity
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FGameplayTag WeaponTag; // e.g. Weapon.Rifle.Assault

    // Fire behaviour
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat")
    bool bIsHitscan = true;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat",
              meta=(ClampMin="0.1", ClampMax="20.0"))
    float FireRate = 8.0f; // rounds per second

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat",
              meta=(ClampMin="1.0"))
    float Damage = 25.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat")
    float MaxRange = 5000.0f; // Unreal units (~50 m)

    // Ammo
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ammo")
    int32 MagazineSize = 30;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ammo")
    float ReloadTime = 2.0f; // seconds

    // Recoil
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Recoil")
    TObjectPtr<UCurveFloat> RecoilPitchCurve; // X = shot number, Y = pitch delta degrees

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Recoil")
    float RecoilRecoverySpeed = 3.0f; // degrees/sec return to baseline

    // GAS effects (assign in editor)
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    TSubclassOf<UGameplayEffect> AmmoCostEffect;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    TSubclassOf<UGameplayEffect> FireRateCooldownEffect;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    TSubclassOf<UGameplayEffect> DamageEffect;

    // Mesh and VFX
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Visuals")
    TSoftObjectPtr<USkeletalMesh> WeaponMesh;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Visuals")
    TSoftObjectPtr<UNiagaraSystem> MuzzleFlashNS; // NS_ prefix

    // Audio
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Audio")
    FName WwiseFireEventName; // e.g. "Play_Weapon_Rifle_Fire_01"

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Audio")
    FName WwiseDryFireEventName;

    // PrimaryDataAsset type tag
    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId("WeaponData", GetFName());
    }
};
```

## Example Values

| Field | Pistol | Assault Rifle | Shotgun |
|---|---|---|---|
| FireRate | 3.0 | 8.0 | 1.2 |
| Damage | 35.0 | 25.0 | 15.0 × 8 pellets |
| MagazineSize | 15 | 30 | 8 |
| MaxRange | 2000.0 | 5000.0 | 800.0 |
| ReloadTime | 1.5 | 2.0 | 3.0 |
| bIsHitscan | true | true | true (multi-trace) |

## Asset Registration (`DefaultGame.ini`)

```ini
[/Script/Engine.AssetManagerSettings]
+PrimaryAssetTypesToScan=(PrimaryAssetType="WeaponData",
  AssetBaseClass="/Script/<Project>.DA_WeaponData",
  bHasBlueprintClasses=False,
  bIsEditorOnly=False,
  Directories=((Path="/Game/Data/Weapons")),
  Rules=(Priority=0,ChunkId=-1,bApplyRecursively=True,CookRule=AlwaysCook))
```
