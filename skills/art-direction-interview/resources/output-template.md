# ART_DIRECTION.md — Template

---

# Art Direction: {{ Project Name }}

## Visual Identity

**One-sentence style statement:** {{ e.g., "Grimy brutalist ruins lit by failing neon — a world that was once corporate, now reclaimed by violence" }}

**Tone words:** {{ word1 }} · {{ word2 }} · {{ word3 }}

**Primary emotional impact on first sight:** {{ named emotion }}

## References

| Reference | What we take from it |
|---|---|
| {{ game / image URL }} | {{ specific visual element }} |
| {{ game / image URL }} | {{ specific visual element }} |
| {{ game / image URL }} | {{ specific visual element }} |

## Palette

| Role | Hex | Usage |
|---|---|---|
| Background | #{{ }} | Primary environment surfaces, sky |
| Mid | #{{ }} | Secondary surfaces, props |
| Highlight | #{{ }} | Key materials, architectural feature |
| Accent | #{{ }} | HUD primary, interactive objects, loot |
| Danger | #{{ }} | Health loss, hazards, enemy weak points |
| Neutral | #{{ }} | UI background, shadows |

**Forbidden colors:** {{ list }}

**Palette lives in:** `Content/Core/Materials/M_MPC_GamePalette`

## Character and Enemy Visual Language

**Silhouette reads at 30m:** {{ description }}

**Enemy threat communication:** {{ size / color / material pattern }}

**Character art style:** {{ hyper-realistic / stylized-realistic / painterly / cel-shaded }}

## Environment Visual Language

**Lighting signature:** {{ description }}

**Dominant surfaces (Megascans tags):** {{ tag1 }}, {{ tag2 }}

**Material complexity tier:** {{ High / Medium / Low-medium }} — see `resources/pipeline-mapping.md`

**Distinct environment zones:** {{ list any areas with a different visual grammar }}

## Rendering Strategy

**Nanite:** {{ Off (default) / On — reason }}

**Global Illumination:** {{ Baked Lightmass / Lumen — reason }}

**Performance note:** {{ Any trade-offs from default locked settings }}

## HUD and UI Style

**HUD philosophy:** {{ Diegetic / Screen-space / Minimal / Maximalist }}

**UI aesthetic:** {{ description }}

**Health color:** {{ hex }} — **Ammo color:** {{ hex }} — **Objective color:** {{ hex }}

## Asset Pipeline Notes

{{ Notes from pipeline-mapping.md: Megascans filter tags, LOD strategy, Master Material setup }}

## Decisions Log

| Decision | Chosen | Rationale | Revisit trigger |
|---|---|---|---|
| Rendering mode | | | |
| Material complexity | | | |
| Lighting strategy | | | |
| Palette locked | | | |
