# UDA_Cosmetic — Cosmetic Data Asset

```cpp
// DA_Cosmetic.h
#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "DA_Cosmetic.generated.h"

UENUM(BlueprintType)
enum class ECosmeticRarity : uint8
{
    Common    UMETA(DisplayName="Common"),
    Rare      UMETA(DisplayName="Rare"),
    Epic      UMETA(DisplayName="Epic"),
    Legendary UMETA(DisplayName="Legendary"),
};

UCLASS(BlueprintType)
class MYGAME_API UDA_Cosmetic : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    // Identity
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FString ItemID; // unique, stable string — used as key in OwnedCosmeticIDs

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FText Description;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    ECosmeticRarity Rarity = ECosmeticRarity::Common;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FGameplayTag CosmeticCategory; // Cosmetic.Skin.Character, Cosmetic.Skin.Weapon, etc.

    // Store
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Store")
    int32 PriceHardCurrency = 0; // 0 = not for sale (earned only)

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Store")
    int32 PriceSoftCurrency = 0; // 0 = not available for soft currency

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Store")
    bool bIsLimitedTime = false;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Store")
    TSoftObjectPtr<UTexture2D> StorePreviewImage; // shown in WB_StoreItemTile

    // Visual application
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Visuals")
    TSoftObjectPtr<USkeletalMesh> CharacterMesh; // for character skin variants

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Visuals")
    TSoftObjectPtr<UMaterialInterface> WeaponMaterial; // for weapon skin variants

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Visuals")
    TSoftObjectPtr<UAnimMontage> EmoteMontage; // for emote cosmetics

    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId("Cosmetic", FName(*ItemID));
    }
};
```

## Applying a Cosmetic

```cpp
// In AMyCharacter::ApplyCosmetic
void AMyCharacter::ApplyCosmetic(UDA_Cosmetic* Cosmetic)
{
    if (!Cosmetic) return;

    if (Cosmetic->CosmeticCategory.MatchesTag(
            FGameplayTag::RequestGameplayTag("Cosmetic.Skin.Character")))
    {
        if (USkeletalMesh* Mesh = Cosmetic->CharacterMesh.LoadSynchronous())
        {
            GetMesh()->SetSkeletalMesh(Mesh);
        }
    }
    else if (Cosmetic->CosmeticCategory.MatchesTag(
             FGameplayTag::RequestGameplayTag("Cosmetic.Skin.Weapon")))
    {
        if (UMaterialInterface* Mat = Cosmetic->WeaponMaterial.LoadSynchronous())
        {
            WeaponComponent->GetWeaponMesh()->SetMaterial(0, Mat);
        }
    }
}
```

## Asset Registration (`DefaultGame.ini`)

```ini
+PrimaryAssetTypesToScan=(PrimaryAssetType="Cosmetic",
  AssetBaseClass="/Script/<Project>.DA_Cosmetic",
  bHasBlueprintClasses=False,
  Directories=((Path="/Game/Data/Store")),
  Rules=(Priority=0,CookRule=AlwaysCook))
```
