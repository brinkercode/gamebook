# Headless level editing

Spawning/placing actors in a level from a generator script (design-level's channel for blockouts
and encounter placement).

```python
import unreal
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

les.load_level("/Game/Maps/L_Arena_01")

# blockout geometry: spawn from a kit
kit_wall = unreal.EditorAssetLibrary.load_asset("/Game/Blockout/SM_Wall_400")
for i, (x, y, yaw) in enumerate([(0, 0, 0), (400, 0, 0), (800, 0, 90)]):
    a = eas.spawn_actor_from_object(kit_wall, unreal.Vector(x, y, 0), unreal.Rotator(0, 0, yaw))
    a.set_actor_label(f"Wall_{i:02d}")

# encounter: spawn points with tags the C++ spawner consumes
spawn_cls = unreal.load_class(None, "/Script/MyGame.EnemySpawnPoint")
sp = eas.spawn_actor_from_class(spawn_cls, unreal.Vector(600, 300, 100))
sp.tags = [unreal.Name("Encounter.Arena01.Wave1")]

les.save_current_level()
```

Rules:
- Deterministic placement: coordinates come from the script (or a CSV it reads), never "arranged by eye".
- Idempotency: label actors and delete-by-label prefix before respawning that group, so re-runs don't duplicate.
- Nav/streaming config still lives in level settings — set via `unreal.EditorLevelUtils` / world settings properties in the same script.
- Cook-smoke after level generation proves the map cooks.
