# AEnemyAIController — C++ Implementation

## Header: `Source/<Project>/AI/EnemyAIController.h`

```cpp
#pragma once
#include "CoreMinimal.h"
#include "AIController.h"
#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Sight.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "EnemyAIController.generated.h"

UCLASS()
class MYGAME_API AEnemyAIController : public AAIController
{
    GENERATED_BODY()

public:
    AEnemyAIController();

    virtual void OnPossess(APawn* InPawn) override;
    virtual void OnUnPossess() override;

protected:
    UPROPERTY(VisibleAnywhere, Category="AI|Perception")
    TObjectPtr<UAIPerceptionComponent> AIPerceptionComp;

    UPROPERTY(EditDefaultsOnly, Category="AI|BehaviorTree")
    TObjectPtr<UBehaviorTree> BehaviorTree;

    // Blackboard key names — match keys in BB_Enemy
    static const FName BBKey_TargetActor;
    static const FName BBKey_PatrolTarget;
    static const FName BBKey_AIState;        // int32: 0=Idle, 1=Alert, 2=Combat
    static const FName BBKey_LastKnownLocation;
    static const FName BBKey_CoverLocation;

private:
    UFUNCTION()
    void OnTargetPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus);

    void SetAIState(int32 NewState);
};
```

## Implementation: `Source/<Project>/AI/EnemyAIController.cpp`

```cpp
#include "EnemyAIController.h"
#include "BehaviorTree/BehaviorTreeComponent.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "Perception/AIPerceptionSystem.h"
#include "GameFramework/Character.h"

const FName AEnemyAIController::BBKey_TargetActor       = TEXT("TargetActor");
const FName AEnemyAIController::BBKey_PatrolTarget      = TEXT("PatrolTarget");
const FName AEnemyAIController::BBKey_AIState           = TEXT("AIState");
const FName AEnemyAIController::BBKey_LastKnownLocation = TEXT("LastKnownLocation");
const FName AEnemyAIController::BBKey_CoverLocation     = TEXT("CoverLocation");

AEnemyAIController::AEnemyAIController()
{
    // Perception component
    AIPerceptionComp = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("AIPerception"));
    SetPerceptionComponent(*AIPerceptionComp);

    // Sight config
    UAISenseConfig_Sight* SightConfig = CreateDefaultSubobject<UAISenseConfig_Sight>(TEXT("SightConfig"));
    SightConfig->SightRadius            = 2000.f;
    SightConfig->LoseSightRadius        = 2500.f;
    SightConfig->PeripheralVisionAngleDegrees = 60.f;
    SightConfig->SetMaxAge(5.f);
    SightConfig->DetectionByAffiliation.bDetectEnemies   = true;
    SightConfig->DetectionByAffiliation.bDetectNeutrals  = false;
    SightConfig->DetectionByAffiliation.bDetectFriendlies = false;
    AIPerceptionComp->ConfigureSense(*SightConfig);

    // Hearing config
    UAISenseConfig_Hearing* HearingConfig =
        CreateDefaultSubobject<UAISenseConfig_Hearing>(TEXT("HearingConfig"));
    HearingConfig->HearingRange = 1500.f;
    HearingConfig->SetMaxAge(3.f);
    HearingConfig->DetectionByAffiliation.bDetectEnemies = true;
    AIPerceptionComp->ConfigureSense(*HearingConfig);

    AIPerceptionComp->SetDominantSense(SightConfig->GetSenseImplementation());
    AIPerceptionComp->OnTargetPerceptionUpdated.AddDynamic(
        this, &AEnemyAIController::OnTargetPerceptionUpdated);
}

void AEnemyAIController::OnPossess(APawn* InPawn)
{
    Super::OnPossess(InPawn);

    if (BehaviorTree)
    {
        RunBehaviorTree(BehaviorTree);
        GetBlackboardComponent()->SetValueAsInt(BBKey_AIState, 0); // Idle
    }
}

void AEnemyAIController::OnUnPossess()
{
    Super::OnUnPossess();
    if (UBehaviorTreeComponent* BTC = Cast<UBehaviorTreeComponent>(BrainComponent))
    {
        BTC->StopTree(EBTStopMode::Safe);
    }
}

void AEnemyAIController::OnTargetPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus)
{
    if (!GetBlackboardComponent()) return;

    if (Stimulus.WasSuccessfullySensed())
    {
        GetBlackboardComponent()->SetValueAsObject(BBKey_TargetActor, Actor);
        GetBlackboardComponent()->SetValueAsVector(BBKey_LastKnownLocation,
            Actor->GetActorLocation());
        SetAIState(2); // Combat
    }
    else
    {
        // Lost sight — store last known location, go Alert
        GetBlackboardComponent()->SetValueAsObject(BBKey_TargetActor, nullptr);
        SetAIState(1); // Alert
    }
}

void AEnemyAIController::SetAIState(int32 NewState)
{
    if (UBlackboardComponent* BB = GetBlackboardComponent())
    {
        BB->SetValueAsInt(BBKey_AIState, NewState);
    }
}
```
