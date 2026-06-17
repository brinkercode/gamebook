---
name: dialogue-tree
description: Use when adding NPC dialogue or audio logs to a UE5 FPS project — creates a UDA_DialogueTree Primary Data Asset, a WB_Dialogue widget, and wires Wwise events for voice playback. Invoke when the user says "add dialogue", "create an NPC conversation", "add an audio log", or "implement the dialogue system".
version: "1.0.0"
---

# Dialogue Tree

> Creates `UDA_DialogueTree` (data asset–driven conversation graph), `WB_Dialogue` (UMG widget with response selection), and Wwise event hookup for voice lines. Designers edit data assets; no Blueprint logic changes per dialogue.

## When to use

Invoke when any NPC conversation or audio log is needed. Uses the `interaction-system` skill as a dependency — the player must have an interaction system before dialogue triggers. If `UDA_DialogueTree` and `WB_Dialogue` already exist, skip to step 3 (create a new data asset for the new dialogue).

## How it works

1. **Interview** — ask the scoping questions from `resources/interview.md`.
2. **Data structures** — create `UDA_DialogueLine`, `UDA_DialogueBranch`, and `UDA_DialogueTree` per `resources/data-structures.md`.
3. **Dialogue Manager** — create `UDialogueSubsystem` (World Subsystem) per `resources/dialogue-subsystem.md`; handles playback state, current line, and branch selection.
4. **Widget** — create `WB_Dialogue` per `resources/widget.md`; subscribes to `UDialogueSubsystem` delegates.
5. **Wwise hookup** — wire `UAkAudioEvent` per line per `resources/wwise-hookup.md`.
6. **NPC actor** — add `UDA_DialogueTree` reference to the NPC; wire interaction-system trigger to `UDialogueSubsystem::StartDialogue`.
7. **Verify** — interact with NPC in PIE, confirm dialogue widget appears, voice plays, branch selection advances tree, end of tree closes widget.

## Resources (read on demand)

- `resources/interview.md` — scoping questions.
- `resources/data-structures.md` — `UDA_DialogueLine`, `UDA_DialogueBranch`, `UDA_DialogueTree` C++ classes.
- `resources/dialogue-subsystem.md` — `UDialogueSubsystem` World Subsystem implementation.
- `resources/widget.md` — `WB_Dialogue` UMG + CommonUI widget with response list.
- `resources/wwise-hookup.md` — Wwise event integration for per-line voice playback.

## Success Criteria

- [ ] Interacting with NPC opens `WB_Dialogue` on `UI.Layer.Game` layer
- [ ] Correct speaker name and line text displayed
- [ ] Wwise voice event plays on line start, stops on branch selection
- [ ] Branching: selecting a response advances to the correct next line
- [ ] End-of-tree: widget closes, gameplay input restored
- [ ] `UDialogueSubsystem::bIsDialogueActive` false after tree ends
- [ ] Audio log variant: no player response options; auto-advances on Wwise event complete

## What to Commit

```
Source/<Project>/Systems/DialogueSubsystem.h
Source/<Project>/Systems/DialogueSubsystem.cpp
Source/<Project>/Data/DA_DialogueLine.h
Source/<Project>/Data/DA_DialogueBranch.h
Source/<Project>/Data/DA_DialogueTree.h
Content/UI/Dialogue/WB_Dialogue.uasset
Content/Data/Dialogue/DA_Dialogue_<NPCName>.uasset
```
