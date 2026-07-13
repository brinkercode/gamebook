# VFX template library contract

Each template under `/Game/VFX/Templates/` exposes a standard user-parameter set so cues can drive
any of them interchangeably:

| Parameter | Type | Meaning |
|---|---|---|
| `User.Color` | LinearColor | primary tint |
| `User.Scale` | float | overall size multiplier (1.0 = authored size) |
| `User.Intensity` | float | emission/spawn-rate multiplier |
| `User.Duration` | float | loop/burst lifetime seconds (bursts ignore if one-shot) |
| `User.Velocity` | Vector | directional bias (impacts: surface normal) |

Templates:
- `NS_BurstTemplate` — one-shot radial burst (impacts, pickups, ability procs)
- `NS_BeamTemplate` — source→target beam (hitscan, tethers)
- `NS_TrailTemplate` — ribbon trail (projectiles, dashes)
- `NS_AmbientTemplate` — looping environmental (dust, embers, drips)

Rules: adding a template needs art-director sign-off; templates are the only place raw emitter
graphs get authored by hand (in-editor by a human) — everything downstream is duplicate+parameterize
via generator scripts.
