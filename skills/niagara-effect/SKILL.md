---
name: niagara-effect
description: Recipe for a gameplay-driven Niagara effect — template duplication via editor-Python, user parameters bound to GAS gameplay cues, perf budget compliance. For art-vfx and design-technical seats.
version: 1.0
---

# Niagara Effect Recipe

## When to use

A feature needs VFX: ability effects, impacts, environment ambience, UI-space particles. Niagara
only (Cascade is banned — locked decision).

## How it works

1. **Template-first**: keep a small library of parameterized template systems under
   `/Game/VFX/Templates/` (burst, beam, trail, ambient loop). New effects duplicate a template via
   editor-Python (`skills/ue5-editor-python`) and set user parameters — not hand-built graphs.
2. **Name**: `NS_<Verb><Noun>` (`NS_HealBurst`), emitters `NE_*`, per `rules/ue5-naming.md`.
3. **Gameplay binding**: effects fire through **GameplayCues** (`GameplayCue.Ability.Dash.Impact`)
   from GAS, never direct `SpawnSystemAtLocation` calls scattered in BP. One
   `UGameplayCueNotify_Burst` (or actor notify for looping) per cue tag.
4. **Parameters over variants**: color/scale/intensity as Niagara user parameters set by the cue,
   so one system serves many abilities.
5. **Budget**: check `quality/performance-budgets.md` — particle counts, overdraw, no per-frame
   CPU sim where GPU sim works. LOD/scalability set (`Effects` quality responds to `sg.EffectsQuality`).

## Output

Generator script in `Tools/Python/gen/vfx_<name>.py` + cue notify class/BP + the handoff's
`assets_authored[]` entries. Cook-smoke proves it cooks; the effect fires in the automation test
that exercises its ability.

## Resources (read on demand)

- `resources/templates.md` — the template library contract (what each template exposes)
