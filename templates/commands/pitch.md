---
description: Pitch a new game concept (high concept → comparables → visual/tone direction → one-sheet, pitch deck, comparables doc) and create the project binding at stage:concept. Deterministic pitch-wave.
argument-hint: <concept in plain English> [project: <kebab-name>] [staffing: solo|indie|studio]
---

# /pitch — concept pitch pipeline (launches `pitch-wave`)

`/pitch $ARGUMENTS` assembles a pitch through the **deterministic `pitch-wave`**
(`.claude/workflows/pitch-wave.js`): design-director drafts the high concept + pillars + core
loop while producer drafts comparables + business framing, art-concept drafts visual direction,
and narrative-designer drafts tone/delivery — in parallel. design-director then merges all four
into `references/<project>/pitch/{one-sheet.md, pitch-deck.md, comparables.md}` and creates
`references/<project>/config.json` (the project binding every other wave resolves against),
stage set to `concept`. The wave returns a commit message; **you never commit.**

> This is the ONLY wave that creates a project binding. It does not call `resolve-project` and
> has no stage guard — there is no project yet to gate. Run this before any other `/command`.

## Phase 0 — Prep (you, directly)

1. **Pick a project name.** Kebab-case, e.g. `neon-siege`. If the user didn't give one, ask.
2. **Concept check.** If the concept is under ~6 words or clearly vague ("an FPS game"), run the
   `skills/concept-interview` question bank conversationally (Section 1: genre + player fantasy +
   core loop; Section 3: pillars) BEFORE launching — the wave itself will also bounce back with
   `needsInput` if the concept is too thin, but asking first saves a round trip.
3. **Staffing.** Default `solo` unless the user states team size (indie: 2-5, studio: larger).
4. Confirm `references/${project}/` doesn't already exist — if it does, this is a re-pitch; ask
   the user whether to proceed (it will be overwritten) or pick a different project name.

## Phase 1 — Launch the wave

```
Workflow(name: "pitch-wave", args: {
  concept: "$ARGUMENTS",
  project: "<kebab-project-name>",
  staffing: "<solo|indie|studio>"
})
```

## Phase 2 — Report

1. Present ONE structured summary (high concept, pillars, files written, commit message).
2. `status: "needsInput"` → the concept was too thin or no project name was given — relay the
   reason and, if it names the concept-interview question bank, offer to run it now.
3. `status: "needsRework"` → surface the failing phase + blockers and stop (no silent retry).
4. **No commit. No push.** The user commits.
5. Point the user at next steps: `/prototype` to graybox one mechanic, then
   `/concept-greenlight` once a prototype verdict exists.

## Substitutions
`$ARGUMENTS` — the concept description the user passed (plus any inline `project:`/`staffing:`
hints, which you should extract before building the `Workflow(...)` args above).
