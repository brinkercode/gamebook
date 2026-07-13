---
name: wwise-event-pipeline
description: The Wwise authoring↔code seam — event/RTPC/bank conventions, WAAPI batch authoring, and the audio-designer/audio-technical handoff. For audio department seats.
version: 1.0
---

# Wwise Event Pipeline

## When to use

Any audio work on a Wwise project: new events, RTPC wiring, bank layout, VO lines. (MetaSounds
projects: see `guides/` fallback section instead.)

## The seam (who owns what)

Wwise was designed around this split — respect it:
- **audio-designer** owns the Wwise project: Actor-Mixer hierarchy, events, containers,
  RTPC/switch/state definitions, bank assignment, mix buses. Authored via **WAAPI** scripts
  (`waapi-client` py) or Wwise project XML edits — text-diffable, committed.
- **audio-technical** owns the game side: `AkComponent` setup, event posting from C++/BP
  (through GAS gameplay cues where ability-driven), bank load/unload strategy, RTPC binding to
  gameplay state, memory/CPU budgets.

## Conventions

1. Events: `Play_<Thing>` / `Stop_<Thing>`; VO: `Play_VO_<Char>_<LineId>` (Sound Voice = one file
   per language per line — localization is a Wwise data structure, not custom code).
2. RTPC names mirror gameplay tags: `RTPC_Player_Health` ← `Attribute.Health`.
3. Banks per streaming level + one `Init` + one `UI` bank; no monolithic bank.
4. Every ability's audio fires via its GameplayCue tag — no direct PostEvent in ability BPs.
5. The Wwise project directory is committed (Git LFS for .wem/.bnk per `rules/git-lfs.md`);
   generated banks are build output.

## Output

WAAPI/authoring script + code-side wiring, both in the handoff (`assets_authored[]` for bank/event
artifacts). Gate: build + automation-critical (events resolve, banks load).

## Resources (read on demand)

- `resources/waapi-batch.md` — WAAPI snippets for batch event/RTPC creation
