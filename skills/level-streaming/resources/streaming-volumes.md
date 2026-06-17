# ALevelStreamingVolume — Placement and Configuration

## What it does

`ALevelStreamingVolume` automatically triggers level loading and unloading when the player camera enters or exits the volume. The persistent level must contain the volume; the sub-level must be linked to it in the Levels panel.

## Setup Steps

1. In the persistent level, place an `ALevelStreamingVolume` actor at the entrance to the zone that the sub-level covers.
2. In the Levels panel, right-click the target sub-level → `Associate with streaming volume` → select the volume actor.
3. Configure the volume:
   - **Streaming Usage**: `SVB_Loading` (load as player approaches) or `SVB_LoadingAndVisibility` (load + make visible)
   - **Should Be Visible**: true if you want the level visible immediately on load
4. Set a **pre-load distance buffer**: the volume should extend ~500–1000 UU beyond the physical geometry boundary so loading completes before the player can see the loading boundary.

## ALevelStreamingVolume Properties

| Property | Recommended value | Notes |
|---|---|---|
| Streaming Usage | SVB_LoadingAndVisibility | Loads and shows level on entry |
| bEditorPrevisOnly | false | Must be false for runtime use |
| bDisabled | false | |

## Blueprint-Controlled vs Volume-Controlled

For narrative-driven loading (e.g., "load the boss arena only after the key quest is completed"):
- Use `ULevelStreamingSubsystem::LoadLevelAsync` from Blueprint, not a streaming volume
- Condition the load on a narrative flag from `UMyGameSave::NarrativeFlags`

For pure proximity loading:
- Use `ALevelStreamingVolume` — simpler, no code required

## Navmesh at Streaming Boundaries

After adding sub-levels:
1. Open the persistent level
2. Place a `RecastNavMesh` bounds volume that spans all sub-level zones
3. In `Project Settings → Navigation Mesh → Runtime Generation`: set to `Dynamic` (required for streaming)
4. Verify: `Show → Navigation` in the viewport shows a continuous navmesh with no gaps at sub-level boundaries
