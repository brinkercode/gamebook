---
name: save-system
description: Use when implementing save/load functionality in a UE5 FPS project — creates a USaveGame subclass, async serialization helpers, and encrypted slot files. Invoke when the user says "implement saving", "add save/load", "persist player progress", or "create the save system".
version: "1.0.0"
---

# Save System

> Creates `UMyGameSave` (USaveGame subclass), `USaveGameSubsystem` (GameInstance Subsystem), async save/load helpers, and XOR-encrypted slot files to resist casual tampering.

## When to use

Invoke when any persistent data needs to survive session restarts: player progress, settings, unlocked items, narrative flags, inventory. One invocation builds the full system. Adding new save fields later is a `/fix` — just extend `UMyGameSave`.

## How it works

1. **Data class** — create `UMyGameSave` per `resources/save-game-class.md`; define all serialized fields.
2. **Subsystem** — create `USaveGameSubsystem` (GameInstance Subsystem) per `resources/subsystem.md`; wraps async save/load and encryption.
3. **Encryption** — implement XOR + checksum per `resources/encryption.md`; not cryptographically secure but prevents trivial hex editing.
4. **Slot names** — define slot constants per `resources/slots.md`.
5. **Wire to game systems** — call `USaveGameSubsystem::SaveAsync` at checkpoint, on game exit, and on narrative flag changes.
6. **Verify** — save in PIE, quit PIE, relaunch PIE, confirm data restored correctly.

## Resources (read on demand)

- `resources/save-game-class.md` — `UMyGameSave` C++ class with all standard fields.
- `resources/subsystem.md` — `USaveGameSubsystem` with async save, load, delete, and slot listing.
- `resources/encryption.md` — XOR + checksum serializer applied before writing to disk.
- `resources/slots.md` — slot name constants and multi-slot (three save file) pattern.

## Success Criteria

- [ ] `USaveGameSubsystem::SaveAsync` completes without errors in PIE log
- [ ] Save file appears in `Saved/SaveGames/<SlotName>.sav`
- [ ] Load restores correct player position, inventory, and narrative flags
- [ ] Corrupted/tampered save file detected by checksum mismatch; system falls back to new game
- [ ] Async operations do not hitch the game thread (verified with `stat unit` in PIE)
- [ ] `USaveGameSubsystem::DeleteSave` removes the slot file cleanly

## What to Commit

```
Source/<Project>/Systems/SaveGameSubsystem.h
Source/<Project>/Systems/SaveGameSubsystem.cpp
Source/<Project>/Data/MyGameSave.h
Source/<Project>/Data/MyGameSave.cpp
Source/<Project>/Systems/SaveEncryption.h
Source/<Project>/Systems/SaveEncryption.cpp
```
