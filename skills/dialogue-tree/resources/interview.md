# Dialogue Tree — Scoping Questions

1. **What is the NPC name and dialogue context?** (e.g., "Guard at checkpoint — player needs a passcode")
2. **Does the player have response choices?** (Branching dialogue vs. linear monologue vs. audio log with no responses)
3. **Is this voiced?** (If yes: what are the Wwise event names for each line? Format: `Play_VO_<NPCName>_<LineID>_01`)
4. **Does the dialogue trigger a game state change?** (e.g., unlocks a door, grants an item, sets a flag — yes requires `UDialogueSubsystem` to fire a Blueprint-callable delegate on tree end)
