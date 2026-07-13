# The studio roster — 35 department/role agents (L3)

Flat, single-job agent files. Waves (L2) invoke them by `agentType`; cost tier resolves through
[../models.json](../models.json) (`greenlight`=fable, `judge`=opus, `author`=sonnet,
`verifier`/`parser`=haiku). Every agent follows [_shared/WAVE-PROTOCOL.md](_shared/WAVE-PROTOCOL.md)
(Mode A schema-driven / Mode B legacy handoff file).

Waves address **roles**; at `solo`/`indie` staffing several roles are played by one agent per the
merge table in [../references/PROFILES.json](../references/PROFILES.json) — directors absorb their
department at solo scale.

| Dept | Agent | Tier | One job |
|---|---|---|---|
| studio-ops | `project-scaffolder` | judge | interview → config.json → UE project skeleton |
| studio-ops | `resolve-project` | parser | bind config + stage + staffing; never writes |
| design | `design-director` | judge | vision, pillars, briefs, greenlight chair (CD+GD merged) |
| design | `design-systems` | author | global mechanics, progression, balance frameworks |
| design | `design-combat` | author | enemies, weapons, bosses, difficulty |
| design | `design-economy` | author | currencies, sinks/sources, cosmetics-first monetization systems |
| design | `design-level` | author | blockouts, encounters, streaming (via editor-Python) |
| design | `design-ux` | author | flows, wireframes, information hierarchy, accessibility |
| design | `design-technical` | author | BP/UMG wiring against `systems_surface[]` only |
| engineering | `eng-director` | judge | architecture review + craft gate + security checklist |
| engineering | `eng-gameplay` | author | C++ systems: GAS, subsystems, components (`systems_surface[]` mandatory) |
| engineering | `eng-ui` | author | UMG/CommonUI widget C++ |
| engineering | `eng-network` | author | replication, RPC validation, server authority |
| engineering | `eng-tools` | author | editor-Python pipeline, commandlets, validators |
| engineering | `eng-build` | author | cook/package/CI, SteamPipe/EOS wiring |
| art | `art-director` | judge | style bible, sign-off, placeholder sweeps |
| art | `art-concept` | author | style guides, asset briefs, Megascans curation |
| art | `art-tech` | author | materials/shaders, pipeline, LOD/optimization |
| art | `art-vfx` | author | Niagara systems via generator scripts |
| art | `art-lighting` | author | baked lighting, post-process, lightmap optimization |
| art | `art-ui` | author | UI visual theme, CommonUI styles |
| audio | `audio-designer` | author | Wwise authoring side: events, RTPC, banks, mix |
| audio | `audio-technical` | author | code side: AkComponent, posting, bank loading |
| narrative | `narrative-designer` | author | branching structure, quest architecture, flags |
| narrative | `narrative-writer` | author | dialogue, barks, lore prose |
| production | `producer` | judge | milestones, risk registers, stage bookkeeping |
| qa | `qa-lead` | author | Functional Tests/Gauntlet authorship, test plans, asset audits |
| qa | `qa-gate-verifier` | verifier | non-trusting gate re-run; never writes |
| qa | `qa-playtest-analyst` | verifier | experience findings (fun ≠ correctness); never writes |
| qa | `qa-compliance` | verifier | Steam/Deck/TRC/XR/Lotcheck preflight; never writes |
| qa | `qa-crash-correlator` | parser | logs/callstacks → crash inventory; never writes |
| qa | `qa-bug-hunter` | author | find → root-cause → fix; adversarial skeptic in reviews |
| publishing | `release-manager` | author | packaging coordination, store assets, patch notes |
| publishing | `liveops-producer` | author | season arcs, beat calendars, postmortems |
| publishing | `community-writer` | author | patch comms, store copy, player-facing writing |

Shared context: [_shared/STACK.md](_shared/STACK.md), [_shared/PATTERNS.md](_shared/PATTERNS.md),
[_shared/HANDOFF.md](_shared/HANDOFF.md), [_shared/SECURITY_CHECKLIST.md](_shared/SECURITY_CHECKLIST.md),
[_shared/schemas/](_shared/schemas/). New agents: `scripts/new-agent.sh <name> [model]`, then add the
role to `models.json` and (if merged at small scales) `references/PROFILES.json`.
