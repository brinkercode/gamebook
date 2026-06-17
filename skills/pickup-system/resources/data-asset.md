# UDA_PickupData

```cpp
// DA_PickupData.h
#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayEffect.h"
#include "GameplayTagContainer.h"
#include "DA_PickupData.generated.h"

UENUM(BlueprintType)
enum class EPickupType : uint8
{
    Health       UMETA(DisplayName="Health"),
    Ammo         UMETA(DisplayName="Ammo"),
    Weapon       UMETA(DisplayName="Weapon"),
    AudioLog     UMETA(DisplayName="Audio Log"),
    Cosmetic     UMETA(DisplayName="Cosmetic"),
    Collectible  UMETA(DisplayName="Collectible"),
};

UCLASS(BlueprintType)
class MYGAME_API UDA_PickupData : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    FText PickupPrompt; // shown in WB_InteractionPrompt

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Identity")
    EPickupType PickupType = EPickupType::Health;

    // GAS effect applied to player on pickup (heals, restores ammo, grants buff, etc.)
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    TSubclassOf<UGameplayEffect> PickupEffect;

    // Optional: tag required on player to pick this up (e.g., must have Weapon.Rifle equipped for ammo)
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    FGameplayTag RequiredTag;

    // If this pickup should block if the target attribute is already full
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    bool bBlockIfFull = true;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS")
    FGameplayAttribute FullCheckAttribute; // the attribute to check for "full"

    // Respawn
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Respawn")
    float RespawnDelay = 0.0f; // 0 = no respawn (single-use)

    // Visuals
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Visuals")
    TSoftObjectPtr<UStaticMesh> PickupMesh;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Visuals")
    TSoftObjectPtr<UNiagaraSystem> IdleVFX; // NS_ prefix idle loop

    // Audio
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Audio")
    FName WwisePickupEventName; // e.g. "Play_Pickup_Health"

    virtual FPrimaryAssetId GetPrimaryAssetId() const override
    {
        return FPrimaryAssetId("PickupData", GetFName());
    }
};
```

## Example Data Asset Values

| Pickup | PickupType | Effect | RespawnDelay | Prompt |
|---|---|---|---|---|
| `DA_Pickup_HealthSmall` | Health | `GE_Pickup_HealSmall` (+25 HP) | 30.0s | "Pick Up Health Pack" |
| `DA_Pickup_AmmoPistol` | Ammo | `GE_Pickup_AmmoPistol` (+15 ammo) | 20.0s | "Pick Up Pistol Ammo" |
| `DA_Pickup_AudioLog_01` | AudioLog | None | 0.0s | "Listen to Audio Log" |
